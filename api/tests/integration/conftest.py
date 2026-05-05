"""
Configuración compartida para tests de integración.
Provee TestClient de FastAPI y fixtures de base de datos en memoria.
"""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

# Configurar variables de entorno ANTES de importar la app
import os
os.environ.setdefault("DATABASE_URL", "postgresql://test:test@localhost:5432/test")
os.environ.setdefault("JWT_SECRET", "test-secret-key-for-integration-tests-32ch")
os.environ.setdefault("DRYPIX_LOGIN", "dryprinter")
os.environ.setdefault("DRYPIX_PASSWORD", "fujifilm")
os.environ.setdefault("CORS_ORIGINS", "http://localhost:3000")
os.environ.setdefault("RATE_LIMIT_AUTH", "100/minute")  # High limit so tests don't hit it
os.environ.setdefault("RATE_LIMIT_DEFAULT", "10000/hour")

from app.main import app
from app.db import Base, get_db


# ============================================================================
# DATABASE FIXTURE (SQLite en memoria para tests)
# ============================================================================

SQLALCHEMY_TEST_URL = "sqlite://"

@pytest.fixture(scope="session")
def test_engine():
    """Motor SQLite en memoria compartido por toda la sesión de tests."""
    engine = create_engine(
        SQLALCHEMY_TEST_URL,
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    yield engine
    Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def test_db(test_engine):
    """Sesión de base de datos limpia para cada test."""
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.rollback()
        db.close()


# ============================================================================
# TEST CLIENT FIXTURE
# ============================================================================

@pytest.fixture(scope="session")
def client(test_engine):
    """FastAPI TestClient con base de datos de test inyectada."""
    TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=test_engine)

    def override_get_db():
        db = TestingSessionLocal()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


# ============================================================================
# USER FIXTURES
# ============================================================================

@pytest.fixture(scope="function")
def test_user(test_db):
    """Crea un usuario de test en la base de datos."""
    import bcrypt
    from app.models import User

    hashed = bcrypt.hashpw(b"testpassword123", bcrypt.gensalt()).decode()
    user = User(
        username="testuser",
        email="test@example.com",
        hashed_password=hashed,
        role="admin",
        is_active=True
    )
    test_db.add(user)
    test_db.commit()
    test_db.refresh(user)
    yield user
    test_db.delete(user)
    test_db.commit()


@pytest.fixture(scope="function")
def auth_headers(client, test_user):
    """Obtiene headers JWT de autenticación válidos para el usuario de test."""
    response = client.post(
        "/auth/token",
        data={"username": "testuser", "password": "testpassword123"},
        headers={"Content-Type": "application/x-www-form-urlencoded"}
    )
    assert response.status_code == 200, f"Login failed: {response.text}"
    token = response.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}
