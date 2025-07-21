# External APIs

## Workout Planning Service API

- **Purpose:** Retrieve personalized workout plans based on user profile and goals
- **Documentation:** [External service documentation URL]
- **Base URL:** https://api.workout-service.com/v1
- **Authentication:** API Key authentication via headers
- **Rate Limits:** 1000 requests per hour per API key

**Key Endpoints Used:**
- `POST /plans/generate` - Generate personalized workout plan
- `GET /exercises/library` - Retrieve exercise database
- `POST /plans/customize` - Modify existing workout plans

**Integration Notes:** Implement retry logic with exponential backoff, cache responses for 24 hours, fallback to cached plans on service unavailability

## Meal Detection Service API

- **Purpose:** Analyze meal images and extract nutrition information
- **Documentation:** [External service documentation URL]
- **Base URL:** https://api.meal-detection.com/v1
- **Authentication:** Bearer token authentication
- **Rate Limits:** 500 requests per hour per token

**Key Endpoints Used:**
- `POST /analyze/image` - Analyze meal photo and extract nutrition data
- `GET /confidence/score` - Retrieve confidence scoring for detection
- `POST /correction/feedback` - Submit user corrections for model improvement

**Integration Notes:** Handle low-confidence results with user verification prompts, implement image compression before sending, cache results by image hash

## Nutrition Planning Service API

- **Purpose:** Generate personalized meal plans based on dietary preferences and macro targets
- **Documentation:** [External service documentation URL]
- **Base URL:** https://api.nutrition-planner.com/v1
- **Authentication:** API Key with HMAC signature
- **Rate Limits:** 2000 requests per day per API key

**Key Endpoints Used:**
- `POST /plans/generate` - Create personalized meal plans
- `GET /foods/database` - Access comprehensive food database
- `POST /macros/calculate` - Calculate optimal macro distribution

**Integration Notes:** Refresh meal plans weekly or on goal changes, cache food database locally for performance, implement request signing for security

## 3D Scanning Service API

- **Purpose:** Process InBody scan data and generate 3D avatars
- **Documentation:** [External service documentation URL]
- **Base URL:** https://api.3d-scanning.com/v1
- **Authentication:** OAuth 2.0 with client credentials
- **Rate Limits:** 100 scan processing requests per hour

**Key Endpoints Used:**
- `POST /scans/process` - Process InBody scan data
- `POST /avatars/generate` - Generate 3D avatar from measurements
- `GET /processing/status` - Check scan processing status

**Integration Notes:** Implement asynchronous processing with webhooks, store avatar files in S3, handle large file uploads with multipart uploads
