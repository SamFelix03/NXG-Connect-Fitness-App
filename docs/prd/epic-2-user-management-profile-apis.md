# Epic 2: User Management & Profile APIs

**Epic Goal**: Build comprehensive user management APIs handling registration, profile management, body metrics tracking, and account lifecycle management with proper data validation and security.

## Story 2.1: User Registration and Account Management APIs

As a **mobile application**,
I want **robust user registration and account management endpoints**,
so that **I can handle the complete user lifecycle from signup to account deletion with proper validation**.

### Acceptance Criteria:
1. User registration endpoint (`POST /api/users/register`) with comprehensive profile data validation and storage
2. User profile retrieval endpoint (`GET /api/users/profile`) returning complete user information including demographics and fitness profile
3. Profile update endpoint (`PUT /api/users/profile`) with selective field updates and data validation
4. Account deletion endpoint (`DELETE /api/users/account`) with GDPR-compliant data removal and cascade cleanup
5. Email verification system with verification tokens and status tracking
6. Branch association management allowing users to join/leave gym branches
7. User search and filtering capabilities for administrative functions
8. Account status management (active, suspended, pending verification) with proper access controls

## Story 2.2: Body Metrics and Health Data Management

As a **fitness tracking application**,
I want **comprehensive body metrics and health data management APIs**,
so that **I can store, track, and analyze user health information with proper privacy controls**.

### Acceptance Criteria:
1. User Body metrics endpoint (`GET/PUT /api/users/body-metrics`) managing weight, height, BMI, and body composition data
3. User profile management including activity level, goals, and health conditions
5. Body metrics history endpoint with date-range filtering and progress calculation

## Story 2.3: User Session and Activity Tracking

As a **analytics system**,
I want **detailed user activity and session tracking APIs**,
so that **I can monitor user engagement, app usage patterns, and provide personalized insights**.

### Acceptance Criteria:
1. User session tracking storing device information, login times, and activity duration
2. App usage analytics endpoints tracking feature usage and engagement metrics
3. User activity logging for workout completion, meal logging, and goal achievements
4. Session history endpoints with filtering by date range and activity type
5. User preferences management for notifications, privacy settings, and app configuration
6. Device token management for push notifications with platform-specific handling
7. User feedback collection endpoints for app improvement and feature requests
8. Activity aggregation APIs providing daily, weekly, and monthly usage summaries
