# Saqr App - Contracts & Implementation Plan

## Overview
تطبيق "صقر" - منصة مشاهدة الإعلانات مع نظام النقاط والمكافآت

## Current Implementation (Frontend with Mock Data)

### Mock Data Files
- `/app/frontend/src/mockData.js` - Contains:
  - `mockAds`: 3 test advertisements
  - `mockUser`: User template
  - `withdrawMethods`: Payment methods (PayPal, STC Pay, Bank Transfer)

### Components Created
1. **AuthPage** - Login page (Google & Apple auth ready)
2. **AdViewer** - Instagram Reels-style ad viewer
3. **ProfilePage** - User profile with points and stats
4. **WithdrawPage** - Points redemption page
5. **BottomNav** - Navigation bar

### Current Features (Frontend Only)
- User authentication (mock)
- Ad viewing with timer
- Points calculation (1 point/minute)
- Anti-cheat: Each ad counted once
- localStorage persistence
- Withdraw requests (mock)

## API Contracts (To Be Implemented)

### Authentication APIs
```
POST /api/auth/google
  - Request: { token: string }
  - Response: { user: User, token: JWT }

POST /api/auth/apple
  - Request: { token: string }
  - Response: { user: User, token: JWT }

GET /api/auth/me
  - Headers: Authorization: Bearer {token}
  - Response: { user: User }
```

### User APIs
```
GET /api/users/profile
  - Headers: Authorization
  - Response: { user: UserProfile, points: number, watchedAds: string[] }

PUT /api/users/profile
  - Headers: Authorization
  - Request: { name?, avatar? }
  - Response: { user: UserProfile }
```

### Ads APIs
```
GET /api/ads
  - Headers: Authorization
  - Response: { ads: Ad[] }

GET /api/ads/:id
  - Headers: Authorization
  - Response: { ad: Ad }

POST /api/ads/watch
  - Headers: Authorization
  - Request: { adId: string, watchTime: number }
  - Response: { pointsEarned: number, totalPoints: number }
  - Anti-cheat validation on backend
```

### Withdrawal APIs
```
GET /api/withdrawals
  - Headers: Authorization
  - Response: { withdrawals: Withdrawal[] }

POST /api/withdrawals
  - Headers: Authorization
  - Request: { 
      amount: number, 
      method: string, 
      details: object 
    }
  - Response: { withdrawal: Withdrawal, status: 'pending' }

GET /api/withdrawals/:id
  - Headers: Authorization
  - Response: { withdrawal: Withdrawal }
```

### Admin APIs (Future)
```
GET /api/admin/withdrawals
  - Get all pending withdrawals

PUT /api/admin/withdrawals/:id
  - Approve/reject withdrawal
  - Request: { status: 'approved' | 'rejected', note? }
```

## Database Schema

### Users Collection
```javascript
{
  _id: ObjectId,
  email: string,
  name: string,
  avatar: string,
  provider: 'google' | 'apple',
  providerId: string,
  points: number,
  totalEarned: number,
  watchedAds: [
    {
      adId: string,
      watchedAt: Date,
      watchTime: number,
      pointsEarned: number
    }
  ],
  createdAt: Date,
  updatedAt: Date
}
```

### Ads Collection
```javascript
{
  _id: ObjectId,
  title: string,
  description: string,
  videoUrl: string,
  thumbnailUrl: string,
  advertiser: string,
  duration: number, // seconds
  pointsPerMinute: number,
  isActive: boolean,
  createdAt: Date
}
```

### Withdrawals Collection
```javascript
{
  _id: ObjectId,
  userId: ObjectId,
  amount: number, // in dollars
  points: number, // points deducted
  method: string, // 'paypal', 'stcpay', 'bank'
  details: {
    // Method-specific fields
    email?: string, // PayPal
    phone?: string, // STC Pay
    bankName?: string,
    accountName?: string,
    iban?: string
  },
  status: 'pending' | 'approved' | 'rejected',
  adminNote?: string,
  createdAt: Date,
  processedAt?: Date
}
```

## Anti-Cheat Mechanisms

### Frontend (Current)
- Track watched ads in localStorage
- Timer validation
- Disable multiple plays of same ad

### Backend (To Implement)
1. **Server-side timer validation**
   - Validate watch time on server
   - Check timestamps for suspicious patterns
   - Max points per ad = duration in minutes

2. **One-time ad watching**
   - Check `users.watchedAds` before awarding points
   - Return error if ad already watched

3. **Rate limiting**
   - Limit API calls per user/IP
   - Prevent rapid-fire requests

4. **Session validation**
   - Track active sessions
   - Prevent multiple concurrent sessions

## Frontend-Backend Integration Plan

### Step 1: Authentication
1. Replace mock login with actual Google OAuth
2. Add Apple Sign-In (when developer account ready)
3. Store JWT token in localStorage
4. Add token to all API requests

### Step 2: User & Ads
1. Fetch real ads from `/api/ads`
2. Replace mockUser with API user data
3. Sync points with backend
4. Remove mock data files

### Step 3: Ad Watching
1. Send watch events to `/api/ads/watch`
2. Server validates and awards points
3. Update UI based on API response

### Step 4: Withdrawals
1. Implement real withdrawal requests
2. Admin panel for approval (future)
3. Email notifications (future)

## Environment Variables Needed

### Backend
```
MONGO_URL=<already configured>
JWT_SECRET=<generate random string>
GOOGLE_CLIENT_ID=<from Google Console>
GOOGLE_CLIENT_SECRET=<from Google Console>
APPLE_CLIENT_ID=<from Apple Developer>
APPLE_TEAM_ID=<from Apple Developer>
APPLE_KEY_ID=<from Apple Developer>
APPLE_PRIVATE_KEY=<from Apple Developer>
```

### Frontend
```
REACT_APP_BACKEND_URL=<already configured>
REACT_APP_GOOGLE_CLIENT_ID=<from Google Console>
```

## Next Steps
1. ✅ Frontend with mock data (COMPLETED)
2. ⏳ User approval to proceed with backend
3. Backend API implementation
4. Frontend-backend integration
5. Testing with real data
6. Deploy & launch

## Notes
- All mock data is in `/app/frontend/src/mockData.js`
- localStorage keys: `saqr_user`, `saqr_watched_ads`
- Video URLs use Google sample videos (working)
- Apple auth will need developer account setup later
