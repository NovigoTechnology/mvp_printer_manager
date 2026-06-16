"""Helpers for encrypting application secrets stored in the database."""

import base64
import hashlib
from typing import Optional

from cryptography.fernet import Fernet, InvalidToken

from app.config import settings


def _get_fernet() -> Fernet:
    key = base64.urlsafe_b64encode(hashlib.sha256(settings.jwt_secret.encode("utf-8")).digest())
    return Fernet(key)


def encrypt_secret(value: Optional[str]) -> Optional[str]:
    if not value:
        return value
    return _get_fernet().encrypt(value.encode("utf-8")).decode("utf-8")


def decrypt_secret(value: Optional[str]) -> Optional[str]:
    if not value:
        return value
    try:
        return _get_fernet().decrypt(value.encode("utf-8")).decode("utf-8")
    except InvalidToken:
        return value
