# API Gateway Security Notes

- JWT Verification
  - Configure JWT_ALG=HS256 with JWT_SECRET, or JWT_ALG=RS256 with JWT_PUBLIC_KEY_BASE64 containing a base64-encoded PEM public key.
  - Token `exp` and `nbf` claims are honored if present.

- RBAC
  - Role checks rely on `roles` (array) or single `role` claim in the access token.
  - Add route middleware `requireRole('<role>')` to protect admin-only operations.

- OAuth2 Scopes
  - When using OAuth2, token `scope` string (space-separated) or `scopes` array is parsed.
  - Use `requireScope('<scope>')` for scope-based authorization.

- Rate Limiting
  - Global limiter is enabled; per-route limiter can be added as needed.
  - Configure via RATE_LIMIT_WINDOW_MS and RATE_LIMIT_MAX.

- Audit Logging
  - Use `audit('<ACTION>', (req,res)=>details)` middleware before handlers to record audit events to the central logger/monitor.
  - Disable by setting AUDIT_ENABLED=false.

- Monitoring
  - Logs are forwarded to MONITOR_SERVICE_URL /api/v1/logs as ELK-compatible entries.
