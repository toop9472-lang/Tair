from fastapi import APIRouter, HTTPException, status, Depends
from motor.motor_asyncio import AsyncIOMotorClient
from models.admin import Admin, AdminLogin, AdminCreate
from auth.jwt_handler import create_access_token
from passlib.hash import bcrypt
from datetime import datetime
import os

router = APIRouter(prefix='/admin/auth', tags=['Admin Authentication'])

def get_db():
    mongo_url = os.environ['MONGO_URL']
    client = AsyncIOMotorClient(mongo_url)
    return client[os.environ['DB_NAME']]

@router.post('/login', response_model=dict)
async def admin_login(credentials: AdminLogin):
    """
    Admin login
    """
    db = get_db()
    
    # Find admin by email
    admin = await db.admins.find_one({'email': credentials.email}, {'_id': 0})
    
    if not admin:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail='بيانات الدخول غير صحيحة'
        )
    
    # Verify password
    if not bcrypt.verify(credentials.password, admin['password_hash']):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail='بيانات الدخول غير صحيحة'
        )
    
    # Get admin ID (use email as fallback)
    admin_id = admin.get('id', admin['email'])
    
    # Update last login
    await db.admins.update_one(
        {'email': credentials.email},
        {'$set': {'last_login': datetime.utcnow()}}
    )
    
    # Create token
    token = create_access_token(admin_id)
    
    return {
        'token': token,
        'admin': {
            'id': admin_id,
            'email': admin['email'],
            'name': admin.get('name', 'Admin'),
            'role': admin.get('role', 'admin')
        }
    }

@router.post('/create', response_model=dict)
async def create_admin(admin_data: AdminCreate):
    """
    Create new admin (only for initial setup)
    """
    db = get_db()
    
    # Check if admin exists
    existing = await db.admins.find_one({'email': admin_data.email})
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail='Admin already exists'
        )
    
    # Hash password
    password_hash = bcrypt.hash(admin_data.password)
    
    # Create admin
    admin = Admin(
        email=admin_data.email,
        password_hash=password_hash,
        name=admin_data.name,
        role=admin_data.role
    )
    
    await db.admins.insert_one(admin.dict())
    
    return {
        'success': True,
        'message': 'Admin created successfully',
        'admin': {
            'id': admin.id,
            'email': admin.email,
            'name': admin.name
        }
    }