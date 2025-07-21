# Components

## Authentication Service

**Responsibility:** Handle user authentication, JWT token management, and session security

**Key Interfaces:**
- POST /api/auth/register - User registration with validation
- POST /api/auth/login - User authentication and token generation
- POST /api/auth/refresh - Refresh token validation and renewal
- POST /api/auth/logout - Token invalidation and session cleanup

**Dependencies:** MongoDB (user storage), Redis (token blacklist), bcrypt (password hashing)

**Technology Stack:** Express.js middleware, jsonwebtoken, bcrypt, Redis client

## External Service Integration Layer

**Responsibility:** Orchestrate direct HTTP calls to external AI services with error handling and caching

**Key Interfaces:**
- External workout planning service integration
- External meal detection service integration  
- External nutrition planning service integration
- External 3D scanning service integration

**Dependencies:** axios (HTTP client), Redis (response caching), Circuit breaker implementation

**Technology Stack:** axios interceptors, Redis caching, Winston logging, Sentry error tracking

## Real-time Communication Service

**Responsibility:** Manage WebSocket connections for gym equipment and live data synchronization

**Key Interfaces:**
- WebSocket /api/ws/machines - Machine status updates
- WebSocket /api/ws/workouts - Live workout progress
- Machine heartbeat endpoints
- Real-time availability broadcasting

**Dependencies:** Socket.IO server, Redis (connection state), JWT authentication

**Technology Stack:** Socket.IO, Redis adapter for clustering, JWT middleware

## Analytics Engine

**Responsibility:** Calculate performance metrics, progress tracking, and goal achievement analytics

**Key Interfaces:**
- GET /api/analytics/workout/* - Workout progress calculations
- GET /api/analytics/nutrition/* - Nutrition compliance analytics
- GET /api/analytics/body/* - Body composition trend analysis
- Background aggregation jobs

**Dependencies:** MongoDB aggregation pipelines, Redis (cached results), User activity data

**Technology Stack:** MongoDB aggregation framework, Node.js scheduled jobs, Redis caching

## Notification Service

**Responsibility:** Manage push notifications, scheduling, and engagement tracking

**Key Interfaces:**
- POST /api/notifications/register - Device token management
- Scheduled notification delivery
- Achievement unlock notifications
- Social interaction notifications

**Dependencies:** Firebase Cloud Messaging, MongoDB (user preferences), Redis (scheduling)

**Technology Stack:** Firebase Admin SDK, Node.js cron jobs, Redis task queues

## File Management Service

**Responsibility:** Handle file uploads, image processing, and S3 storage integration

**Key Interfaces:**
- POST /api/upload/meal-images - Meal photo processing
- POST /api/upload/scan-data - InBody scan file handling
- Avatar file storage and retrieval
- CDN integration for optimized delivery

**Dependencies:** AWS S3, CloudFront CDN, Sharp (image processing), multer (file uploads)

**Technology Stack:** AWS SDK, multer middleware, Sharp image processing, S3 client
