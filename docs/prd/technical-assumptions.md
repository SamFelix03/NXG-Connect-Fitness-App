# Technical Assumptions

## Repository Structure: Monorepo
Single repository containing the Express.js backend API, shared utilities, database schemas, and deployment configurations for streamlined backend development and DevOps management.

## Service Architecture
**API-First Monolithic Backend**: Single Express.js application with modular route organization designed for high performance and future microservices decomposition as needed for scaling.

## Testing Requirements
**Backend-Focused Testing Strategy**: Comprehensive Jest unit testing for business logic, Supertest integration testing for API endpoints, Artillery performance testing for load scenarios, and OWASP ZAP security testing with 80% minimum code coverage.

## Additional Technical Assumptions and Requests
- **Primary Database**: MongoDB Atlas with Mongoose ODM for flexible document storage and schema evolution
- **Caching Strategy**: Redis Cluster for session management, machine status caching, and API response optimization
- **File Storage**: AWS S3 with CloudFront CDN for 3D avatar files, meal images, and scan data storage
- **Real-time Communication**: Socket.IO WebSocket implementation for machine connectivity and live data updates
- **Push Notifications**: Firebase Cloud Messaging (FCM) server-side SDK for cross-platform notification delivery
- **External Service Integration**: HTTP clients with axios for workout planning, meal detection, nutrition planning, and 3D scanning APIs
- **Monitoring & Logging**: Sentry for error tracking, Winston for structured logging, Prometheus/Grafana for API metrics
- **Deployment Platform**: AWS EC2 with Application Load Balancer, Auto Scaling Groups, and blue/green deployment via CodeDeploy
- **API Documentation**: OpenAPI/Swagger specification with auto-generated docs and Postman collection exports
- **Security Framework**: Helmet.js security headers, express-rate-limit with Redis store, and bcrypt password hashing
- **Environment Management**: dotenv configuration with validation for development, staging, and production environments
