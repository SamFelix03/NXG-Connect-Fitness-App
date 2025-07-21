# Epic 4: External Service Integration Layer

**Epic Goal**: Build a comprehensive integration layer that communicates with external AI services for workout planning, meal detection, nutrition planning, and 3D scanning while providing robust error handling and data caching.

## Story 4.1: Workout Planning Service Integration APIs

As a **workout management system**,
I want **seamless integration with external workout planning service that creates and manages single active workout plans per user**,
so that **I can retrieve personalized workout plans, associate them with users through activePlans records, and ensure each user has exactly one modifiable workout plan**.

### Acceptance Criteria:
1. **Single Workout Plan Creation**: Endpoint (`POST /api/integrations/workout-plans`) that creates one workout plan per user via external service and updates user's `activePlans.workoutPlanId` with the new plan ID
2. **Single Plan Enforcement**: System ensures each user has exactly one active workout plan by deactivating previous plans before creating new ones
3. **Workout Plan Caching**: Store received plans in MongoDB with user association through `activePlans` record, including expiration and refresh mechanisms
4. **Daily Workout Access**: Endpoint (`GET /api/workouts/daily`) returning user's single active workout plan with real-time machine availability integration
5. **Workout Library**: Endpoint (`GET /api/workouts/library`) aggregating external service data with local customization options
6. **External Service Integration**: Error handling with circuit breaker pattern and fallback to user's cached active workout plan
7. **Plan Refresh Management**: Automated refresh mechanism that regenerates workout plans every 2 weeks based on current user parameters, maintaining single active plan per user
8. **Data Validation**: Service response validation ensuring workout data integrity before storage and user association
9. **Automated Plan Management**: Fully automated workout plan creation and storage without user modification capabilities
10. **Active Plans Maintenance**: Proper management of user's `activePlans.workoutPlanId` reference with cleanup of inactive plans

## Story 4.2: Diet Planning Service Integration APIs

As a **nutrition management system**,
I want **seamless integration with external diet planning service that creates and manages single active diet plans per user**,
so that **I can retrieve personalized diet plans, associate them with users through activePlans records, and ensure each user has exactly one active diet plan**.

### Acceptance Criteria:
1. **Single Diet Plan Creation**: Endpoint (`POST /api/integrations/diet-plans`) that creates one diet plan per user via external service and updates user's `activePlans.dietPlanId` with the new plan ID
2. **Single Plan Enforcement**: System ensures each user has exactly one active diet plan by deactivating previous plans before creating new ones
3. **Diet Plan Caching**: Store received plans in MongoDB with user association through `activePlans` record, including expiration and refresh mechanisms
4. **Daily Nutrition Access**: Endpoint (`GET /api/nutrition/daily`) returning user's single active diet plan with meal recommendations
5. **Nutrition Library**: Endpoint (`GET /api/nutrition/library`) aggregating external service data with dietary preference options
6. **External Service Integration**: Error handling with circuit breaker pattern and fallback to user's cached active diet plan
7. **Plan Refresh Management**: Automated refresh mechanism that regenerates diet plans every 2 weeks based on current user parameters, maintaining single active plan per user
8. **Data Validation**: Service response validation ensuring nutrition data integrity before storage and user association
9. **Automated Plan Management**: Fully automated diet plan creation and storage without user modification capabilities
10. **Active Plans Maintenance**: Proper management of user's `activePlans.dietPlanId` reference with cleanup of inactive plans

## Story 4.3: Meal Detection Service Integration

As a **meal tracking system**,
I want **reliable integration with external meal detection service with meal history and correction capabilities**,
so that **I can process meal images, store scan history with pictures, and allow users to reuse or correct previous meal detections**.

### Acceptance Criteria:
1. **Meal Detection**: Endpoint (`POST /api/integrations/meal-detection`) sending meal images to external AI service and receiving nutrition analysis
2. **Meal Upload with Storage**: Endpoint (`POST /api/nutrition/upload-meal`) processing images through external service and storing both the image and detected nutrition data
3. **Meal History Retrieval**: Endpoint (`GET /api/nutrition/meal-history`) returning user's previous meal scans with images and nutrition data for reuse
4. **Meal Reuse**: Endpoint (`POST /api/nutrition/log-previous-meal`) allowing users to log a meal from their history without re-scanning
5. **Meal Correction**: Endpoint (`POST /api/nutrition/correct-meal`) accepting user corrections for a specific meal and triggering re-analysis of that meal only
6. **Meal Re-analysis**: System capability to re-analyze specific meals based on user corrections and update only that meal's macro data
7. **External Service Integration**: Error handling with retry logic and fallback to manual meal entry options
8. **Service Rate Limiting**: Request optimization to manage external API costs and usage quotas

## Story 4.4: 3D Scanning Service Integration and Avatar Management

As a **body composition tracking system**,
I want **seamless integration with external 3D scanning service for avatar generation**,
so that **I can process InBody scan data and manage 3D avatar files efficiently**.

### Acceptance Criteria:
1. 3D scan processing endpoint (`POST /api/integrations/3d-scan`) sending body measurement data to external service and receiving generated avatar files
2. Avatar file management system storing received 3D files in AWS S3 with CDN integration for optimized delivery
3. Scan data processing endpoint (`POST /api/scans/upload`) handling InBody scan uploads and triggering external service integration
4. Avatar URL storage in user profiles with version tracking for progress comparison capabilities
5. External service error handling with retry mechanisms and fallback avatar generation options
6. Avatar file optimization and compression pipeline for mobile app performance optimization
7. Service response validation ensuring avatar file integrity and format compliance before storage
8. Scan history management providing chronological avatar tracking and progress visualization data
