"""
Script to create the first admin user
Run: python create_admin.py
"""
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient
from passlib.hash import bcrypt
from models.admin import Admin
import os
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

async def create_first_admin():
    """Create first admin user"""
    mongo_url = os.environ['MONGO_URL']
    client = AsyncIOMotorClient(mongo_url)
    db = client[os.environ['DB_NAME']]
    
    # Check if any admin exists
    existing_admin = await db.admins.find_one({})
    if existing_admin:
        print("⚠️  Admin already exists!")
        print(f"Email: {existing_admin['email']}")
        return
    
    # Create admin
    print("📝 Creating first admin...")
    email = input("Enter admin email: ")
    password = input("Enter admin password: ")
    name = input("Enter admin name: ")
    
    password_hash = bcrypt.hash(password)
    
    admin = Admin(
        email=email,
        password_hash=password_hash,
        name=name,
        role='super_admin'
    )
    
    await db.admins.insert_one(admin.dict())
    
    print("\n✅ Admin created successfully!")
    print(f"Email: {email}")
    print(f"Name: {name}")
    print(f"Role: super_admin")
    print("\n🔐 You can now login to the admin dashboard")
    
    client.close()

if __name__ == '__main__':
    asyncio.run(create_first_admin())
