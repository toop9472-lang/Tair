"""
Firebase Cloud Messaging Service for Push Notifications
Supports both Expo Push and Firebase Cloud Messaging
"""
import os
import json
import httpx
from datetime import datetime
from typing import List, Dict, Any, Optional


class FCMService:
    """Firebase Cloud Messaging Service"""
    
    def __init__(self):
        self.project_id = None
        self.private_key = None
        self.client_email = None
        self.access_token = None
        self.token_expires_at = None
    
    async def initialize_from_settings(self, settings: Dict[str, Any] = None):
        """Initialize FCM from database settings or environment"""
        if settings:
            self.project_id = settings.get('firebase_project_id')
            self.private_key = settings.get('firebase_private_key')
            self.client_email = settings.get('firebase_client_email')
        else:
            # Try environment variables
            self.project_id = os.environ.get('FIREBASE_PROJECT_ID')
            self.private_key = os.environ.get('FIREBASE_PRIVATE_KEY')
            self.client_email = os.environ.get('FIREBASE_CLIENT_EMAIL')
    
    def is_configured(self) -> bool:
        """Check if FCM is properly configured"""
        return bool(self.project_id and self.private_key and self.client_email)
    
    async def get_access_token(self) -> Optional[str]:
        """Get OAuth2 access token for FCM API"""
        if not self.is_configured():
            return None
        
        # Check if we have a valid cached token
        if self.access_token and self.token_expires_at:
            if datetime.utcnow() < self.token_expires_at:
                return self.access_token
        
        try:
            import jwt
            from datetime import timedelta
            
            now = datetime.utcnow()
            
            # Create JWT for service account
            payload = {
                'iss': self.client_email,
                'scope': 'https://www.googleapis.com/auth/firebase.messaging',
                'aud': 'https://oauth2.googleapis.com/token',
                'iat': int(now.timestamp()),
                'exp': int((now + timedelta(hours=1)).timestamp())
            }
            
            # Handle escaped newlines in private key
            private_key = self.private_key.replace('\\n', '\n')
            
            token = jwt.encode(payload, private_key, algorithm='RS256')
            
            # Exchange JWT for access token
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    'https://oauth2.googleapis.com/token',
                    data={
                        'grant_type': 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                        'assertion': token
                    }
                )
                
                if response.status_code == 200:
                    data = response.json()
                    self.access_token = data['access_token']
                    self.token_expires_at = now + timedelta(seconds=data.get('expires_in', 3600) - 60)
                    return self.access_token
                else:
                    print(f"FCM token error: {response.text}")
                    return None
                    
        except Exception as e:
            print(f"FCM token generation error: {e}")
            return None
    
    async def send_notification(
        self,
        token: str,
        title: str,
        body: str,
        data: Dict[str, str] = None,
        image_url: str = None
    ) -> Dict[str, Any]:
        """
        Send push notification to a single device
        
        Args:
            token: FCM device token
            title: Notification title
            body: Notification body
            data: Additional data payload
            image_url: Optional image URL
        
        Returns:
            Response dict with success status
        """
        if not self.is_configured():
            return {'success': False, 'error': 'FCM not configured'}
        
        access_token = await self.get_access_token()
        if not access_token:
            return {'success': False, 'error': 'Could not get access token'}
        
        message = {
            'message': {
                'token': token,
                'notification': {
                    'title': title,
                    'body': body
                },
                'android': {
                    'notification': {
                        'sound': 'default',
                        'click_action': 'FLUTTER_NOTIFICATION_CLICK'
                    }
                },
                'apns': {
                    'payload': {
                        'aps': {
                            'sound': 'default',
                            'badge': 1
                        }
                    }
                }
            }
        }
        
        if data:
            message['message']['data'] = {k: str(v) for k, v in data.items()}
        
        if image_url:
            message['message']['notification']['image'] = image_url
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    f'https://fcm.googleapis.com/v1/projects/{self.project_id}/messages:send',
                    headers={
                        'Authorization': f'Bearer {access_token}',
                        'Content-Type': 'application/json'
                    },
                    json=message
                )
                
                if response.status_code == 200:
                    return {'success': True, 'response': response.json()}
                else:
                    return {'success': False, 'error': response.text}
                    
        except Exception as e:
            return {'success': False, 'error': str(e)}
    
    async def send_multicast(
        self,
        tokens: List[str],
        title: str,
        body: str,
        data: Dict[str, str] = None
    ) -> Dict[str, Any]:
        """
        Send notification to multiple devices
        
        Args:
            tokens: List of FCM device tokens
            title: Notification title
            body: Notification body
            data: Additional data payload
        
        Returns:
            Response dict with success count
        """
        if not tokens:
            return {'success': True, 'sent': 0}
        
        results = []
        for token in tokens[:500]:  # FCM limit is 500 tokens per request
            result = await self.send_notification(token, title, body, data)
            results.append(result)
        
        success_count = sum(1 for r in results if r.get('success'))
        
        return {
            'success': True,
            'sent': success_count,
            'failed': len(results) - success_count,
            'total': len(results)
        }


class ExpoPushService:
    """Expo Push Notification Service"""
    
    EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send"
    
    async def send_notification(
        self,
        token: str,
        title: str,
        body: str,
        data: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """Send push notification via Expo"""
        message = {
            "to": token,
            "sound": "default",
            "title": title,
            "body": body,
            "priority": "high"
        }
        
        if data:
            message["data"] = data
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    self.EXPO_PUSH_URL,
                    json=[message],
                    headers={
                        "Accept": "application/json",
                        "Content-Type": "application/json"
                    }
                )
                
                if response.status_code == 200:
                    return {'success': True, 'response': response.json()}
                else:
                    return {'success': False, 'error': response.text}
                    
        except Exception as e:
            return {'success': False, 'error': str(e)}
    
    async def send_multicast(
        self,
        tokens: List[str],
        title: str,
        body: str,
        data: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """Send notification to multiple Expo tokens"""
        if not tokens:
            return {'success': True, 'sent': 0}
        
        messages = []
        for token in tokens:
            message = {
                "to": token,
                "sound": "default",
                "title": title,
                "body": body,
                "priority": "high"
            }
            if data:
                message["data"] = data
            messages.append(message)
        
        try:
            async with httpx.AsyncClient() as client:
                response = await client.post(
                    self.EXPO_PUSH_URL,
                    json=messages,
                    headers={
                        "Accept": "application/json",
                        "Content-Type": "application/json"
                    }
                )
                
                if response.status_code == 200:
                    result = response.json()
                    # Count successes and failures
                    data_list = result.get('data', [])
                    success_count = sum(1 for d in data_list if d.get('status') == 'ok')
                    return {
                        'success': True,
                        'sent': success_count,
                        'failed': len(data_list) - success_count,
                        'total': len(data_list)
                    }
                else:
                    return {'success': False, 'error': response.text}
                    
        except Exception as e:
            return {'success': False, 'error': str(e)}


class UnifiedPushService:
    """
    Unified push notification service
    Automatically uses FCM for Firebase tokens and Expo for Expo tokens
    """
    
    def __init__(self):
        self.fcm = FCMService()
        self.expo = ExpoPushService()
    
    async def initialize(self, settings: Dict[str, Any] = None):
        """Initialize FCM from settings"""
        await self.fcm.initialize_from_settings(settings)
    
    def _is_expo_token(self, token: str) -> bool:
        """Check if token is an Expo push token"""
        return token.startswith('ExponentPushToken[') or token.startswith('ExpoPushToken[')
    
    async def send_notification(
        self,
        token: str,
        title: str,
        body: str,
        data: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """Send notification to appropriate service based on token type"""
        if self._is_expo_token(token):
            return await self.expo.send_notification(token, title, body, data)
        else:
            # Assume it's an FCM token
            return await self.fcm.send_notification(token, title, body, data)
    
    async def send_to_user(
        self,
        db,
        user_id: str,
        title: str,
        body: str,
        notification_type: str,
        data: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """
        Send notification to all devices of a user
        Also saves notification to database
        """
        from models.notification import Notification
        
        # Save notification to database
        notification = Notification(
            user_id=user_id,
            title=title,
            body=body,
            notification_type=notification_type,
            data=data
        )
        await db.notifications.insert_one(notification.dict())
        
        # Get user's device tokens
        device_tokens = await db.device_tokens.find({
            'user_id': user_id,
            'is_active': True
        }).to_list(10)
        
        if not device_tokens:
            return {'success': True, 'sent': 0, 'message': 'No active devices'}
        
        # Separate Expo and FCM tokens
        expo_tokens = []
        fcm_tokens = []
        
        for dt in device_tokens:
            token = dt.get('token', '')
            if self._is_expo_token(token):
                expo_tokens.append(token)
            else:
                fcm_tokens.append(token)
        
        results = []
        
        # Send to Expo tokens
        if expo_tokens:
            expo_result = await self.expo.send_multicast(expo_tokens, title, body, data)
            results.append(('expo', expo_result))
        
        # Send to FCM tokens
        if fcm_tokens and self.fcm.is_configured():
            fcm_result = await self.fcm.send_multicast(fcm_tokens, title, body, data)
            results.append(('fcm', fcm_result))
        
        total_sent = sum(r[1].get('sent', 0) for r in results)
        total_failed = sum(r[1].get('failed', 0) for r in results)
        
        return {
            'success': True,
            'sent': total_sent,
            'failed': total_failed,
            'notification_id': notification.id
        }
    
    async def broadcast(
        self,
        db,
        title: str,
        body: str,
        notification_type: str,
        data: Dict[str, Any] = None
    ) -> Dict[str, Any]:
        """
        Send notification to all users
        """
        # Get all active device tokens
        device_tokens = await db.device_tokens.find({
            'is_active': True
        }).to_list(10000)
        
        if not device_tokens:
            return {'success': True, 'sent': 0, 'message': 'No active devices'}
        
        # Get unique user IDs
        user_ids = list(set(dt.get('user_id') for dt in device_tokens))
        
        # Save notification for each user
        from models.notification import Notification
        notifications = []
        for user_id in user_ids:
            notification = Notification(
                user_id=user_id,
                title=title,
                body=body,
                notification_type=notification_type,
                data=data
            )
            notifications.append(notification.dict())
        
        if notifications:
            await db.notifications.insert_many(notifications)
        
        # Separate tokens by type
        expo_tokens = []
        fcm_tokens = []
        
        for dt in device_tokens:
            token = dt.get('token', '')
            if self._is_expo_token(token):
                expo_tokens.append(token)
            else:
                fcm_tokens.append(token)
        
        results = []
        
        # Send to Expo tokens in batches
        for i in range(0, len(expo_tokens), 100):
            batch = expo_tokens[i:i+100]
            result = await self.expo.send_multicast(batch, title, body, data)
            results.append(result)
        
        # Send to FCM tokens
        if fcm_tokens and self.fcm.is_configured():
            result = await self.fcm.send_multicast(fcm_tokens, title, body, data)
            results.append(result)
        
        total_sent = sum(r.get('sent', 0) for r in results)
        total_failed = sum(r.get('failed', 0) for r in results)
        
        return {
            'success': True,
            'sent': total_sent,
            'failed': total_failed,
            'users_notified': len(user_ids)
        }


# Singleton instance
push_service = UnifiedPushService()
