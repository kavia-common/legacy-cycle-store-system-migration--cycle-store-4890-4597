# API Gateway Service – Integration Notes

- Default dev port: 3000 (set PORT=3000)
- Docs: GET /docs
- Health: GET / and GET /api/health
- Auth (bootstrap): POST /api/auth/login
- Inventory: GET /api/inventory (proxies to BusinessLogicService)
- Orders: POST /api/orders (proxies to BusinessLogicService)
- Notifications: POST /api/notifications (proxies to NotificationService)

Security
- JWT/OAuth2 Bearer tokens enforced on protected routes.
- RBAC via `roles` claim and optional OAuth `scope`.
- Configure JWT verification using .env: JWT_ALG, JWT_SECRET or JWT_PUBLIC_KEY_BASE64.

Policies
- Request validation using JSON Schema; 400 with error details on failure.
- Global and per-route rate limiting (configurable via RATE_LIMIT_* envs).
- Standardized error responses: `{ status, message, details, requestId }`.

Monitoring & Audit
- All requests are logged with correlation id (X-Request-Id).
- Logs are forwarded to MonitoringandLoggingService if MONITOR_SERVICE_URL is set.
- Audit hooks on sensitive routes (orders, notifications) emit audit_event logs.

Environment variables: see .env.example
- BL_SERVICE_URL (e.g., http://localhost:4001)
- DATA_SERVICE_URL (e.g., http://localhost:4002)
- NOTIFY_SERVICE_URL (e.g., http://localhost:4003)
- MONITOR_SERVICE_URL (e.g., http://localhost:4601)
- JWT_ALG, JWT_SECRET or JWT_PUBLIC_KEY_BASE64
- RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX
- AUDIT_ENABLED=true|false
