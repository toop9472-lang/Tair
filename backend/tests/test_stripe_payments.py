"""
Stripe Payment Integration Tests
Tests for payment packages, checkout sessions, and payment status
"""
import pytest
import requests
import os
import uuid

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', '').rstrip('/')


class TestPaymentPackages:
    """Payment packages API tests"""
    
    def test_get_packages(self):
        """Test getting available pricing packages"""
        response = requests.get(f"{BASE_URL}/api/payments/packages")
        print(f"Packages response: {response.status_code} - {response.text[:300]}")
        assert response.status_code == 200
        
        data = response.json()
        assert "packages" in data
        packages = data["packages"]
        
        # Verify all 4 packages exist
        assert len(packages) == 4
        
        # Verify package structure
        for pkg in packages:
            assert "id" in pkg
            assert "amount" in pkg
            assert "currency" in pkg
            assert "duration_months" in pkg
            assert "description" in pkg
        
        # Verify specific packages
        pkg_ids = [p["id"] for p in packages]
        assert "ad_1_month" in pkg_ids
        assert "ad_3_months" in pkg_ids
        assert "ad_6_months" in pkg_ids
        assert "ad_12_months" in pkg_ids
        
        # Verify pricing
        pkg_map = {p["id"]: p for p in packages}
        assert pkg_map["ad_1_month"]["amount"] == 500.0
        assert pkg_map["ad_3_months"]["amount"] == 1350.0
        assert pkg_map["ad_6_months"]["amount"] == 2400.0
        assert pkg_map["ad_12_months"]["amount"] == 4200.0
        
        print(f"✅ All 4 packages verified with correct pricing")


class TestStripeCheckout:
    """Stripe checkout session tests"""
    
    def create_test_ad(self):
        """Helper to create a test ad"""
        ad_data = {
            "advertiser_name": f"TEST_Stripe_{uuid.uuid4().hex[:8]}",
            "advertiser_email": f"stripe_test_{uuid.uuid4().hex[:8]}@test.com",
            "advertiser_phone": "0512345678",
            "title": "إعلان اختبار Stripe",
            "description": "وصف الإعلان للاختبار",
            "video_url": "https://example.com/video.mp4",
            "thumbnail_url": "https://example.com/thumb.jpg",
            "duration": 60,
            "duration_months": 1
        }
        
        response = requests.post(f"{BASE_URL}/api/advertiser/ads", json=ad_data)
        if response.status_code == 200:
            return response.json()["ad"]["id"]
        return None
    
    def test_create_checkout_session_1_month(self):
        """Test creating checkout session for 1 month package"""
        ad_id = self.create_test_ad()
        if not ad_id:
            pytest.skip("Could not create test ad")
        
        checkout_data = {
            "package_id": "ad_1_month",
            "ad_id": ad_id,
            "origin_url": "https://quality-restore-1.preview.emergentagent.com",
            "advertiser_email": "test@example.com"
        }
        
        response = requests.post(f"{BASE_URL}/api/payments/checkout", json=checkout_data)
        print(f"Checkout response: {response.status_code} - {response.text[:300]}")
        assert response.status_code == 200
        
        data = response.json()
        assert "checkout_url" in data
        assert "session_id" in data
        assert data["checkout_url"].startswith("https://checkout.stripe.com")
        assert data["session_id"].startswith("cs_test_")
        
        print(f"✅ Checkout session created: {data['session_id']}")
    
    def test_create_checkout_session_3_months(self):
        """Test creating checkout session for 3 months package"""
        ad_id = self.create_test_ad()
        if not ad_id:
            pytest.skip("Could not create test ad")
        
        checkout_data = {
            "package_id": "ad_3_months",
            "ad_id": ad_id,
            "origin_url": "https://quality-restore-1.preview.emergentagent.com"
        }
        
        response = requests.post(f"{BASE_URL}/api/payments/checkout", json=checkout_data)
        assert response.status_code == 200
        
        data = response.json()
        assert "checkout_url" in data
        assert "session_id" in data
        
        print(f"✅ 3-month checkout session created")
    
    def test_create_checkout_invalid_package(self):
        """Test checkout with invalid package ID fails"""
        ad_id = self.create_test_ad()
        if not ad_id:
            pytest.skip("Could not create test ad")
        
        checkout_data = {
            "package_id": "invalid_package",
            "ad_id": ad_id,
            "origin_url": "https://quality-restore-1.preview.emergentagent.com"
        }
        
        response = requests.post(f"{BASE_URL}/api/payments/checkout", json=checkout_data)
        assert response.status_code == 400
        
        print(f"✅ Invalid package rejected correctly")
    
    def test_create_checkout_invalid_ad(self):
        """Test checkout with invalid ad ID fails"""
        checkout_data = {
            "package_id": "ad_1_month",
            "ad_id": "nonexistent-ad-id",
            "origin_url": "https://quality-restore-1.preview.emergentagent.com"
        }
        
        response = requests.post(f"{BASE_URL}/api/payments/checkout", json=checkout_data)
        assert response.status_code == 404
        
        print(f"✅ Invalid ad ID rejected correctly")


class TestPaymentStatus:
    """Payment status API tests"""
    
    def test_payment_status_invalid_session(self):
        """Test getting status for invalid session returns 404"""
        response = requests.get(f"{BASE_URL}/api/payments/status/invalid_session_id")
        assert response.status_code == 404
        
        print(f"✅ Invalid session status returns 404")
    
    def test_payment_status_valid_session(self):
        """Test getting status for a valid session"""
        # First create an ad and checkout session
        ad_data = {
            "advertiser_name": f"TEST_Status_{uuid.uuid4().hex[:8]}",
            "advertiser_email": f"status_test_{uuid.uuid4().hex[:8]}@test.com",
            "advertiser_phone": "0512345678",
            "title": "إعلان اختبار الحالة",
            "description": "وصف الإعلان للاختبار",
            "video_url": "https://example.com/video.mp4",
            "duration": 60,
            "duration_months": 1
        }
        
        ad_response = requests.post(f"{BASE_URL}/api/advertiser/ads", json=ad_data)
        if ad_response.status_code != 200:
            pytest.skip("Could not create test ad")
        
        ad_id = ad_response.json()["ad"]["id"]
        
        # Create checkout session
        checkout_data = {
            "package_id": "ad_1_month",
            "ad_id": ad_id,
            "origin_url": "https://quality-restore-1.preview.emergentagent.com"
        }
        
        checkout_response = requests.post(f"{BASE_URL}/api/payments/checkout", json=checkout_data)
        if checkout_response.status_code != 200:
            pytest.skip("Could not create checkout session")
        
        session_id = checkout_response.json()["session_id"]
        
        # Check status
        status_response = requests.get(f"{BASE_URL}/api/payments/status/{session_id}")
        print(f"Status response: {status_response.status_code} - {status_response.text[:300]}")
        assert status_response.status_code == 200
        
        data = status_response.json()
        assert "session_id" in data
        assert "payment_status" in data
        assert "ad_id" in data
        
        print(f"✅ Payment status retrieved: {data['payment_status']}")


class TestAdvertiserAdCreation:
    """Advertiser ad creation tests"""
    
    def test_create_ad_returns_payment_info(self):
        """Test that creating an ad returns payment information"""
        ad_data = {
            "advertiser_name": f"TEST_Payment_{uuid.uuid4().hex[:8]}",
            "advertiser_email": f"payment_test_{uuid.uuid4().hex[:8]}@test.com",
            "advertiser_phone": "0512345678",
            "title": "إعلان اختبار الدفع",
            "description": "وصف الإعلان للاختبار",
            "video_url": "https://example.com/video.mp4",
            "thumbnail_url": "https://example.com/thumb.jpg",
            "duration": 60,
            "duration_months": 1
        }
        
        response = requests.post(f"{BASE_URL}/api/advertiser/ads", json=ad_data)
        print(f"Create ad response: {response.status_code} - {response.text[:300]}")
        assert response.status_code == 200
        
        data = response.json()
        assert data.get("success") == True
        assert "ad" in data
        assert "payment" in data
        
        # Verify ad structure
        ad = data["ad"]
        assert "id" in ad
        assert ad["status"] == "pending"
        assert ad["payment_status"] == "pending"
        
        # Verify payment structure
        payment = data["payment"]
        assert "amount" in payment
        assert "currency" in payment
        assert payment["amount"] == 500.0  # 1 month = 500 SAR
        assert payment["currency"] == "SAR"
        
        print(f"✅ Ad created with payment info: {payment['amount']} {payment['currency']}")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
