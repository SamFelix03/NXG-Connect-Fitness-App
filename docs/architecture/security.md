# Security

## Input Validation
- **Validation Library:** Joi 17.11.0 with comprehensive schemas
- **Validation Location:** Middleware layer before business logic processing
- **Required Rules:**
  - All external inputs MUST be validated against defined schemas
  - Validation at API boundary before processing
  - Whitelist approach preferred over blacklist
  - File upload validation for size, type, and content

## Authentication & Authorization
- **Auth Method:** JWT with RSA256 signing algorithm
- **Session Management:** Stateless JWT with Redis blacklist for logout
- **Required Patterns:**
  - Bearer token authentication for all protected endpoints
  - Role-based access control (RBAC) for administrative functions
  - Refresh token rotation for enhanced security
  - Multi-factor authentication support for sensitive operations

## Secrets Management
- **Development:** dotenv with .env.local files (gitignored)
- **Production:** AWS Secrets Manager with automatic rotation
- **Code Requirements:**
  - NEVER hardcode secrets in source code
  - Access via configuration service only
  - No secrets in logs or error messages
  - Environment-specific secret rotation

## API Security
- **Rate Limiting:** express-rate-limit with Redis store (100 requests per 15 minutes per IP)
- **CORS Policy:** Strict origin validation with credentials support
- **Security Headers:** Helmet.js with CSP, HSTS, and XSS protection
- **HTTPS Enforcement:** TLS 1.3 minimum with HTTP redirect to HTTPS

## Data Protection
- **Encryption at Rest:** MongoDB encryption with customer-managed keys
- **Encryption in Transit:** TLS 1.3 for all API communications
- **PII Handling:** Field-level encryption for sensitive health data
- **Logging Restrictions:** No PII, passwords, or tokens in application logs

## Dependency Security
- **Scanning Tool:** npm audit with automated vulnerability scanning
- **Update Policy:** Monthly dependency updates with security patch priority
- **Approval Process:** Security review required for new critical dependencies

## Security Testing
- **SAST Tool:** ESLint security rules with custom security linting
- **DAST Tool:** OWASP ZAP automated scanning in CI/CD pipeline
- **Penetration Testing:** Quarterly third-party security assessment
