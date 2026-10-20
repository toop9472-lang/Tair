"""
Password Security Utilities - أدوات أمان كلمة المرور
"""
import re
from typing import Tuple, List

def validate_password_strength(password: str) -> Tuple[bool, List[str]]:
    """
    التحقق من قوة كلمة المرور
    Returns: (is_valid, list_of_errors)
    """
    errors = []
    
    # الحد الأدنى 8 أحرف
    if len(password) < 8:
        errors.append('كلمة المرور يجب أن تكون 8 أحرف على الأقل')
    
    # الحد الأقصى 128 حرف
    if len(password) > 128:
        errors.append('كلمة المرور طويلة جداً')
    
    # يجب أن تحتوي على حرف كبير
    if not re.search(r'[A-Z]', password):
        errors.append('يجب أن تحتوي على حرف كبير واحد على الأقل')
    
    # يجب أن تحتوي على حرف صغير
    if not re.search(r'[a-z]', password):
        errors.append('يجب أن تحتوي على حرف صغير واحد على الأقل')
    
    # يجب أن تحتوي على رقم
    if not re.search(r'\d', password):
        errors.append('يجب أن تحتوي على رقم واحد على الأقل')
    
    # يجب أن تحتوي على رمز خاص (اختياري لتسهيل الاستخدام)
    # if not re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
    #     errors.append('يجب أن تحتوي على رمز خاص واحد على الأقل')
    
    # التحقق من كلمات المرور الشائعة
    common_passwords = [
        '12345678', '123456789', 'password', 'qwerty123', 
        'abc12345', 'password1', '11111111', '12341234'
    ]
    if password.lower() in common_passwords:
        errors.append('كلمة المرور ضعيفة جداً، اختر كلمة أخرى')
    
    return len(errors) == 0, errors


def get_password_strength_score(password: str) -> int:
    """
    حساب نقاط قوة كلمة المرور (0-100)
    """
    score = 0
    
    # الطول
    if len(password) >= 8:
        score += 20
    if len(password) >= 12:
        score += 10
    if len(password) >= 16:
        score += 10
    
    # التنوع
    if re.search(r'[a-z]', password):
        score += 15
    if re.search(r'[A-Z]', password):
        score += 15
    if re.search(r'\d', password):
        score += 15
    if re.search(r'[!@#$%^&*(),.?":{}|<>]', password):
        score += 15
    
    return min(score, 100)


def mask_email(email: str) -> str:
    """
    إخفاء جزء من البريد الإلكتروني للعرض الآمن
    example@domain.com -> e*****e@d***n.com
    """
    if '@' not in email:
        return email
    
    local, domain = email.split('@')
    
    # إخفاء الجزء المحلي
    if len(local) <= 2:
        masked_local = local[0] + '*'
    else:
        masked_local = local[0] + '*' * (len(local) - 2) + local[-1]
    
    # إخفاء الدومين
    domain_parts = domain.split('.')
    if len(domain_parts) >= 2:
        domain_name = domain_parts[0]
        if len(domain_name) <= 2:
            masked_domain = domain_name[0] + '*'
        else:
            masked_domain = domain_name[0] + '*' * (len(domain_name) - 2) + domain_name[-1]
        domain_parts[0] = masked_domain
        masked_domain_full = '.'.join(domain_parts)
    else:
        masked_domain_full = domain
    
    return f"{masked_local}@{masked_domain_full}"
