# TODO

## Auth

- Add real password reset before wider testing.
  - Backend endpoints:
    - `POST /api/v1/auth/password-reset/request`
    - `POST /api/v1/auth/password-reset/confirm`
  - Store short-lived reset tokens hashed in DB.
  - Send reset links by email through a provider such as Resend, SendGrid, or AWS SES.
  - Replace the current login-screen guidance modal with the real reset flow.

## Receipt Scanning

- Keep testing iPhone Safari/PWA receipt scanning.
- Current flow:
  - Select or capture receipt image.
  - Upload to `/api/v1/receipts/scan`.
  - Navigate to transaction entry with the extracted amount/description/category.
- Render API must have `ANTHROPIC_API_KEY` set for AI analysis.
