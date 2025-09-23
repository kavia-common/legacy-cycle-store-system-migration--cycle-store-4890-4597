# API Gateway Service

A robust, production-ready API Gateway for the Cycle Store System migration project. Provides unified authentication, authorization, request routing, security enforcement, rate limiting, and monitoring for microservices architecture.

## 🚀 Features

- **Authentication & Authorization**: JWT token validation with HS256/RS256 support, OAuth2 compatibility, role-based access control (RBAC)
- **Request Routing**: Intelligent routing to backend services with load balancing and circuit breaker patterns
- **Security**: Comprehensive security headers, CORS configuration, rate limiting, input validation, and sanitization
- **Monitoring & Logging**: Structured logging, metrics collection, health checks, and integration with monitoring services
- **API Documentation**: Auto-generated OpenAPI/Swagger documentation with interactive UI
- **Resilience**: Circuit breakers, retry logic, timeout handling, and graceful degradation
- **Performance**: Request correlation, caching headers, and performance optimization
- **Operational**: Health checks, metrics endpoints, graceful shutdown, and container-ready deployment

## 📋 Prerequisites

- Node.js 18+ and npm 8+
- Backend services (Business Logic, Data, Notification services)
- Optional: Redis for rate limiting and caching
- Optional: External monitoring service

## 🛠️ Installation

1. **Clone and navigate to the project:**
   ```bash
   cd APIGatewayService
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment:**
   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

4. **Generate OpenAPI documentation:**
   ```bash
   npm run openapi:generate
   ```

## ⚙️ Configuration

### Environment Variables

The service is configured via environment variables. See `.env.example` for a complete list of available options.

#### Essential Configuration

```env
# Server
NODE_ENV=production
PORT=3000
HOST=0.0.0.0

# JWT Authentication
JWT_ALG=HS256
JWT_SECRET=your-super-secret-jwt-key-min-32-chars

# Backend Services
BL_SERVICE_URL=http://business-logic:4001
DATA_SERVICE_URL=http://data-service:4002
NOTIFY_SERVICE_URL=http://notification-service:4003

# Security
RATE_LIMIT_MAX=100
RATE_LIMIT_AUTH_MAX=5
CORS_ORIGINS=https://your-frontend.com

# Monitoring
MONITOR_SERVICE_URL=http://monitoring:4601
LOG_LEVEL=info
AUDIT_ENABLED=true
```

#### OAuth2 Configuration (Optional)

```env
OAUTH2_ENABLED=true
OAUTH2_ISSUER=https://your-oauth-provider.com
OAUTH2_AUDIENCE=cycle-store-api
```

### JWT Configuration

The API Gateway supports both symmetric (HS256) and asymmetric (RS256) JWT algorithms:

**HS256 (Shared Secret):**
```env
JWT_ALG=HS256
JWT_SECRET=your-shared-secret-key
```

**RS256 (Public Key):**
```env
JWT_ALG=RS256
JWT_PUBLIC_KEY_BASE64=base64-encoded-pem-public-key
```

## 🚀 Usage

### Development

```bash
# Start in development mode with auto-reload
npm run dev

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Lint code
npm run lint

# Fix linting issues
npm run lint:fix
```

### Production

```bash
# Start in production mode
npm start

# Or with PM2 for production process management
pm2 start src/server.js --name api-gateway
```

### Docker Deployment

```bash
# Build image
docker build -t api-gateway-service .

# Run container
docker run -p 3000:3000 \
  -e JWT_SECRET=your-secret \
  -e BL_SERVICE_URL=http://business-logic:4001 \
  api-gateway-service
```

### Docker Compose

```yaml
version: '3.8'
services:
  api-gateway:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - JWT_SECRET=${JWT_SECRET}
      - BL_SERVICE_URL=http://business-logic:4001
      - DATA_SERVICE_URL=http://data-service:4002
      - NOTIFY_SERVICE_URL=http://notification-service:4003
    depends_on:
      - business-logic
      - data-service
      - notification-service
    restart: unless-stopped
```

## 📚 API Documentation

Once running, access interactive API documentation at:
- **Swagger UI**: http://localhost:3000/docs
- **OpenAPI Spec**: http://localhost:3000/openapi.json

### Key Endpoints

#### Authentication
- `POST /api/auth/login` - User authentication
- `POST /api/auth/logout` - User logout
- `GET /api/auth/profile` - Get user profile

#### Users (Admin only)
- `GET /api/users` - List users
- `POST /api/users` - Create user
- `GET /api/users/:id` - Get user by ID

#### Business Operations
- `GET /api/inventory` - List inventory items
- `POST /api/orders` - Create new order
- `GET /api/customers` - List customers
- `POST /api/customers` - Create customer

#### Support
- `GET /api/support/tickets` - List support tickets
- `POST /api/support/tickets` - Create support ticket

#### Notifications
- `POST /api/notifications` - Send notification

#### System
- `GET /health` - Basic health check
- `GET /ready` - Readiness probe
- `GET /metrics` - Prometheus metrics

### Authentication

All protected endpoints require a valid JWT token in the Authorization header:

```bash
curl -H "Authorization: Bearer <your-jwt-token>" \
     http://localhost:3000/api/inventory
```

### Example Usage

**Login:**
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "password"}'
```

**Create Order:**
```bash
curl -X POST http://localhost:3000/api/orders \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "customer-123",
    "items": [
      {"sku": "BIKE-001", "qty": 1, "price": 299.99}
    ]
  }'
```

## 🔧 Monitoring & Operations

### Health Checks

- **Liveness**: `GET /health` - Basic service health
- **Readiness**: `GET /ready` - Service and dependencies health
- **Metrics**: `GET /metrics` - Prometheus-compatible metrics

### Logging

The service uses structured JSON logging with correlation IDs for request tracing:

```json
{
  "ts": "2024-01-01T12:00:00.000Z",
  "level": "INFO",
  "message": "incoming_request",
  "meta": {
    "requestId": "req-123",
    "method": "GET",
    "path": "/api/inventory",
    "ip": "192.168.1.100",
    "user": {"sub": "user-456", "roles": ["user"]}
  }
}
```

### Metrics

Key metrics exposed at `/metrics`:
- Request count and duration
- Error rates by endpoint
- Memory and CPU usage
- Service uptime
- Circuit breaker status

### Rate Limiting

Built-in rate limiting with different tiers:
- **Auth endpoints**: 5 requests/minute
- **API endpoints**: 100 requests/minute
- **Public endpoints**: 200 requests/minute

## 🛡️ Security

### Security Features

- **Headers**: Comprehensive security headers via Helmet
- **CORS**: Configurable cross-origin resource sharing
- **Rate Limiting**: Multiple tiers with IP-based limits
- **Input Validation**: Request body and parameter validation
- **JWT Security**: Secure token validation with exp/nbf checks
- **Audit Logging**: Detailed audit trails for compliance

### Security Best Practices

1. **Environment Variables**: Never commit secrets to version control
2. **JWT Secrets**: Use strong, randomly generated secrets (32+ characters)
3. **HTTPS**: Always use HTTPS in production
4. **Rate Limiting**: Configure appropriate limits for your use case
5. **CORS**: Restrict origins to your actual frontend domains
6. **Updates**: Keep dependencies updated for security patches

## 🔍 Troubleshooting

### Common Issues

**1. Service Unavailable (503)**
- Check backend service connectivity
- Verify service URLs in environment configuration
- Check circuit breaker status in logs

**2. Authentication Errors (401)**
- Verify JWT secret configuration
- Check token expiration
- Validate token format and claims

**3. Rate Limiting (429)**
- Adjust rate limit configuration
- Implement exponential backoff in clients
- Monitor usage patterns

**4. Memory Issues**
- Monitor `/metrics` endpoint
- Check for memory leaks in logs
- Adjust container memory limits

### Debug Mode

Enable detailed logging for debugging:

```env
NODE_ENV=development
LOG_LEVEL=debug
DEV_DETAILED_ERRORS=true
```

### Health Check Debugging

```bash
# Check service health
curl http://localhost:3000/health

# Check readiness with dependencies
curl http://localhost:3000/ready

# View metrics
curl http://localhost:3000/metrics
```

## 📈 Performance Tuning

### Configuration Options

```env
# Service timeouts
SERVICE_TIMEOUT_MS=10000
SERVICE_MAX_RETRIES=3

# Circuit breaker
CIRCUIT_BREAKER_THRESHOLD=5
CIRCUIT_BREAKER_TIMEOUT=60000

# Rate limiting
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX=100
```

### Production Optimizations

1. **Process Management**: Use PM2 or similar for process management
2. **Load Balancing**: Deploy multiple instances behind a load balancer
3. **Caching**: Implement Redis for rate limiting and caching
4. **Monitoring**: Set up comprehensive monitoring and alerting
5. **Logging**: Use centralized logging with log aggregation

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Run tests and linting
6. Submit a pull request

### Development Guidelines

- Follow existing code style
- Add tests for new features
- Update documentation
- Use meaningful commit messages
- Keep changes focused and atomic

## 📄 License

This project is licensed under the ISC License - see the LICENSE file for details.

## 🆘 Support

For support and questions:
- Check the troubleshooting section above
- Review logs for error messages
- Open an issue in the project repository
- Contact the development team

---

**API Gateway Service** - Part of the Cycle Store System Migration Project
