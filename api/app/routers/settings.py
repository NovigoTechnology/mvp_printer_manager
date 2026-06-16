"""
Router for SMTP configuration settings
Handles GET/POST/PUT operations for email/SMTP settings
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime
import logging

from app.db import get_db
from app.models import SMTPConfig, User
from app.routers.auth import get_current_admin_user

router = APIRouter(prefix="/api/settings", tags=["settings"])
logger = logging.getLogger(__name__)


class SMTPConfigResponse:
    """Response model for SMTP configuration"""
    def __init__(self, config: SMTPConfig):
        self.id = config.id
        self.enabled = config.enabled
        self.host = config.host
        self.port = config.port
        self.use_tls = config.use_tls
        self.username = config.username
        self.password = "***REDACTED***" if config.password else None
        self.from_email = config.from_email
        self.from_name = config.from_name
        self.created_at = config.created_at
        self.updated_at = config.updated_at
        self.updated_by = config.updated_by


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
                "from_name": "Printer Fleet Manager"
            }
        
        return {
            "id": config.id,
            "enabled": config.enabled,
            "host": config.host,
            "port": config.port,
            "use_tls": config.use_tls,
            "username": config.username,
            "password": None,  # Never return password
            "from_email": config.from_email,
            "from_name": config.from_name,
            "created_at": config.created_at,
            "updated_at": config.updated_at,
            "updated_by": config.updated_by
        }
    except Exception as e:
        logger.error(f"Error retrieving SMTP config: {e}")
        raise HTTPException(status_code=500, detail="Error retrieving SMTP configuration")


@router.post("/smtp")
async def create_smtp_config(
    config_data: dict,
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
        config.enabled = config_data.get('enabled', False)
        config.host = config_data.get('host', '')
        config.port = config_data.get('port', 587)
        config.use_tls = config_data.get('use_tls', True)
        config.username = config_data.get('username', '')
        
        # Only update password if provided and not redacted
        if 'password' in config_data and config_data['password'] and config_data['password'] != '***REDACTED***':
            config.password = config_data['password']
        
        config.from_email = config_data.get('from_email', '')
        config.from_name = config_data.get('from_name', 'Printer Fleet Manager')
        config.updated_at = datetime.utcnow()
        config.updated_by = current_user.username
        
        db.commit()
        
        logger.info(f"SMTP configuration updated by {current_user.username}")
        
        return {
            "message": "SMTP configuration updated successfully",
            "enabled": config.enabled,
            "host": config.host,
            "from_email": config.from_email
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
        
        if not all([config.host, config.port, config.username, config.password]):
            raise HTTPException(status_code=400, detail="SMTP configuration is incomplete")
        
        # Test connection
        with smtplib.SMTP(config.host, config.port, timeout=10) as server:
            if config.use_tls:
                server.starttls()
            
            server.login(config.username, config.password)
        
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
    except Exception as e:
        logger.error(f"Error testing SMTP connection: {e}")
        raise HTTPException(status_code=500, detail="Error testing SMTP connection")


@router.put("/smtp")
async def update_smtp_config(
    config_data: dict,
    current_user: User = Depends(get_current_admin_user),
    db: Session = Depends(get_db)
):
    """
    Update SMTP configuration (admin only)
    """
    return await create_smtp_config(config_data, current_user, db)
