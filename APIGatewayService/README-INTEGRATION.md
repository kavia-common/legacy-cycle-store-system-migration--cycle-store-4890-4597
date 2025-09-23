API Gateway integration notes:

- Upstream services:
  - BUSINESS_SERVICE_URL (default http://localhost:4002)
  - NOTIFICATION_SERVICE_URL (default http://localhost:4012)
- Exposed endpoints: /api/auth/login, /api/inventory, /api/orders, /api/notifications, /api/health
- Authentication: demo bearer token generation; replace with IdP in production.
