"""
Data Encryption Utilities - تشفير البيانات الحساسة
"""
import os
import base64
import hashlib
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from typing import Optional

# مفتاح التشفير من متغيرات البيئة أو إنشاء واحد جديد
ENCRYPTION_KEY = os.getenv('ENCRYPTION_KEY', None)

def _get_fernet_key() -> bytes:
    """
    الحصول على مفتاح Fernet من المفتاح السري
    """
    if ENCRYPTION_KEY:
        # تحويل المفتاح النصي إلى مفتاح Fernet
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=b'saqr_app_salt_2024',
            iterations=100000,
        )
        key = base64.urlsafe_b64encode(kdf.derive(ENCRYPTION_KEY.encode()))
        return key
    else:
        # إنشاء مفتاح عشوائي (يجب حفظه في الإنتاج)
        return Fernet.generate_key()

_fernet = None

def _get_fernet():
    global _fernet
    if _fernet is None:
        _fernet = Fernet(_get_fernet_key())
    return _fernet


def encrypt_sensitive_data(data: str) -> str:
    """
    تشفير البيانات الحساسة (مثل أرقام الحسابات البنكية)
    """
    if not data:
        return data
    try:
        f = _get_fernet()
        encrypted = f.encrypt(data.encode())
        return base64.urlsafe_b64encode(encrypted).decode()
    except Exception as e:
        print(f"Encryption error: {e}")
        return data


def decrypt_sensitive_data(encrypted_data: str) -> str:
    """
    فك تشفير البيانات
    """
    if not encrypted_data:
        return encrypted_data
    try:
        f = _get_fernet()
        decoded = base64.urlsafe_b64decode(encrypted_data.encode())
        decrypted = f.decrypt(decoded)
        return decrypted.decode()
    except Exception as e:
        # إذا فشل فك التشفير، البيانات قد تكون غير مشفرة
        return encrypted_data


def hash_sensitive_id(data: str) -> str:
    """
    تجزئة المعرفات الحساسة (للبحث فقط، لا يمكن استرجاعها)
    """
    if not data:
        return data
    return hashlib.sha256(f"saqr_{data}".encode()).hexdigest()


def mask_phone_number(phone: str) -> str:
    """
    إخفاء رقم الهاتف للعرض
    05xxxxxx89 -> 05******89
    """
    if not phone or len(phone) < 4:
        return phone
    return phone[:2] + '*' * (len(phone) - 4) + phone[-2:]


def mask_bank_account(account: str) -> str:
    """
    إخفاء رقم الحساب البنكي
    SA1234567890123456 -> SA**********3456
    """
    if not account or len(account) < 6:
        return account
    return account[:2] + '*' * (len(account) - 6) + account[-4:]


def mask_card_number(card: str) -> str:
    """
    إخفاء رقم البطاقة
    4111111111111111 -> ************1111
    """
    if not card or len(card) < 4:
        return card
    return '*' * (len(card) - 4) + card[-4:]


def is_encrypted(data: str) -> bool:
    """
    التحقق إذا كانت البيانات مشفرة
    """
    if not data:
        return False
    try:
        decoded = base64.urlsafe_b64decode(data.encode())
        return len(decoded) > 44  # حجم Fernet token الأدنى
    except Exception:
        return False
