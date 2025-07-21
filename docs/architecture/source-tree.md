# Source Tree

```plaintext
nxg-fitness-backend/
├── src/
│   ├── controllers/                # HTTP request handlers
│   │   ├── auth.controller.ts      # Authentication endpoints
│   │   ├── users.controller.ts     # User management endpoints
│   │   ├── sessions.controller.ts  # Gym session management
│   │   ├── machines.controller.ts  # Machine integration endpoints
│   │   ├── workouts.controller.ts  # Workout management endpoints
│   │   ├── nutrition.controller.ts # Nutrition tracking endpoints
│   │   ├── analytics.controller.ts # Analytics and progress endpoints
│   │   ├── social.controller.ts    # Social features endpoints
│   │   └── notifications.controller.ts # Notification management
│   ├── services/                   # Business logic layer
│   │   ├── auth.service.ts         # Authentication business logic
│   │   ├── users.service.ts        # User management service
│   │   ├── external/               # External service integration
│   │   │   ├── workout-planning.service.ts
│   │   │   ├── meal-detection.service.ts
│   │   │   ├── nutrition-planning.service.ts
│   │   │   └── scanning.service.ts
│   │   ├── analytics.service.ts    # Analytics calculations
│   │   ├── notifications.service.ts # Push notification service
│   │   ├── websocket.service.ts    # Real-time communication
│   │   └── file-storage.service.ts # S3 file management
│   ├── models/                     # Mongoose data models
│   │   ├── User.ts                 # User schema and model
│   │   ├── WorkoutPlan.ts          # Workout plan schema
│   │   ├── UserActivity.ts         # Activity tracking schema
│   │   ├── Machine.ts              # Gym equipment schema
│   │   ├── Session.ts              # Gym session schema
│   │   └── index.ts                # Model exports
│   ├── middleware/                 # Express middleware
│   │   ├── auth.middleware.ts      # JWT authentication
│   │   ├── validation.middleware.ts # Joi input validation
│   │   ├── rateLimit.middleware.ts # Rate limiting
│   │   ├── error.middleware.ts     # Error handling
│   │   └── logging.middleware.ts   # Request logging
│   ├── routes/                     # Express route definitions
│   │   ├── auth.routes.ts          # Authentication routes
│   │   ├── users.routes.ts         # User management routes
│   │   ├── sessions.routes.ts      # Session management routes
│   │   ├── machines.routes.ts      # Machine integration routes
│   │   ├── workouts.routes.ts      # Workout routes
│   │   ├── nutrition.routes.ts     # Nutrition routes
│   │   ├── analytics.routes.ts     # Analytics routes
│   │   ├── social.routes.ts        # Social features routes
│   │   └── index.ts                # Route aggregation
│   ├── utils/                      # Utility functions
│   │   ├── database.ts             # MongoDB connection
│   │   ├── redis.ts                # Redis connection
│   │   ├── logger.ts               # Winston configuration
│   │   ├── validation.ts           # Joi schemas
│   │   ├── jwt.ts                  # JWT utilities
│   │   ├── encryption.ts           # Encryption utilities
│   │   ├── file-upload.ts          # Multer configuration
│   │   └── constants.ts            # Application constants
│   ├── config/                     # Configuration management
│   │   ├── database.config.ts      # Database configuration
│   │   ├── redis.config.ts         # Redis configuration
│   │   ├── aws.config.ts           # AWS SDK configuration
│   │   ├── external-apis.config.ts # External service configs
│   │   └── environment.ts          # Environment variables
│   ├── websocket/                  # WebSocket implementation
│   │   ├── machine.socket.ts       # Machine connectivity handlers
│   │   ├── workout.socket.ts       # Workout progress handlers
│   │   ├── auth.socket.ts          # WebSocket authentication
│   │   └── index.ts                # Socket.IO server setup
│   ├── jobs/                       # Background job processing
│   │   ├── session-cleanup.job.ts  # Auto-end gym sessions
│   │   ├── analytics.job.ts        # Scheduled analytics
│   │   ├── notifications.job.ts    # Scheduled notifications
│   │   └── cache-refresh.job.ts    # Cache maintenance
│   └── app.ts                      # Express application setup
├── tests/                          # Test suites
│   ├── unit/                       # Unit tests
│   │   ├── services/               # Service layer tests
│   │   ├── models/                 # Model tests
│   │   └── utils/                  # Utility tests
│   ├── integration/                # Integration tests
│   │   ├── api/                    # API endpoint tests
│   │   ├── database/               # Database tests
│   │   └── external/               # External service tests
│   ├── fixtures/                   # Test data
│   └── setup.ts                    # Test configuration
├── docs/                           # Documentation
│   ├── api/                        # API documentation
│   │   ├── openapi.yaml            # OpenAPI specification
│   │   └── postman-collection.json # Postman collection
│   ├── deployment/                 # Deployment guides
│   └── architecture.md             # This document
├── scripts/                        # Deployment and utility scripts
│   ├── deploy.sh                   # Deployment script
│   ├── migrate.js                  # Database migration
│   └── seed.js                     # Development data seeding
├── .env.example                    # Environment template
├── .gitignore                      # Git ignore rules
├── package.json                    # Dependencies and scripts
├── tsconfig.json                   # TypeScript configuration
├── jest.config.js                  # Jest testing configuration
├── ecosystem.config.js             # PM2 configuration
└── README.md                       # Project documentation
```
