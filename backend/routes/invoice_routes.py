"""
Invoice Routes - Auto-generated invoices for advertisers
"""
from fastapi import APIRouter, HTTPException, status, Depends
from motor.motor_asyncio import AsyncIOMotorClient
from models.invoice import Invoice, InvoiceCreate, InvoiceItem, InvoiceStatus
from auth.dependencies import get_current_user_id
from datetime import datetime, timedelta
from typing import Optional
import os

router = APIRouter(prefix='/invoices', tags=['Invoices'])


def get_db():
    mongo_url = os.environ['MONGO_URL']
    client = AsyncIOMotorClient(mongo_url)
    return client[os.environ['DB_NAME']]


async def generate_invoice_number(db) -> str:
    """Generate unique invoice number like INV-2025-0001"""
    year = datetime.utcnow().year
    
    # Get count of invoices this year
    count = await db.invoices.count_documents({
        'invoice_number': {'$regex': f'^INV-{year}-'}
    })
    
    return f"INV-{year}-{str(count + 1).zfill(4)}"


@router.post('/create', response_model=dict)
async def create_invoice(data: InvoiceCreate):
    """
    Create a new invoice for an ad purchase
    Called automatically when advertiser submits an ad
    """
    db = get_db()
    
    # Generate invoice number
    invoice_number = await generate_invoice_number(db)
    
    # Calculate amounts
    subtotal = data.package_price
    tax_rate = 0.15  # 15% VAT
    tax_amount = round(subtotal * tax_rate, 2)
    total = round(subtotal + tax_amount, 2)
    
    # Create invoice items
    items = [
        InvoiceItem(
            description=f"باقة إعلانية: {data.package_name} - {data.duration_months} شهر",
            quantity=1,
            unit_price=subtotal,
            total=subtotal
        ).dict()
    ]
    
    # Create invoice
    invoice = Invoice(
        invoice_number=invoice_number,
        advertiser_email=data.advertiser_email,
        advertiser_name=data.advertiser_name,
        advertiser_phone=data.advertiser_phone,
        advertiser_company=data.advertiser_company,
        ad_id=data.ad_id,
        ad_title=data.ad_title,
        items=items,
        subtotal=subtotal,
        tax_rate=tax_rate,
        tax_amount=tax_amount,
        total=total,
        due_date=datetime.utcnow() + timedelta(days=7)
    )
    
    await db.invoices.insert_one(invoice.dict())
    
    return {
        'success': True,
        'invoice_id': invoice.id,
        'invoice_number': invoice_number,
        'total': total
    }


@router.get('/{invoice_id}', response_model=dict)
async def get_invoice(invoice_id: str):
    """
    Get invoice details by ID
    """
    db = get_db()
    
    invoice = await db.invoices.find_one({'id': invoice_id}, {'_id': 0})
    
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail='فاتورة غير موجودة'
        )
    
    return {'invoice': invoice}


@router.get('/by-number/{invoice_number}', response_model=dict)
async def get_invoice_by_number(invoice_number: str):
    """
    Get invoice details by invoice number
    """
    db = get_db()
    
    invoice = await db.invoices.find_one({'invoice_number': invoice_number}, {'_id': 0})
    
    if not invoice:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail='فاتورة غير موجودة'
        )
    
    return {'invoice': invoice}


@router.get('/advertiser/{email}', response_model=dict)
async def get_advertiser_invoices(email: str, limit: int = 50):
    """
    Get all invoices for an advertiser
    """
    db = get_db()
    
    invoices = await db.invoices.find(
        {'advertiser_email': email},
        {'_id': 0}
    ).sort('created_at', -1).limit(limit).to_list(limit)
    
    return {'invoices': invoices}


@router.put('/{invoice_id}/mark-paid', response_model=dict)
async def mark_invoice_paid(
    invoice_id: str,
    payment_method: str,
    payment_id: str
):
    """
    Mark invoice as paid after successful payment
    """
    db = get_db()
    
    result = await db.invoices.update_one(
        {'id': invoice_id},
        {'$set': {
            'status': InvoiceStatus.PAID.value,
            'payment_method': payment_method,
            'payment_id': payment_id,
            'paid_at': datetime.utcnow()
        }}
    )
    
    if result.modified_count == 0:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail='فاتورة غير موجودة'
        )
    
    return {'success': True, 'message': 'تم تأكيد الدفع'}


@router.get('/admin/all', response_model=dict)
async def get_all_invoices(
    status: Optional[str] = None,
    limit: int = 100
):
    """
    Admin: Get all invoices with optional status filter
    """
    db = get_db()
    
    query = {}
    if status:
        query['status'] = status
    
    invoices = await db.invoices.find(
        query,
        {'_id': 0}
    ).sort('created_at', -1).limit(limit).to_list(limit)
    
    # Calculate totals
    total_revenue = sum(
        inv['total'] for inv in invoices 
        if inv['status'] == InvoiceStatus.PAID.value
    )
    
    pending_amount = sum(
        inv['total'] for inv in invoices 
        if inv['status'] == InvoiceStatus.PENDING.value
    )
    
    return {
        'invoices': invoices,
        'total_revenue': total_revenue,
        'pending_amount': pending_amount,
        'total_count': len(invoices)
    }
