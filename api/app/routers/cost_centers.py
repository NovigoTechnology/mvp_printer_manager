from datetime import datetime
import json
import re
from typing import Dict, Optional, Tuple

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from ..db import get_db
from ..models import (
    Area,
    Branch,
    Company,
    CostCenter,
    CostCenterAudit,
    Department,
    OrganizationalUnit,
)

router = APIRouter()


def _normalize_token(value: Optional[str], fallback: str) -> str:
    if not value:
        return fallback
    token = re.sub(r"[^A-Z0-9]", "", value.upper())
    if not token:
        return fallback
    return token[:3]


def _build_cost_center_code(org_unit: OrganizationalUnit, sequence_number: int) -> str:
    company_token = _normalize_token(org_unit.company.name if org_unit.company else None, "EMP")
    branch_token = _normalize_token(org_unit.branch.code if org_unit.branch else None, "BRA")
    department_token = _normalize_token(org_unit.department.code if org_unit.department else None, "DEP")
    area_token = _normalize_token(org_unit.area.code if org_unit.area else None, "ARE")
    return f"{company_token}-{branch_token}-{department_token}-{area_token}-{sequence_number:04d}"


def _scope_from_ids(branch_id: Optional[int], department_id: Optional[int], area_id: Optional[int]) -> str:
    if area_id is not None:
        return "area"
    if department_id is not None:
        return "department"
    if branch_id is not None:
        return "branch"
    return "company"


def _scope_from_org_unit(org_unit: OrganizationalUnit) -> str:
    return _scope_from_ids(org_unit.branch_id, org_unit.department_id, org_unit.area_id)


def _validate_scope_tuple(company_id: Optional[int], branch_id: Optional[int], department_id: Optional[int], area_id: Optional[int]) -> None:
    if company_id is None:
        raise HTTPException(status_code=400, detail="Empresa invalida")
    if area_id is not None and (branch_id is None or department_id is None):
        raise HTTPException(status_code=400, detail="Para nivel area debe seleccionar sucursal y departamento")
    if department_id is not None and branch_id is None:
        raise HTTPException(status_code=400, detail="Para nivel departamento debe seleccionar sucursal")
    if branch_id is None and (department_id is not None or area_id is not None):
        raise HTTPException(status_code=400, detail="Combinacion organizativa invalida")


def _apply_ou_tuple_filter(query, company_id: int, branch_id: Optional[int], department_id: Optional[int], area_id: Optional[int]):
    query = query.filter(OrganizationalUnit.company_id == company_id)
    if branch_id is None:
        query = query.filter(OrganizationalUnit.branch_id.is_(None))
    else:
        query = query.filter(OrganizationalUnit.branch_id == branch_id)

    if department_id is None:
        query = query.filter(OrganizationalUnit.department_id.is_(None))
    else:
        query = query.filter(OrganizationalUnit.department_id == department_id)

    if area_id is None:
        query = query.filter(OrganizationalUnit.area_id.is_(None))
    else:
        query = query.filter(OrganizationalUnit.area_id == area_id)
    return query


def _find_existing_org_unit(db: Session, company_id: int, branch_id: Optional[int], department_id: Optional[int], area_id: Optional[int]) -> Optional[OrganizationalUnit]:
    query = db.query(OrganizationalUnit).filter(OrganizationalUnit.deleted_at.is_(None))
    query = _apply_ou_tuple_filter(query, company_id, branch_id, department_id, area_id)
    return query.first()


def _serialize_org_unit(org_unit: OrganizationalUnit) -> dict:
    return {
        "id": org_unit.id,
        "company_id": org_unit.company_id,
        "branch_id": org_unit.branch_id,
        "department_id": org_unit.department_id,
        "area_id": org_unit.area_id,
        "is_active": org_unit.is_active,
        "created_at": org_unit.created_at,
        "updated_at": org_unit.updated_at,
        "company_name": org_unit.company.name if org_unit.company else None,
        "branch_name": org_unit.branch.name if org_unit.branch else None,
        "branch_code": org_unit.branch.code if org_unit.branch else None,
        "department_name": org_unit.department.name if org_unit.department else None,
        "department_code": org_unit.department.code if org_unit.department else None,
        "area_name": org_unit.area.name if org_unit.area else None,
        "area_code": org_unit.area.code if org_unit.area else None,
        "scope_level": _scope_from_org_unit(org_unit),
    }


def _serialize_cost_center(cost_center: CostCenter) -> dict:
    ou = cost_center.organizational_unit
    return {
        "id": cost_center.id,
        "organizational_unit_id": cost_center.organizational_unit_id,
        "sequence_number": cost_center.sequence_number,
        "code": cost_center.code,
        "name": cost_center.name,
        "description": cost_center.description,
        "status": cost_center.status,
        "is_active": cost_center.is_active,
        "parent_cost_center_id": cost_center.parent_cost_center_id,
        "parent_cost_center_code": cost_center.parent.code if cost_center.parent else None,
        "scope_level": _scope_from_org_unit(ou) if ou else None,
        "created_at": cost_center.created_at,
        "updated_at": cost_center.updated_at,
        "organizational_unit": _serialize_org_unit(ou) if ou else None,
    }


def _nearest_parent_id(cost_center: CostCenter, ancestor_map: Dict[Tuple, int]) -> Optional[int]:
    ou = cost_center.organizational_unit
    if not ou:
        return None

    company_key = ("company", ou.company_id)
    branch_key = ("branch", ou.company_id, ou.branch_id)
    department_key = ("department", ou.company_id, ou.branch_id, ou.department_id)
    scope = _scope_from_org_unit(ou)

    if scope == "company":
        return None
    if scope == "branch":
        return ancestor_map.get(company_key)
    if scope == "department":
        return ancestor_map.get(branch_key) or ancestor_map.get(company_key)
    return ancestor_map.get(department_key) or ancestor_map.get(branch_key) or ancestor_map.get(company_key)


def _rebuild_cost_center_hierarchy(company_id: int, db: Session) -> None:
    rows = (
        db.query(CostCenter)
        .options(joinedload(CostCenter.organizational_unit))
        .join(OrganizationalUnit, CostCenter.organizational_unit_id == OrganizationalUnit.id)
        .filter(
            CostCenter.deleted_at.is_(None),
            CostCenter.is_active == True,
            OrganizationalUnit.deleted_at.is_(None),
            OrganizationalUnit.company_id == company_id,
        )
        .order_by(CostCenter.id.asc())
        .all()
    )

    ancestor_map: Dict[Tuple, int] = {}
    for row in rows:
        ou = row.organizational_unit
        if not ou:
            continue
        scope = _scope_from_org_unit(ou)
        if scope == "company":
            ancestor_map.setdefault(("company", ou.company_id), row.id)
        elif scope == "branch":
            ancestor_map.setdefault(("branch", ou.company_id, ou.branch_id), row.id)
        elif scope == "department":
            ancestor_map.setdefault(("department", ou.company_id, ou.branch_id, ou.department_id), row.id)

    has_changes = False
    for row in rows:
        parent_id = _nearest_parent_id(row, ancestor_map)
        if parent_id == row.id:
            parent_id = None
        if row.parent_cost_center_id != parent_id:
            row.parent_cost_center_id = parent_id
            has_changes = True

    if has_changes:
        db.commit()


class BranchCreate(BaseModel):
    code: str
    name: str
    address: Optional[str] = None
    status: str = "active"


class BranchUpdate(BaseModel):
    code: Optional[str] = None
    name: Optional[str] = None
    address: Optional[str] = None
    status: Optional[str] = None


class DepartmentCreate(BaseModel):
    code: str
    name: str
    status: str = "active"


class DepartmentUpdate(BaseModel):
    code: Optional[str] = None
    name: Optional[str] = None
    status: Optional[str] = None


class AreaCreate(BaseModel):
    code: str
    name: str
    status: str = "active"


class AreaUpdate(BaseModel):
    code: Optional[str] = None
    name: Optional[str] = None
    status: Optional[str] = None


class OrganizationalUnitCreate(BaseModel):
    company_id: int
    branch_id: Optional[int] = None
    department_id: Optional[int] = None
    area_id: Optional[int] = None
    is_active: bool = True


class OrganizationalUnitUpdate(BaseModel):
    company_id: Optional[int] = None
    branch_id: Optional[int] = None
    department_id: Optional[int] = None
    area_id: Optional[int] = None
    is_active: Optional[bool] = None


class CostCenterCreate(BaseModel):
    organizational_unit_id: int
    name: Optional[str] = None
    description: Optional[str] = None
    status: str = "active"
    created_by: Optional[str] = "ui-user"


class CostCenterUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    status: Optional[str] = None
    is_active: Optional[bool] = None
    changed_by: Optional[str] = "ui-user"
    change_reason: Optional[str] = None


@router.get("/lookups")
def get_lookups(db: Session = Depends(get_db)):
    companies = db.query(Company).filter(Company.status == "active").order_by(Company.name).all()
    branches = db.query(Branch).filter(Branch.deleted_at.is_(None)).order_by(Branch.name).all()
    departments = db.query(Department).filter(Department.deleted_at.is_(None)).order_by(Department.name).all()
    areas = db.query(Area).filter(Area.deleted_at.is_(None)).order_by(Area.name).all()

    return {
        "companies": [{"id": c.id, "name": c.name, "legal_name": c.legal_name, "tax_id": c.tax_id} for c in companies],
        "branches": [{"id": b.id, "code": b.code, "name": b.name, "status": b.status} for b in branches],
        "departments": [{"id": d.id, "code": d.code, "name": d.name, "status": d.status} for d in departments],
        "areas": [{"id": a.id, "code": a.code, "name": a.name, "status": a.status} for a in areas],
    }


@router.get("/branches")
def list_branches(db: Session = Depends(get_db)):
    branches = db.query(Branch).filter(Branch.deleted_at.is_(None)).order_by(Branch.name).all()
    return branches


@router.post("/branches")
def create_branch(payload: BranchCreate, db: Session = Depends(get_db)):
    item = Branch(
        code=payload.code.strip().upper(),
        name=payload.name.strip(),
        address=payload.address,
        status=payload.status,
    )
    try:
        db.add(item)
        db.commit()
        db.refresh(item)
        return item
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Codigo o nombre de sucursal ya existe")


@router.put("/branches/{branch_id}")
def update_branch(branch_id: int, payload: BranchUpdate, db: Session = Depends(get_db)):
    item = db.query(Branch).filter(Branch.id == branch_id, Branch.deleted_at.is_(None)).first()
    if not item:
        raise HTTPException(status_code=404, detail="Sucursal no encontrada")

    update_data = payload.dict(exclude_unset=True)
    if "code" in update_data and update_data["code"] is not None:
        update_data["code"] = update_data["code"].strip().upper()
    if "name" in update_data and update_data["name"] is not None:
        update_data["name"] = update_data["name"].strip()

    for field, value in update_data.items():
        setattr(item, field, value)

    try:
        db.commit()
        db.refresh(item)
        return item
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Codigo o nombre de sucursal ya existe")


@router.delete("/branches/{branch_id}")
def delete_branch(branch_id: int, db: Session = Depends(get_db)):
    item = db.query(Branch).filter(Branch.id == branch_id, Branch.deleted_at.is_(None)).first()
    if not item:
        raise HTTPException(status_code=404, detail="Sucursal no encontrada")

    has_links = db.query(OrganizationalUnit).filter(
        OrganizationalUnit.branch_id == branch_id,
        OrganizationalUnit.deleted_at.is_(None),
    ).count()
    if has_links > 0:
        raise HTTPException(status_code=400, detail="No se puede eliminar: hay unidades organizativas asociadas")

    item.deleted_at = datetime.utcnow()
    item.status = "inactive"
    db.commit()
    return {"message": "Sucursal eliminada"}


@router.get("/departments")
def list_departments(db: Session = Depends(get_db)):
    items = db.query(Department).filter(Department.deleted_at.is_(None)).order_by(Department.name).all()
    return items


@router.post("/departments")
def create_department(payload: DepartmentCreate, db: Session = Depends(get_db)):
    item = Department(code=payload.code.strip().upper(), name=payload.name.strip(), status=payload.status)
    try:
        db.add(item)
        db.commit()
        db.refresh(item)
        return item
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Codigo o nombre de departamento ya existe")


@router.put("/departments/{department_id}")
def update_department(department_id: int, payload: DepartmentUpdate, db: Session = Depends(get_db)):
    item = db.query(Department).filter(Department.id == department_id, Department.deleted_at.is_(None)).first()
    if not item:
        raise HTTPException(status_code=404, detail="Departamento no encontrado")

    update_data = payload.dict(exclude_unset=True)
    if "code" in update_data and update_data["code"] is not None:
        update_data["code"] = update_data["code"].strip().upper()
    if "name" in update_data and update_data["name"] is not None:
        update_data["name"] = update_data["name"].strip()

    for field, value in update_data.items():
        setattr(item, field, value)

    try:
        db.commit()
        db.refresh(item)
        return item
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Codigo o nombre de departamento ya existe")


@router.delete("/departments/{department_id}")
def delete_department(department_id: int, db: Session = Depends(get_db)):
    item = db.query(Department).filter(Department.id == department_id, Department.deleted_at.is_(None)).first()
    if not item:
        raise HTTPException(status_code=404, detail="Departamento no encontrado")

    has_links = db.query(OrganizationalUnit).filter(
        OrganizationalUnit.department_id == department_id,
        OrganizationalUnit.deleted_at.is_(None),
    ).count()
    if has_links > 0:
        raise HTTPException(status_code=400, detail="No se puede eliminar: hay unidades organizativas asociadas")

    item.deleted_at = datetime.utcnow()
    item.status = "inactive"
    db.commit()
    return {"message": "Departamento eliminado"}


@router.get("/areas")
def list_areas(db: Session = Depends(get_db)):
    items = db.query(Area).filter(Area.deleted_at.is_(None)).order_by(Area.name).all()
    return items


@router.post("/areas")
def create_area(payload: AreaCreate, db: Session = Depends(get_db)):
    item = Area(code=payload.code.strip().upper(), name=payload.name.strip(), status=payload.status)
    try:
        db.add(item)
        db.commit()
        db.refresh(item)
        return item
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Codigo o nombre de area ya existe")


@router.put("/areas/{area_id}")
def update_area(area_id: int, payload: AreaUpdate, db: Session = Depends(get_db)):
    item = db.query(Area).filter(Area.id == area_id, Area.deleted_at.is_(None)).first()
    if not item:
        raise HTTPException(status_code=404, detail="Area no encontrada")

    update_data = payload.dict(exclude_unset=True)
    if "code" in update_data and update_data["code"] is not None:
        update_data["code"] = update_data["code"].strip().upper()
    if "name" in update_data and update_data["name"] is not None:
        update_data["name"] = update_data["name"].strip()

    for field, value in update_data.items():
        setattr(item, field, value)

    try:
        db.commit()
        db.refresh(item)
        return item
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Codigo o nombre de area ya existe")


@router.delete("/areas/{area_id}")
def delete_area(area_id: int, db: Session = Depends(get_db)):
    item = db.query(Area).filter(Area.id == area_id, Area.deleted_at.is_(None)).first()
    if not item:
        raise HTTPException(status_code=404, detail="Area no encontrada")

    has_links = db.query(OrganizationalUnit).filter(
        OrganizationalUnit.area_id == area_id,
        OrganizationalUnit.deleted_at.is_(None),
    ).count()
    if has_links > 0:
        raise HTTPException(status_code=400, detail="No se puede eliminar: hay unidades organizativas asociadas")

    item.deleted_at = datetime.utcnow()
    item.status = "inactive"
    db.commit()
    return {"message": "Area eliminada"}


@router.get("/organizational-units")
def list_organizational_units(db: Session = Depends(get_db)):
    rows = (
        db.query(OrganizationalUnit)
        .options(
            joinedload(OrganizationalUnit.company),
            joinedload(OrganizationalUnit.branch),
            joinedload(OrganizationalUnit.department),
            joinedload(OrganizationalUnit.area),
        )
        .filter(OrganizationalUnit.deleted_at.is_(None))
        .order_by(OrganizationalUnit.id.desc())
        .all()
    )
    return [_serialize_org_unit(row) for row in rows]


@router.post("/organizational-units")
def create_organizational_unit(payload: OrganizationalUnitCreate, db: Session = Depends(get_db)):
    _validate_scope_tuple(payload.company_id, payload.branch_id, payload.department_id, payload.area_id)

    company = db.query(Company).filter(Company.id == payload.company_id, Company.status == "active").first()
    branch = None
    department = None
    area = None

    if payload.branch_id is not None:
        branch = db.query(Branch).filter(Branch.id == payload.branch_id, Branch.deleted_at.is_(None)).first()
    if payload.department_id is not None:
        department = db.query(Department).filter(Department.id == payload.department_id, Department.deleted_at.is_(None)).first()
    if payload.area_id is not None:
        area = db.query(Area).filter(Area.id == payload.area_id, Area.deleted_at.is_(None)).first()

    if not company:
        raise HTTPException(status_code=400, detail="Empresa invalida")
    if payload.branch_id is not None and not branch:
        raise HTTPException(status_code=400, detail="Sucursal invalida")
    if payload.department_id is not None and not department:
        raise HTTPException(status_code=400, detail="Departamento invalido")
    if payload.area_id is not None and not area:
        raise HTTPException(status_code=400, detail="Area invalida")

    existing = _find_existing_org_unit(
        db,
        payload.company_id,
        payload.branch_id,
        payload.department_id,
        payload.area_id,
    )
    if existing:
        row = (
            db.query(OrganizationalUnit)
            .options(
                joinedload(OrganizationalUnit.company),
                joinedload(OrganizationalUnit.branch),
                joinedload(OrganizationalUnit.department),
                joinedload(OrganizationalUnit.area),
            )
            .filter(OrganizationalUnit.id == existing.id)
            .first()
        )
        return _serialize_org_unit(row)

    item = OrganizationalUnit(**payload.dict())
    try:
        db.add(item)
        db.commit()
        db.refresh(item)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="Datos de unidad organizativa invalidos")

    row = (
        db.query(OrganizationalUnit)
        .options(
            joinedload(OrganizationalUnit.company),
            joinedload(OrganizationalUnit.branch),
            joinedload(OrganizationalUnit.department),
            joinedload(OrganizationalUnit.area),
        )
        .filter(OrganizationalUnit.id == item.id)
        .first()
    )
    return _serialize_org_unit(row)


@router.put("/organizational-units/{org_unit_id}")
def update_organizational_unit(org_unit_id: int, payload: OrganizationalUnitUpdate, db: Session = Depends(get_db)):
    item = db.query(OrganizationalUnit).filter(
        OrganizationalUnit.id == org_unit_id,
        OrganizationalUnit.deleted_at.is_(None),
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Unidad organizativa no encontrada")

    update_data = payload.dict(exclude_unset=True)

    target_company_id = update_data.get("company_id", item.company_id)
    target_branch_id = update_data.get("branch_id", item.branch_id)
    target_department_id = update_data.get("department_id", item.department_id)
    target_area_id = update_data.get("area_id", item.area_id)

    _validate_scope_tuple(target_company_id, target_branch_id, target_department_id, target_area_id)

    if "company_id" in update_data:
        company = db.query(Company).filter(Company.id == update_data["company_id"], Company.status == "active").first()
        if not company:
            raise HTTPException(status_code=400, detail="Empresa invalida")
    if target_branch_id is not None:
        branch = db.query(Branch).filter(Branch.id == target_branch_id, Branch.deleted_at.is_(None)).first()
        if not branch:
            raise HTTPException(status_code=400, detail="Sucursal invalida")
    if target_department_id is not None:
        department = db.query(Department).filter(Department.id == target_department_id, Department.deleted_at.is_(None)).first()
        if not department:
            raise HTTPException(status_code=400, detail="Departamento invalido")
    if target_area_id is not None:
        area = db.query(Area).filter(Area.id == target_area_id, Area.deleted_at.is_(None)).first()
        if not area:
            raise HTTPException(status_code=400, detail="Area invalida")

    duplicate = _find_existing_org_unit(db, target_company_id, target_branch_id, target_department_id, target_area_id)
    if duplicate and duplicate.id != item.id:
        raise HTTPException(status_code=400, detail="La combinacion ya existe")

    for field, value in update_data.items():
        setattr(item, field, value)

    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=400, detail="La combinacion ya existe")

    row = (
        db.query(OrganizationalUnit)
        .options(
            joinedload(OrganizationalUnit.company),
            joinedload(OrganizationalUnit.branch),
            joinedload(OrganizationalUnit.department),
            joinedload(OrganizationalUnit.area),
        )
        .filter(OrganizationalUnit.id == item.id)
        .first()
    )
    return _serialize_org_unit(row)


@router.delete("/organizational-units/{org_unit_id}")
def delete_organizational_unit(org_unit_id: int, db: Session = Depends(get_db)):
    item = db.query(OrganizationalUnit).filter(
        OrganizationalUnit.id == org_unit_id,
        OrganizationalUnit.deleted_at.is_(None),
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Unidad organizativa no encontrada")

    active_cost_centers = db.query(CostCenter).filter(
        CostCenter.organizational_unit_id == org_unit_id,
        CostCenter.deleted_at.is_(None),
    ).count()
    if active_cost_centers > 0:
        raise HTTPException(status_code=400, detail="No se puede eliminar: hay centros de costos asociados")

    item.deleted_at = datetime.utcnow()
    item.is_active = False
    db.commit()
    return {"message": "Unidad organizativa eliminada"}


@router.get("/")
def list_cost_centers(
    status: Optional[str] = None,
    organizational_unit_id: Optional[int] = None,
    db: Session = Depends(get_db),
):
    query = (
        db.query(CostCenter)
        .options(
            joinedload(CostCenter.parent),
            joinedload(CostCenter.organizational_unit).joinedload(OrganizationalUnit.company),
            joinedload(CostCenter.organizational_unit).joinedload(OrganizationalUnit.branch),
            joinedload(CostCenter.organizational_unit).joinedload(OrganizationalUnit.department),
            joinedload(CostCenter.organizational_unit).joinedload(OrganizationalUnit.area),
        )
        .filter(CostCenter.deleted_at.is_(None))
    )

    if status:
        query = query.filter(CostCenter.status == status)
    if organizational_unit_id:
        query = query.filter(CostCenter.organizational_unit_id == organizational_unit_id)

    rows = query.order_by(CostCenter.id.desc()).all()
    return [_serialize_cost_center(row) for row in rows]


@router.post("/")
def create_cost_center(payload: CostCenterCreate, db: Session = Depends(get_db)):
    ou = (
        db.query(OrganizationalUnit)
        .options(
            joinedload(OrganizationalUnit.company),
            joinedload(OrganizationalUnit.branch),
            joinedload(OrganizationalUnit.department),
            joinedload(OrganizationalUnit.area),
        )
        .filter(
            OrganizationalUnit.id == payload.organizational_unit_id,
            OrganizationalUnit.deleted_at.is_(None),
            OrganizationalUnit.is_active == True,
        )
        .first()
    )

    if not ou:
        raise HTTPException(status_code=404, detail="Unidad organizativa no encontrada")

    current_max = (
        db.query(func.max(CostCenter.sequence_number))
        .filter(
            CostCenter.organizational_unit_id == payload.organizational_unit_id,
            CostCenter.deleted_at.is_(None),
        )
        .scalar()
        or 0
    )

    sequence_number = current_max + 1
    code = _build_cost_center_code(ou, sequence_number)

    item = CostCenter(
        organizational_unit_id=payload.organizational_unit_id,
        parent_cost_center_id=None,
        sequence_number=sequence_number,
        code=code,
        name=payload.name,
        description=payload.description,
        status=payload.status,
        is_active=payload.status == "active",
    )

    db.add(item)
    try:
        db.commit()
        db.refresh(item)
    except IntegrityError:
        db.rollback()
        raise HTTPException(status_code=409, detail="No se pudo generar un correlativo unico. Reintente")

    audit = CostCenterAudit(
        cost_center_id=item.id,
        action="CREATE",
        changed_by=payload.created_by,
        change_reason="Creacion manual",
        changed_fields=json.dumps(
            {
                "code": code,
                "sequence_number": sequence_number,
                "organizational_unit_id": payload.organizational_unit_id,
            }
        ),
    )
    db.add(audit)
    db.commit()

    _rebuild_cost_center_hierarchy(ou.company_id, db)

    row = (
        db.query(CostCenter)
        .options(
            joinedload(CostCenter.parent),
            joinedload(CostCenter.organizational_unit).joinedload(OrganizationalUnit.company),
            joinedload(CostCenter.organizational_unit).joinedload(OrganizationalUnit.branch),
            joinedload(CostCenter.organizational_unit).joinedload(OrganizationalUnit.department),
            joinedload(CostCenter.organizational_unit).joinedload(OrganizationalUnit.area),
        )
        .filter(CostCenter.id == item.id)
        .first()
    )
    return _serialize_cost_center(row)


@router.put("/{cost_center_id}")
def update_cost_center(cost_center_id: int, payload: CostCenterUpdate, db: Session = Depends(get_db)):
    item = db.query(CostCenter).filter(CostCenter.id == cost_center_id, CostCenter.deleted_at.is_(None)).first()
    if not item:
        raise HTTPException(status_code=404, detail="Centro de costo no encontrado")

    old_data = {
        "name": item.name,
        "description": item.description,
        "status": item.status,
        "is_active": item.is_active,
    }

    update_data = payload.dict(exclude_unset=True)
    changed_by = update_data.pop("changed_by", "ui-user")
    change_reason = update_data.pop("change_reason", None)

    for field, value in update_data.items():
        setattr(item, field, value)

    if "status" in update_data:
        item.is_active = update_data["status"] == "active"

    db.commit()
    db.refresh(item)

    new_data = {
        "name": item.name,
        "description": item.description,
        "status": item.status,
        "is_active": item.is_active,
    }

    audit = CostCenterAudit(
        cost_center_id=item.id,
        action="UPDATE",
        changed_by=changed_by,
        change_reason=change_reason,
        changed_fields=json.dumps({"old": old_data, "new": new_data}),
    )
    db.add(audit)
    db.commit()

    ou_company_id = (
        db.query(OrganizationalUnit.company_id)
        .filter(OrganizationalUnit.id == item.organizational_unit_id)
        .scalar()
    )
    if ou_company_id:
        _rebuild_cost_center_hierarchy(ou_company_id, db)

    row = (
        db.query(CostCenter)
        .options(
            joinedload(CostCenter.parent),
            joinedload(CostCenter.organizational_unit).joinedload(OrganizationalUnit.company),
            joinedload(CostCenter.organizational_unit).joinedload(OrganizationalUnit.branch),
            joinedload(CostCenter.organizational_unit).joinedload(OrganizationalUnit.department),
            joinedload(CostCenter.organizational_unit).joinedload(OrganizationalUnit.area),
        )
        .filter(CostCenter.id == item.id)
        .first()
    )
    return _serialize_cost_center(row)


@router.delete("/{cost_center_id}")
def delete_cost_center(cost_center_id: int, changed_by: str = "ui-user", db: Session = Depends(get_db)):
    item = db.query(CostCenter).filter(CostCenter.id == cost_center_id, CostCenter.deleted_at.is_(None)).first()
    if not item:
        raise HTTPException(status_code=404, detail="Centro de costo no encontrado")

    item.deleted_at = datetime.utcnow()
    item.status = "inactive"
    item.is_active = False
    ou_company_id = (
        db.query(OrganizationalUnit.company_id)
        .filter(OrganizationalUnit.id == item.organizational_unit_id)
        .scalar()
    )
    db.commit()

    audit = CostCenterAudit(
        cost_center_id=item.id,
        action="DELETE",
        changed_by=changed_by,
        change_reason="Borrado logico",
    )
    db.add(audit)
    db.commit()

    if ou_company_id:
        _rebuild_cost_center_hierarchy(ou_company_id, db)

    return {"message": "Centro de costo eliminado"}
