"""
Email service module
Handles sending emails using SMTP configuration from database
"""

import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
import logging
from typing import Optional, List
from sqlalchemy.orm import Session

from app.models import SMTPConfig
from app.services.crypto import decrypt_secret

logger = logging.getLogger("email_service")


class EmailService:
    """Service for sending emails using configured SMTP server"""
    
    @staticmethod
    def get_smtp_config(db: Session) -> Optional[SMTPConfig]:
        """Retrieve SMTP configuration from database"""
        try:
            config = db.query(SMTPConfig).filter(SMTPConfig.id == 1).first()
            return config
        except Exception as e:
            logger.error(f"Error retrieving SMTP config: {e}")
            return None
    
    @staticmethod
    def is_smtp_enabled(db: Session) -> bool:
        """Check if SMTP is enabled and properly configured"""
        config = EmailService.get_smtp_config(db)
        if not config or not config.enabled:
            return False
        
        # Verify required fields
        if not all([config.host, config.port, config.from_email, config.username, config.password]):
            logger.warning("SMTP enabled but missing required configuration fields")
            return False
        
        return True
    
    @staticmethod
    def send_email(
        db: Session,
        to_email: str,
        subject: str,
        body: str,
        html_body: Optional[str] = None,
        cc: Optional[List[str]] = None,
        bcc: Optional[List[str]] = None,
        attachments: Optional[List[tuple]] = None
    ) -> bool:
        """
        Send email using configured SMTP server
        
        Args:
            db: Database session
            to_email: Recipient email address
            subject: Email subject
            body: Plain text body
            html_body: Optional HTML body
            cc: Optional list of CC addresses
            bcc: Optional list of BCC addresses
            attachments: Optional list of (filename, content) tuples
            
        Returns:
            bool: True if sent successfully, False otherwise
        """
        
        config = EmailService.get_smtp_config(db)
        
        if not EmailService.is_smtp_enabled(db):
            logger.error("SMTP not enabled or not properly configured")
            return False
        
        try:
            # Create message
            msg = MIMEMultipart('alternative')
            msg['Subject'] = subject
            msg['From'] = f"{config.from_name} <{config.from_email}>"
            msg['To'] = to_email
            
            if cc:
                msg['Cc'] = ', '.join(cc)
            
            # Attach text body
            msg.attach(MIMEText(body, 'plain'))
            
            # Attach HTML body if provided
            if html_body:
                msg.attach(MIMEText(html_body, 'html'))
            
            # Attach files if provided
            if attachments:
                for filename, content in attachments:
                    part = MIMEBase('application', 'octet-stream')
                    part.set_payload(content)
                    encoders.encode_base64(part)
                    part.add_header('Content-Disposition', f'attachment; filename= {filename}')
                    msg.attach(part)
            
            # Prepare recipient list
            recipients = [to_email]
            if cc:
                recipients.extend(cc)
            if bcc:
                recipients.extend(bcc)
            
            password = decrypt_secret(config.password)
            if not password:
                logger.error("SMTP password is not configured")
                return False

            with smtplib.SMTP(config.host, config.port, timeout=10) as server:
                if config.use_tls:
                    server.starttls()
                
                server.login(config.username, password)
                server.send_message(msg, from_addr=config.from_email, to_addrs=recipients)
            
            logger.info(f"Email sent successfully to {to_email}")
            return True
            
        except smtplib.SMTPAuthenticationError as e:
            logger.error(f"SMTP authentication failed: {e}")
            return False
        except smtplib.SMTPException as e:
            logger.error(f"SMTP error: {e}")
            return False
        except Exception as e:
            logger.error(f"Error sending email: {e}")
            return False
    
    @staticmethod
    def send_toner_alert(
        db: Session,
        to_email: str,
        printer_name: str,
        toner_level: int,
        threshold: int
    ) -> bool:
        """Send low toner alert email"""
        
        subject = f"⚠️ Alerta de Tóner Bajo: {printer_name}"
        
        body = f"""
Alerta de Tóner Bajo

La impresora {printer_name} tiene un nivel de tóner bajo.

Nivel actual: {toner_level}%
Umbral configurado: {threshold}%

Por favor, reemplace el cartucho de tóner lo antes posible.

---
Printer Fleet Manager
        """
        
        html_body = f"""
<html>
  <body style="font-family: Arial, sans-serif;">
    <div style="background-color: #f8d7da; border: 1px solid #f5c6cb; border-radius: 4px; padding: 12px; color: #721c24;">
      <h2 style="margin-top: 0; color: #721c24;">⚠️ Alerta de Tóner Bajo</h2>
      <p><strong>Impresora:</strong> {printer_name}</p>
      <p><strong>Nivel de tóner:</strong> <span style="font-size: 24px; font-weight: bold;">{toner_level}%</span></p>
      <p><strong>Umbral configurado:</strong> {threshold}%</p>
      <p>Por favor, reemplace el cartucho de tóner lo antes posible para evitar interrupciones en la impresión.</p>
    </div>
    <hr style="margin: 20px 0;">
    <p style="font-size: 12px; color: #666;">
      <em>Printer Fleet Manager</em>
    </p>
  </body>
</html>
        """
        
        return EmailService.send_email(
            db=db,
            to_email=to_email,
            subject=subject,
            body=body,
            html_body=html_body
        )
    
    @staticmethod
    def send_incident_notification(
        db: Session,
        to_email: str,
        incident_id: int,
        printer_name: str,
        incident_type: str,
        description: str
    ) -> bool:
        """Send incident notification email"""
        
        subject = f"🔧 Nuevo Incidente Reportado: {incident_type} - {printer_name}"
        
        body = f"""
Nuevo Incidente

Se ha reportado un nuevo incidente en su sistema Printer Fleet Manager.

ID del Incidente: {incident_id}
Impresora: {printer_name}
Tipo: {incident_type}
Descripción: {description}

Por favor, acceda al sistema para más detalles y tomar las acciones necesarias.

---
Printer Fleet Manager
        """
        
        html_body = f"""
<html>
  <body style="font-family: Arial, sans-serif;">
    <div style="background-color: #cfe2ff; border: 1px solid #b6d4fe; border-radius: 4px; padding: 12px; color: #084298;">
      <h2 style="margin-top: 0; color: #084298;">🔧 Nuevo Incidente Reportado</h2>
      <p><strong>ID:</strong> #{incident_id}</p>
      <p><strong>Impresora:</strong> {printer_name}</p>
      <p><strong>Tipo:</strong> {incident_type}</p>
      <p><strong>Descripción:</strong></p>
      <p style="background-color: #fff; border-left: 3px solid #084298; padding: 10px; margin: 10px 0;">
        {description}
      </p>
      <p>Por favor, acceda al sistema para más detalles y tomar las acciones necesarias.</p>
    </div>
    <hr style="margin: 20px 0;">
    <p style="font-size: 12px; color: #666;">
      <em>Printer Fleet Manager</em>
    </p>
  </body>
</html>
        """
        
        return EmailService.send_email(
            db=db,
            to_email=to_email,
            subject=subject,
            body=body,
            html_body=html_body
        )
