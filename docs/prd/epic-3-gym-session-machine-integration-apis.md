# Epic 3: Gym Session & Machine Integration APIs

**Epic Goal**: Create comprehensive gym session management and real-time machine integration APIs that handle NFC/QR-based interactions, WebSocket communications, and equipment status tracking.

## Story 3.1: Gym Session Management API Implementation

As a **gym access system**,
I want **robust session management APIs for tracking gym entry, exit, and active sessions**,
so that **I can manage user access, monitor gym usage patterns, and ensure proper session lifecycle management**.

### Acceptance Criteria:
1. Session start endpoint (`POST /api/sessions/start`) validates NFC/QR tokens and creates active sessions with branch validation
2. Session end endpoint (`POST /api/sessions/end`) calculates duration, tracks machine usage, and marks sessions complete
3. Current session endpoint (`GET /api/sessions/current`) returns active session details with machine associations and duration
4. Session history endpoint (`GET /api/sessions/history`) with pagination, filtering, and usage analytics
5. Auto-session termination background job ending sessions after 4 hours or gym closing with notification triggers
6. Concurrent session prevention middleware ensuring one active session per user
7. Branch validation middleware confirming user access permissions for specific gym locations
8. Session analytics aggregation calculating peak hours, average duration, and usage patterns

## Story 3.2: Real-time Machine Integration and WebSocket Infrastructure

As a **gym equipment management system**,
I want **real-time machine status tracking and WebSocket communication APIs**,
so that **I can provide live equipment availability and enable seamless machine-user interactions**.

### Acceptance Criteria:
1. Machine availability endpoint (`GET /api/machines/availability`) returning real-time status for all equipment with branch filtering
2. WebSocket server implementation (`WS /api/ws/machines`) broadcasting live machine status updates to connected clients
3. Machine linking endpoint (`POST /api/machines/link`) creating temporary user-machine associations via NFC/QR validation
4. Machine unlinking endpoint (`POST /api/machines/unlink`) releasing equipment and broadcasting availability updates
5. Machine heartbeat endpoint (`POST /api/machines/heartbeat`) receiving status updates from equipment with connectivity monitoring
6. Queue management system tracking machine wait times and usage efficiency metrics
7. Branch-specific machine filtering ensuring users only see relevant equipment
8. WebSocket connection management with user authentication and automatic cleanup on disconnect

## Story 3.3: Workout Data Synchronization and Machine Communication

As a **connected gym equipment**,
I want **workout data synchronization APIs for real-time exercise tracking**,
so that **I can send workout metrics to user profiles and enable live progress monitoring**.

### Acceptance Criteria:
1. Workout data ingestion endpoint (`POST /api/machines/workout-data`) receiving reps, sets, weight, and duration from equipment
2. Real-time workout progress WebSocket events broadcasting live metrics to user's connected devices
3. Machine maintenance reporting endpoint (`POST /api/machines/maintenance`) updating equipment status and availability
4. Workout data validation middleware ensuring data integrity and proper formatting before storage
5. Equipment-specific data parsers handling different machine types (cardio, strength, functional)
6. Offline data synchronization queue processing workout data when machines regain connectivity
7. Machine performance monitoring calculating uptime, usage frequency, and maintenance scheduling
8. Workout data aggregation into user activity records with proper session association
