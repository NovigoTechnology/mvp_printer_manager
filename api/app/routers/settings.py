"""
Router for SMTP configuration settings
Handles GET/POST/PUT operations for email/SMTP settings
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session
import logging

from app.db import get_db
from app.models import SMTPConfig, User
from app.routers.auth import get_current_admin_user
from app.services.crypto import decrypt_secret, encrypt_secret

router = APIRouter(prefix="/api/settings", tags=["settings"])
logger = logging.getLogger(__name__)


class SMTPConfigUpdate(BaseModel):
    enabled: bool = False
    host: str = ""
    port: int = Field(default=587, ge=1, le=65535)
    use_tls: bool = True
    username: str = ""
    password: str | None = None
    from_email: str = ""
    from_name: str = "Printer Fleet Manager"


def _serialize_config(config: SMTPConfig):
    return {
        "id": config.id,
        "enabled": config.enabled,
        "host": config.host or "",
        "port": config.port or 587,
        "use_tls": config.use_tls if config.use_tls is not None else True,
        "username": config.username or "",
        "password": None,
        "from_email": config.from_email or "",
        "from_name": config.from_name or "Printer Fleet Manager",
        "created_at": config.created_at,
        "updated_at": config.updated_at,
        "updated_by": config.updated_by,
        "password_configured": bool(config.password),
    }


@router.get("/smtp")
async def get_smtp_config(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    Get current SMTP configuration (admin only)
    Password is redacted for security
    """
    try:
        config = db.query(SMTPConfig).filter(SMTPConfig.id == 1).first()
        
        if not config:
            # Return empty config if not exists
            return {
                "id": 1,
                "enabled": False,
                "host": "",
                "port": 587,
                "use_tls": True,
                "username": "",
                "password": None,
                "from_email": "",
                "from_name": "Printer Fleet Manager",
                "password_configured": False,
            }
        
        return _serialize_config(config)
    except Exception as e:
        logger.error(f"Error retrieving SMTP config: {e}")
        raise HTTPException(status_code=500, detail="Error retrieving SMTP configuration")


@router.post("/smtp")
async def create_smtp_config(
    config_data: SMTPConfigUpdate,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    Create or update SMTP configuration (admin only)
    """
    try:
        # Get or create configuration (always use id=1)
        config = db.query(SMTPConfig).filter(SMTPConfig.id == 1).first()
        
        if not config:
            config = SMTPConfig(id=1)
            db.add(config)
        
        # Update fields
        config.enabled = config_data.enabled
        config.host = config_data.host.strip()
        config.port = config_data.port
        config.use_tls = config_data.use_tls
        config.username = config_data.username.strip()
        
        if config_data.password and config_data.password != '***REDACTED***':
            config.password = encrypt_secret(config_data.password)
        
        config.from_email = config_data.from_email.strip()
        config.from_name = config_data.from_name.strip() or 'Printer Fleet Manager'
        config.updated_by = current_user.username
        
        db.commit()
        
        logger.info(f"SMTP configuration updated by {current_user.username}")
        
        return {
            "message": "SMTP configuration updated successfully",
            "enabled": config.enabled,
            "host": config.host,
            "from_email": config.from_email,
            "password_configured": bool(config.password),
        }
        
    except Exception as e:
        db.rollback()
        logger.error(f"Error updating SMTP config: {e}")
        raise HTTPException(status_code=500, detail="Error updating SMTP configuration")


@router.post("/smtp/test")
async def test_smtp_connection(
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    Test SMTP connection with current configuration
    """
    import smtplib
    
    try:
        config = db.query(SMTPConfig).filter(SMTPConfig.id == 1).first()
        
        if not config or not config.enabled:
            raise HTTPException(status_code=400, detail="SMTP is not enabled")
        
        password = decrypt_secret(config.password)

        if not all([config.host, config.port, config.username, password]):
            raise HTTPException(status_code=400, detail="SMTP configuration is incomplete")
        
        # Test connection
        with smtplib.SMTP(config.host, config.port, timeout=10) as server:
            if config.use_tls:
                server.starttls()
            
            server.login(config.username, password)
        
        logger.info(f"SMTP connection test successful by {current_user.username}")
        
        return {
            "message": "SMTP connection successful",
            "host": config.host,
            "port": config.port
        }
        
    except smtplib.SMTPAuthenticationError:
        logger.error(f"SMTP authentication failed")
        raise HTTPException(
            status_code=400,
            detail="SMTP authentication failed. Check username and password."
        )
    except smtplib.SMTPException as e:
        logger.error(f"SMTP error: {e}")
        raise HTTPException(status_code=400, detail=f"SMTP error: {str(e)}")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error testing SMTP connection: {e}")
        raise HTTPException(status_code=500, detail="Error testing SMTP connection")


@router.put("/smtp")
async def update_smtp_config(
    config_data: SMTPConfigUpdate,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    Update SMTP configuration (admin only)
    """
    return await create_smtp_config(config_data, current_user, db)
