# Tech Stack

This is the DEFINITIVE technology selection for the entire project. All development must use these exact versions.

## Technology Stack Table

| Category | Technology | Version | Purpose | Rationale |
|----------|------------|---------|---------|-----------|
| **Runtime** | Node.js | 20.11.0 | JavaScript runtime environment | LTS version with optimal performance and security |
| **Language** | TypeScript | 5.3.3 | Primary development language | Type safety, excellent tooling, enhanced developer experience |
| **Framework** | Express.js | 4.18.2 | Web application framework | Mature, performant, extensive middleware ecosystem |
| **Database** | MongoDB | 7.0 | Primary document database | Flexible schema for fitness data, excellent performance |
| **ODM** | Mongoose | 8.0.3 | MongoDB object modeling | Schema validation, middleware, and query building |
| **Cache** | Redis | 7.2 | In-memory caching and sessions | High-performance caching and real-time data |
| **WebSocket** | Socket.IO | 4.7.4 | Real-time communication | Machine connectivity and live updates |
| **Authentication** | jsonwebtoken | 9.0.2 | JWT token management | Stateless authentication for scalability |
| **Validation** | Joi | 17.11.0 | Input validation and sanitization | Comprehensive schema validation |
| **Password Hashing** | bcrypt | 5.1.1 | Secure password hashing | Industry standard for password security |
| **HTTP Client** | axios | 1.6.2 | External service integration | Reliable HTTP client with interceptors |
| **Rate Limiting** | express-rate-limit | 7.1.5 | API rate limiting | DDoS protection and abuse prevention |
| **Security** | helmet | 7.1.0 | Security headers middleware | Comprehensive security header management |
| **Logging** | winston | 3.11.0 | Structured logging | Production-grade logging with multiple transports |
| **Error Tracking** | @sentry/node | 7.81.1 | Error monitoring and tracking | Real-time error tracking and performance monitoring |
| **Testing Framework** | Jest | 29.7.0 | Unit and integration testing | Comprehensive testing with mocking capabilities |
| **API Testing** | supertest | 6.3.3 | HTTP endpoint testing | Integration testing for REST APIs |
| **Load Testing** | artillery | 2.0.3 | Performance and load testing | Scalability validation and performance benchmarking |
| **Documentation** | swagger-jsdoc | 6.2.8 | API documentation generation | Auto-generated OpenAPI specifications |
| **Environment** | dotenv | 16.3.1 | Environment configuration | Secure configuration management |
| **Process Manager** | PM2 | 5.3.0 | Production process management | Process clustering and zero-downtime deployments |
| **File Upload** | multer | 1.4.5 | Multipart form handling | Meal image and scan file uploads |
| **Image Processing** | sharp | 0.33.0 | Image optimization | Meal image compression and format conversion |
| **Push Notifications** | firebase-admin | 11.11.1 | Firebase Cloud Messaging | Cross-platform push notifications |
| **Cloud SDK** | aws-sdk | 2.1490.0 | AWS service integration | S3 storage and CloudFront CDN |
