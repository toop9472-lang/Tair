"""
Payout Service - Process actual payouts via PayPal
"""
import os
import httpx
from datetime import datetime
from typing import Optional, Dict, Any
import base64


class PayPalPayoutService:
    """PayPal Payout Service for processing withdrawals"""
    
    def __init__(self):
        self.client_id = None
        self.client_secret = None
        self.base_url = "https://api-m.sandbox.paypal.com"  # Use sandbox for testing
        self.access_token = None
        self.token_expires_at = None
    
    async def initialize(self, client_id: str, client_secret: str, sandbox: bool = True):
        """Initialize PayPal with credentials"""
        self.client_id = client_id
        self.client_secret = client_secret
        self.base_url = "https://api-m.sandbox.paypal.com" if sandbox else "https://api-m.paypal.com"
    
    async def get_access_token(self) -> str:
        """Get PayPal access token"""
        if self.access_token and self.token_expires_at and datetime.utcnow() < self.token_expires_at:
            return self.access_token
        
        credentials = f"{self.client_id}:{self.client_secret}"
        encoded_credentials = base64.b64encode(credentials.encode()).decode()
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/v1/oauth2/token",
                headers={
                    "Authorization": f"Basic {encoded_credentials}",
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                data="grant_type=client_credentials"
            )
            
            if response.status_code == 200:
                data = response.json()
                self.access_token = data["access_token"]
                # Token expires in seconds, subtract 60 for safety
                from datetime import timedelta
                self.token_expires_at = datetime.utcnow() + timedelta(seconds=data.get("expires_in", 3600) - 60)
                return self.access_token
            else:
                raise Exception(f"Failed to get PayPal access token: {response.text}")
    
    async def send_payout(
        self,
        recipient_email: str,
        amount: float,
        currency: str = "USD",
        note: str = "صقر - سحب الأرباح",
        sender_batch_id: str = None
    ) -> Dict[str, Any]:
        """
        Send payout to a PayPal account
        
        Returns:
            dict with payout_batch_id, batch_status, and details
        """
        access_token = await self.get_access_token()
        
        if not sender_batch_id:
            sender_batch_id = f"SAQR_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
        
        payload = {
            "sender_batch_header": {
                "sender_batch_id": sender_batch_id,
                "email_subject": "لقد استلمت أرباحك من صقر!",
                "email_message": "شكراً لاستخدامك صقر. تم إرسال أرباحك بنجاح."
            },
            "items": [
                {
                    "recipient_type": "EMAIL",
                    "amount": {
                        "value": f"{amount:.2f}",
                        "currency": currency
                    },
                    "note": note,
                    "sender_item_id": f"{sender_batch_id}_1",
                    "receiver": recipient_email
                }
            ]
        }
        
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/v1/payments/payouts",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type": "application/json"
                },
                json=payload
            )
            
            if response.status_code in [200, 201]:
                data = response.json()
                return {
                    "success": True,
                    "payout_batch_id": data.get("batch_header", {}).get("payout_batch_id"),
                    "batch_status": data.get("batch_header", {}).get("batch_status"),
                    "sender_batch_id": sender_batch_id,
                    "raw_response": data
                }
            else:
                return {
                    "success": False,
                    "error": response.text,
                    "status_code": response.status_code
                }
    
    async def get_payout_status(self, payout_batch_id: str) -> Dict[str, Any]:
        """Get payout status"""
        access_token = await self.get_access_token()
        
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/v1/payments/payouts/{payout_batch_id}",
                headers={
                    "Authorization": f"Bearer {access_token}",
                    "Content-Type": "application/json"
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                return {
                    "success": True,
                    "batch_status": data.get("batch_header", {}).get("batch_status"),
                    "items": data.get("items", []),
                    "raw_response": data
                }
            else:
                return {
                    "success": False,
                    "error": response.text
                }


class STCPayService:
    """
    STC Pay Service - Placeholder for STC Pay integration
    Note: STC Pay requires merchant registration and API access
    """
    
    def __init__(self):
        self.api_key = None
        self.merchant_id = None
    
    async def initialize(self, api_key: str, merchant_id: str):
        """Initialize STC Pay credentials"""
        self.api_key = api_key
        self.merchant_id = merchant_id
    
    async def send_payout(
        self,
        phone_number: str,
        amount: float,
        reference: str = None
    ) -> Dict[str, Any]:
        """
        Send payout to STC Pay wallet
        
        Note: This is a placeholder. Actual implementation requires
        STC Pay merchant API access.
        """
        if not self.api_key:
            return {
                "success": False,
                "error": "STC Pay غير مفعل. يرجى إدخال مفتاح API من لوحة الإدارة.",
                "requires_manual": True
            }
        
        # TODO: Implement actual STC Pay API call when credentials available
        # For now, return that manual processing is required
        return {
            "success": False,
            "requires_manual": True,
            "message": "STC Pay يتطلب معالجة يدوية حالياً",
            "details": {
                "phone_number": phone_number,
                "amount": amount,
                "reference": reference
            }
        }


class BankTransferService:
    """
    Bank Transfer Service - Generates transfer instructions
    Note: Actual bank transfers require banking APIs or manual processing
    """
    
    async def generate_transfer_instructions(
        self,
        bank_name: str,
        account_holder: str,
        iban: str,
        amount: float,
        currency: str = "SAR"
    ) -> Dict[str, Any]:
        """
        Generate bank transfer instructions for manual processing
        
        Returns instruction sheet for admin to process manually
        """
        return {
            "requires_manual": True,
            "instructions": {
                "bank_name": bank_name,
                "account_holder": account_holder,
                "iban": iban,
                "amount": f"{amount:.2f} {currency}",
                "reference": f"SAQR-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
            },
            "message": "التحويل البنكي يتطلب معالجة يدوية من المدير"
        }


# Singleton instances
paypal_service = PayPalPayoutService()
stcpay_service = STCPayService()
bank_service = BankTransferService()


async def process_withdrawal_payout(
    withdrawal: dict,
    db_settings: dict = None
) -> Dict[str, Any]:
    """
    Process withdrawal payout based on method
    
    Args:
        withdrawal: Withdrawal document from database
        db_settings: Payment gateway settings from database
    
    Returns:
        Result dict with success status and details
    """
    method = withdrawal.get("method", "").lower()
    
    if method == "paypal":
        # Get PayPal credentials from settings
        paypal_client_id = db_settings.get("paypal_client_id") if db_settings else os.environ.get("PAYPAL_CLIENT_ID")
        paypal_secret = db_settings.get("paypal_secret") if db_settings else os.environ.get("PAYPAL_SECRET")
        
        if not paypal_client_id or not paypal_secret:
            return {
                "success": False,
                "error": "PayPal غير مفعل. يرجى إدخال بيانات PayPal من لوحة الإدارة.",
                "requires_manual": True
            }
        
        await paypal_service.initialize(paypal_client_id, paypal_secret, sandbox=True)
        
        recipient_email = withdrawal.get("paypal_email") or withdrawal.get("details", {}).get("email")
        amount = withdrawal.get("amount", 0)
        
        if not recipient_email:
            return {
                "success": False,
                "error": "بريد PayPal غير موجود في طلب السحب"
            }
        
        result = await paypal_service.send_payout(
            recipient_email=recipient_email,
            amount=amount,
            currency="USD",
            sender_batch_id=f"SAQR_{withdrawal.get('id', '')}"
        )
        
        return result
    
    elif method == "stcpay":
        phone_number = withdrawal.get("phone_number") or withdrawal.get("details", {}).get("phone")
        amount = withdrawal.get("amount", 0)
        
        result = await stcpay_service.send_payout(
            phone_number=phone_number,
            amount=amount,
            reference=withdrawal.get("id")
        )
        return result
    
    elif method == "bank":
        result = await bank_service.generate_transfer_instructions(
            bank_name=withdrawal.get("bank_name") or withdrawal.get("details", {}).get("bank_name", ""),
            account_holder=withdrawal.get("account_holder") or withdrawal.get("details", {}).get("account_holder", ""),
            iban=withdrawal.get("iban") or withdrawal.get("details", {}).get("iban", ""),
            amount=withdrawal.get("amount", 0),
            currency=withdrawal.get("currency", "SAR")
        )
        return result
    
    else:
        return {
            "success": False,
            "error": f"طريقة السحب غير معروفة: {method}",
            "requires_manual": True
        }
