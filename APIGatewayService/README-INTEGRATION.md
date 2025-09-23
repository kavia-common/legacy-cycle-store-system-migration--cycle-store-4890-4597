# API Gateway Service – Integration Notes

- Default dev port: 3000 (set PORT=3000)
- Docs: /docs
- Health: GET / and GET /api/health
- Auth (bootstrap): POST /api/auth/login
- Inventory: GET /api/inventory (proxies to BusinessLogicService)
- Orders: POST /api/orders (proxies to BusinessLogicService)
- Notifications: POST /api/notifications (proxies to NotificationService)

Environment variables: see .env.example
- BL_SERVICE_URL (e.g., http://localhost:4001)
- DATA_SERVICE_URL (future)
- NOTIFY_SERVICE_URL (e.g., http://localhost:4003)
