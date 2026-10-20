"""
Test file for Advertiser and Payment APIs
Tests: packages, ad creation, payment flow
"""
import pytest
import requests
import os

BASE_URL = os.environ.get('REACT_APP_BACKEND_URL', 'https://quality-restore-1.preview.emergentagent.com')

class TestPackagesAPI:
    """Test pricing packages API"""
    
    def test_get_packages_returns_200(self):
        """GET /api/payments/packages should return 200"""
        response = requests.get(f"{BASE_URL}/api/payments/packages")
        assert response.status_code == 200
        print(f"✓ GET /api/payments/packages returned 200")
    
    def test_get_packages_returns_4_packages(self):
        """Packages API should return 4 packages"""
        response = requests.get(f"{BASE_URL}/api/payments/packages")
        data = response.json()
        
        assert "packages" in data
        assert len(data["packages"]) == 4
        print(f"✓ Packages API returned {len(data['packages'])} packages")
    
    def test_packages_have_correct_structure(self):
        """Each package should have id, amount, currency, duration_months, description"""
        response = requests.get(f"{BASE_URL}/api/payments/packages")
        data = response.json()
        
        required_fields = ["id", "amount", "currency", "duration_months", "description"]
        for pkg in data["packages"]:
            for field in required_fields:
                assert field in pkg, f"Package missing field: {field}"
        print(f"✓ All packages have correct structure")
    
    def test_packages_pricing_is_correct(self):
        """Verify package pricing: 1000, 2700, 4800, 8400 SAR"""
        response = requests.get(f"{BASE_URL}/api/payments/packages")
        data = response.json()
        
        expected_amounts = [1000.0, 2700.0, 4800.0, 8400.0]
        actual_amounts = [pkg["amount"] for pkg in data["packages"]]
        
        for expected in expected_amounts:
            assert expected in actual_amounts, f"Expected amount {expected} not found"
        print(f"✓ Package pricing is correct: {actual_amounts}")


class TestAdvertiserAdsAPI:
    """Test advertiser ad creation API"""
    
    def test_create_ad_returns_success(self):
        """POST /api/advertiser/ads should create ad successfully"""
        payload = {
            "advertiser_name": "TEST_CompanyName",
            "advertiser_email": "test@testcompany.com",
            "advertiser_phone": "0501234567",
            "title": "TEST_Ad_Title",
            "description": "Test ad description",
            "video_url": "https://example.com/video.mp4",
            "duration": 60,
            "duration_months": 1
        }
        
        response = requests.post(
            f"{BASE_URL}/api/advertiser/ads",
            json=payload,
            headers={"Content-Type": "application/json"}
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # Verify response structure
        assert "success" in data
        assert data["success"] == True
        assert "ad" in data
        assert "payment" in data
        
        # Verify ad data
        assert data["ad"]["title"] == "TEST_Ad_Title"
        assert data["ad"]["status"] == "pending"
        assert data["ad"]["payment_status"] == "pending"
        
        # Verify payment data
        assert data["payment"]["amount"] == 500.0  # 500 SAR for 1 month
        assert data["payment"]["status"] == "pending"
        
        print(f"✓ Ad created successfully with ID: {data['ad']['id']}")
        return data["ad"]["id"]
    
    def test_create_ad_with_3_months(self):
        """Creating ad with 3 months should cost 1500 SAR"""
        payload = {
            "advertiser_name": "TEST_ThreeMonthCompany",
            "advertiser_email": "test3months@test.com",
            "title": "TEST_3Month_Ad",
            "description": "3 month ad test",
            "video_url": "https://example.com/video3.mp4",
            "duration": 60,
            "duration_months": 3
        }
        
        response = requests.post(
            f"{BASE_URL}/api/advertiser/ads",
            json=payload
        )
        
        assert response.status_code == 200
        data = response.json()
        
        # 500 SAR * 3 months = 1500 SAR
        assert data["payment"]["amount"] == 1500.0
        print(f"✓ 3-month ad created with correct price: {data['payment']['amount']} SAR")
    
    def test_get_ad_by_id(self):
        """GET /api/advertiser/ads/{id} should return ad details"""
        # First create an ad
        payload = {
            "advertiser_name": "TEST_GetAdCompany",
            "advertiser_email": "testgetad@test.com",
            "title": "TEST_GetAd_Title",
            "description": "Test get ad",
            "video_url": "https://example.com/getvideo.mp4",
            "duration": 60,
            "duration_months": 1
        }
        
        create_response = requests.post(f"{BASE_URL}/api/advertiser/ads", json=payload)
        ad_id = create_response.json()["ad"]["id"]
        
        # Now get the ad
        get_response = requests.get(f"{BASE_URL}/api/advertiser/ads/{ad_id}")
        
        assert get_response.status_code == 200
        data = get_response.json()
        
        assert "ad" in data
        assert data["ad"]["id"] == ad_id
        assert data["ad"]["title"] == "TEST_GetAd_Title"
        print(f"✓ GET ad by ID successful: {ad_id}")


class TestPaymentGatewaysAPI:
    """Test payment gateways settings API"""
    
    def test_get_payment_gateways(self):
        """GET /api/settings/public/payment-gateways should return gateway settings"""
        response = requests.get(f"{BASE_URL}/api/settings/public/payment-gateways")
        
        assert response.status_code == 200
        data = response.json()
        
        # Should have stripe, tap, etc.
        assert "stripe" in data
        assert "tap" in data
        
        print(f"✓ Payment gateways: stripe={data.get('stripe')}, tap={data.get('tap')}")


class TestAdvertiserPricingAPI:
    """Test advertiser pricing info API"""
    
    def test_get_pricing(self):
        """GET /api/advertiser/pricing should return pricing info"""
        response = requests.get(f"{BASE_URL}/api/advertiser/pricing")
        
        assert response.status_code == 200
        data = response.json()
        
        assert "price_per_month" in data
        assert data["price_per_month"] == 500.0
        assert data["currency"] == "SAR"
        assert "payment_methods" in data
        
        print(f"✓ Pricing API: {data['price_per_month']} {data['currency']}/month")


class TestPaymentCheckoutAPI:
    """Test payment checkout flow"""
    
    def test_checkout_requires_valid_package(self):
        """POST /api/payments/checkout with invalid package should fail"""
        # First create an ad
        ad_payload = {
            "advertiser_name": "TEST_CheckoutCompany",
            "advertiser_email": "checkout@test.com",
            "title": "TEST_Checkout_Ad",
            "description": "Test checkout",
            "video_url": "https://example.com/checkout.mp4",
            "duration": 60,
            "duration_months": 1
        }
        
        create_response = requests.post(f"{BASE_URL}/api/advertiser/ads", json=ad_payload)
        ad_id = create_response.json()["ad"]["id"]
        
        # Try checkout with invalid package
        checkout_payload = {
            "package_id": "invalid_package",
            "ad_id": ad_id,
            "origin_url": BASE_URL,
            "advertiser_email": "checkout@test.com"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/payments/checkout",
            json=checkout_payload
        )
        
        # Should return 400 for invalid package
        assert response.status_code == 400
        print(f"✓ Invalid package correctly rejected with 400")
    
    def test_checkout_requires_valid_ad(self):
        """POST /api/payments/checkout with invalid ad_id should fail"""
        checkout_payload = {
            "package_id": "ad_1_month",
            "ad_id": "nonexistent_ad_id",
            "origin_url": BASE_URL,
            "advertiser_email": "test@test.com"
        }
        
        response = requests.post(
            f"{BASE_URL}/api/payments/checkout",
            json=checkout_payload
        )
        
        # Should return 404 for ad not found
        assert response.status_code == 404
        print(f"✓ Invalid ad_id correctly rejected with 404")


class TestHealthAndBasics:
    """Basic health check tests"""
    
    def test_health_check(self):
        """GET /api/health should return 200"""
        response = requests.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        print(f"✓ Health check passed")
    
    def test_get_ads(self):
        """GET /api/ads should return ads list"""
        response = requests.get(f"{BASE_URL}/api/ads")
        assert response.status_code == 200
        data = response.json()
        
        # Should return a list
        assert isinstance(data, list)
        print(f"✓ GET /api/ads returned {len(data)} ads")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
