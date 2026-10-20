# Test Credentials — طير (Tair)

## 🛡️ Super Admin (v8.1.4 – الجديدة)
- **Email**: `sky-321@hotmail.com`
- **Password**: `Talal12@`
- **user_id**: `admin_e014ed8981b8`
- **role**: `super_admin`
- **name**: `مدير صقر`
- **is_admin**: `true`
- **Login endpoint**: `POST /api/auth/signin` (unified admin+user login)
- **Verified admin permissions (Feb 27, 2026):**
  - ✅ DELETE any listing: `DELETE /api/listings/{id}?user_id=sky-321@hotmail.com`
  - ✅ PATCH any listing: `PATCH /api/listings/{id}?user_id=sky-321@hotmail.com`
  - ✅ DELETE any trip: `DELETE /api/trips/{id}?user_id=sky-321@hotmail.com`
  - ✅ PATCH any trip: `PATCH /api/trips/{id}?user_id=sky-321@hotmail.com`

## Guest Mode (for web preview testing)
- Tap **"الدخول كزائر"** on the auth page. No account needed.
- The guest gets a temporary `id: guest_<timestamp>` and can browse listings/trips freely.
- Guest cannot create listings or place real orders (backend expects a valid user_id).

## Test User (create via /api/auth/register)
- Any email/password works. `POST /api/auth/register` with a valid strong password will create a user and return `{ user, token }`.

## Notes
- Admin login uses `/api/admin/auth/login` and returns a JWT for admin actions.
- Tair backend routes are user-scoped via `?user_id=` query — no strict JWT enforcement on the marketplace endpoints (MVP).
