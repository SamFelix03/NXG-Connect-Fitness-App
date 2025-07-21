# Body Metrics & Health Data Management API Documentation

## Overview

This document provides comprehensive documentation for the Body Metrics and Health Data Management endpoints implemented in Story 2.2. These endpoints allow administrators to manage user body metrics, track health data history, and control privacy settings with GDPR compliance.

**Base URL**: `http://localhost:3000/api`

**Authentication**: All endpoints require admin authentication via JWT Bearer token

---

## Table of Contents

1. [Body Metrics Management](#body-metrics-management)
   - [Get Current Body Metrics](#get-current-body-metrics)
   - [Update Body Metrics](#update-body-metrics)
   - [Get Body Metrics History](#get-body-metrics-history)

2. [Privacy & Health Data Management](#privacy--health-data-management)
   - [Get Privacy Settings](#get-privacy-settings)
   - [Update Privacy Settings](#update-privacy-settings)
   - [Export Health Data](#export-health-data)

3. [Data Models](#data-models)
4. [Error Handling](#error-handling)
5. [Validation Rules](#validation-rules)

---

## Body Metrics Management

### Get Current Body Metrics

Retrieves the current body metrics for a user, including calculated BMI, BMI category, and BMR.

**Endpoint**: `GET /api/users/:userId/body-metrics`

**Authentication**: Admin only

**URL Parameters**:
- `userId` (string, required): The ID of the user

**Response**:
```json
{
  "success": true,
  "message": "Body metrics retrieved successfully",
  "data": {
    "demographics": {
      "age": 28,
      "heightCm": 180,
      "weightKg": 76,
      "gender": "Male",
      "targetWeightKg": 75,
      "bmi": 23.46,
      "allergies": ["None"],
      "activityLevel": "3 - 5 hours a day"
    },
    "bodyComposition": {
      "bodyAge": 30,
      "fatMassKg": 14,
      "skeletalMuscleMassKg": 35,
      "rohrerIndex": 14.2,
      "bodyFatPercentage": 18,
      "waistToHipRatio": 0.85,
      "visceralFatAreaCm2": 80,
      "visceralFatLevel": 8,
      "subcutaneousFatMassKg": 15,
      "extracellularWaterL": 25,
      "bodyCellMassKg": 40,
      "bcmToEcwRatio": 1,
      "ecwToTbwRatio": 0.45,
      "tbwToFfmRatio": 0.75,
      "basalMetabolicRateKcal": 1811,
      "proteinGrams": 12000,
      "mineralsMg": 3500
    },
    "currentMacros": {
      "calories": "1800",
      "carbs": "200g",
      "protein": "120g",
      "fat": "55g",
      "fiber": "25g",
      "validTill": "2025-07-27T23:59:59.000Z"
    },
    "calculated": {
      "bmi": 23.46,
      "bmiCategory": "Normal weight",
      "bmr": 1811
    }
  }
}
```

**Error Responses**:
```json
{
  "success": false,
  "message": "User not found",
  "code": "USER_NOT_FOUND"
}
```

---

### Update Body Metrics

Updates the body metrics for a user and automatically creates a history record.

**Endpoint**: `PUT /api/users/:userId/body-metrics`

**Authentication**: Admin only

**URL Parameters**:
- `userId` (string, required): The ID of the user

**Request Body**:
```json
{
  "demographics": {
    "weightKg": 78,
    "heightCm": 180,
    "age": 28,
    "gender": "Male",
    "targetWeightKg": 75,
    "allergies": ["None"],
    "activityLevel": "3 - 5 hours a day"
  },
  "bodyComposition": {
    "bodyAge": 30,
    "fatMassKg": 16,
    "skeletalMuscleMassKg": 35,
    "rohrerIndex": 14.2,
    "bodyFatPercentage": 20,
    "waistToHipRatio": 0.85,
    "visceralFatAreaCm2": 80,
    "visceralFatLevel": 8,
    "subcutaneousFatMassKg": 15,
    "extracellularWaterL": 25,
    "bodyCellMassKg": 40,
    "bcmToEcwRatio": 1,
    "ecwToTbwRatio": 0.45,
    "tbwToFfmRatio": 0.75,
    "basalMetabolicRateKcal": 1838,
    "proteinGrams": 12000,
    "mineralsMg": 3500
  },
  "notes": "Updated after workout session"
}
```

**Response**:
```json
{
  "success": true,
  "message": "Body metrics updated successfully",
  "data": {
    "demographics": {
      "age": 28,
      "heightCm": 180,
      "weightKg": 78,
      "gender": "Male",
      "targetWeightKg": 75,
      "bmi": 24.07,
      "allergies": ["None"],
      "activityLevel": "3 - 5 hours a day"
    },
    "bodyComposition": {
      "bodyAge": 30,
      "fatMassKg": 16,
      "skeletalMuscleMassKg": 35,
      "rohrerIndex": 14.2,
      "bodyFatPercentage": 20,
      "waistToHipRatio": 0.85,
      "visceralFatAreaCm2": 80,
      "visceralFatLevel": 8,
      "subcutaneousFatMassKg": 15,
      "extracellularWaterL": 25,
      "bodyCellMassKg": 40,
      "bcmToEcwRatio": 1,
      "ecwToTbwRatio": 0.45,
      "tbwToFfmRatio": 0.75,
      "basalMetabolicRateKcal": 1838,
      "proteinGrams": 12000,
      "mineralsMg": 3500
    },
    "calculated": {
      "bmi": 24.07,
      "bmiCategory": "Normal weight",
      "bmr": 1838
    },
    "validation": {
      "isValid": true,
      "warnings": []
    }
  }
}
```

**Validation Error Response**:
```json
{
  "error": {
    "message": "Validation failed",
    "code": "VALIDATION",
    "timestamp": "2025-07-20T22:53:47.242Z",
    "correlationId": "a9339fbf-0282-430b-a45e-6c1b7480698d",
    "details": {
      "body.demographics.weightKg": "\"demographics.weightKg\" must be greater than or equal to 20",
      "body.bodyComposition.bodyFatPercentage": "\"bodyComposition.bodyFatPercentage\" must be less than or equal to 100"
    }
  }
}
```

---

### Get Body Metrics History

Retrieves the historical body metrics for a user with filtering and progress calculation.

**Endpoint**: `GET /api/users/:userId/body-metrics/history`

**Authentication**: Admin only

**URL Parameters**:
- `userId` (string, required): The ID of the user

**Query Parameters**:
- `startDate` (string, optional): Start date for filtering (ISO 8601 format)
- `endDate` (string, optional): End date for filtering (ISO 8601 format)
- `page` (number, optional): Page number for pagination (default: 1)
- `limit` (number, optional): Number of records per page (default: 20, max: 100)

**Example Request**:
```
GET /api/users/687d5f17411050e8d9b69860/body-metrics/history?startDate=2025-07-20T00:00:00Z&endDate=2025-07-20T23:59:59Z&page=1&limit=10
```

**Response**:
```json
{
  "success": true,
  "message": "Body metrics history retrieved successfully",
  "data": {
    "history": [
      {
        "_id": "687d73479efe9d42ea2d63c5",
        "userId": "687d5f17411050e8d9b69860",
        "recordedAt": "2025-07-20T22:52:55.962Z",
        "demographics": {
          "heightCm": 180,
          "weightKg": 76,
          "age": 28,
          "targetWeightKg": 75,
          "bmi": 23.46
        },
        "bodyComposition": {
          "bodyAge": 30,
          "fatMassKg": 14,
          "skeletalMuscleMassKg": 35,
          "rohrerIndex": 14.2,
          "bodyFatPercentage": 18,
          "waistToHipRatio": 0.85,
          "visceralFatAreaCm2": 80,
          "visceralFatLevel": 8,
          "subcutaneousFatMassKg": 15,
          "extracellularWaterL": 25,
          "bodyCellMassKg": 40,
          "bcmToEcwRatio": 1,
          "ecwToTbwRatio": 0.45,
          "tbwToFfmRatio": 0.75,
          "basalMetabolicRateKcal": 1811,
          "proteinGrams": 12000,
          "mineralsMg": 3500
        },
        "source": "manual",
        "notes": "Weekly progress check",
        "createdAt": "2025-07-20T22:52:55.964Z",
        "updatedAt": "2025-07-20T22:52:55.964Z"
      }
    ],
    "progress": {
      "weightChange": -2,
      "weightChangePercent": -2.56,
      "bodyFatChange": -2,
      "bodyFatChangePercent": -10,
      "muscleMassChange": 0,
      "muscleMassChangePercent": 0,
      "bmiChange": -0.61
    },
    "pagination": {
      "currentPage": 1,
      "totalPages": 1,
      "totalCount": 2,
      "hasNext": false,
      "hasPrev": false
    }
  }
}
```

---

## Privacy & Health Data Management

### Get Privacy Settings

Retrieves the privacy settings for a user.

**Endpoint**: `GET /api/users/:userId/privacy`

**Authentication**: Admin only

**URL Parameters**:
- `userId` (string, required): The ID of the user

**Response**:
```json
{
  "success": true,
  "message": "Privacy settings retrieved successfully",
  "data": {
    "privacySettings": {
      "shareBasicMetrics": true,
      "shareBodyComposition": false,
      "shareHealthConditions": false,
      "shareProgressPhotos": false,
      "shareWorkoutData": true,
      "shareNutritionData": false,
      "profileVisibility": "friends",
      "allowHealthDataExport": true
    }
  }
}
```

---

### Update Privacy Settings

Updates the privacy settings for a user.

**Endpoint**: `PUT /api/users/:userId/privacy`

**Authentication**: Admin only

**URL Parameters**:
- `userId` (string, required): The ID of the user

**Request Body**:
```json
{
  "shareBasicMetrics": false,
  "shareBodyComposition": true,
  "shareHealthConditions": false,
  "shareProgressPhotos": false,
  "shareWorkoutData": true,
  "shareNutritionData": false,
  "profileVisibility": "private",
  "allowHealthDataExport": false
}
```

**Response**:
```json
{
  "success": true,
  "message": "Privacy settings updated successfully",
  "data": {
    "privacySettings": {
      "shareBasicMetrics": false,
      "shareBodyComposition": true,
      "shareHealthConditions": false,
      "shareProgressPhotos": false,
      "shareWorkoutData": true,
      "shareNutritionData": false,
      "profileVisibility": "private",
      "allowHealthDataExport": false
    }
  }
}
```

---

### Export Health Data

Exports comprehensive health data for GDPR compliance.

**Endpoint**: `GET /api/users/:userId/health-data/export`

**Authentication**: Admin only

**URL Parameters**:
- `userId` (string, required): The ID of the user

**Response** (when export is allowed):
```json
{
  "success": true,
  "message": "Health data exported successfully",
  "data": {
    "exportedAt": "2025-07-20T22:53:33.125Z",
    "userId": "687d56a3a4ae180f2c1458e9",
    "userInfo": {
      "username": "admin_test2",
      "email": "admin2@test.com",
      "name": "Admin User",
      "createdAt": "2025-07-20T20:50:43.833Z"
    },
    "currentData": {
      "demographics": {
        "allergies": []
      },
      "fitnessProfile": {
        "healthConditions": []
      },
      "bodyComposition": {},
      "currentMacros": {},
      "activePlans": {}
    },
    "privacySettings": {
      "allowHealthDataExport": true,
      "profileVisibility": "friends",
      "shareBasicMetrics": true,
      "shareBodyComposition": false,
      "shareHealthConditions": false,
      "shareNutritionData": false,
      "shareProgressPhotos": false,
      "shareWorkoutData": true
    },
    "bodyMetricsHistory": [],
    "exportMetadata": {
      "totalHistoryRecords": 0,
      "dateRange": null
    }
  }
}
```

**Error Response** (when export is not allowed):
```json
{
  "success": false,
  "message": "Health data export is not allowed by user privacy settings",
  "code": "EXPORT_NOT_ALLOWED"
}
```

---

## Data Models

### Demographics Schema

```typescript
interface Demographics {
  age?: number;                    // 13-120 years
  heightCm?: number;               // 50-300 cm
  weightKg?: number;               // 20-500 kg
  gender?: 'Male' | 'Female' | 'Other';
  targetWeightKg?: number;         // 20-500 kg
  bmi?: number;                    // Calculated automatically
  allergies?: string[];            // Array of allergies
  activityLevel?: string;          // Activity level description
}
```

### Body Composition Schema

```typescript
interface BodyComposition {
  bodyAge?: number;                // 10-120 years
  fatMassKg?: number;              // 0-200 kg
  skeletalMuscleMassKg?: number;   // 0-100 kg
  rohrerIndex?: number;            // 5-30
  bodyFatPercentage?: number;      // 0-100%
  waistToHipRatio?: number;        // 0.5-2.0
  visceralFatAreaCm2?: number;     // 0-500 cm²
  visceralFatLevel?: number;       // 1-30
  subcutaneousFatMassKg?: number;  // 0-100 kg
  extracellularWaterL?: number;    // 0-50 L
  bodyCellMassKg?: number;         // 0-100 kg
  bcmToEcwRatio?: number;          // 0-5
  ecwToTbwRatio?: number;          // 0-1
  tbwToFfmRatio?: number;          // 0-1
  basalMetabolicRateKcal?: number; // 800-5000 kcal
  proteinGrams?: number;           // 0-50000 g
  mineralsMg?: number;             // 0-10000 mg
}
```

### Privacy Settings Schema

```typescript
interface PrivacySettings {
  shareBasicMetrics: boolean;      // Share basic fitness metrics
  shareBodyComposition: boolean;   // Share detailed body composition
  shareHealthConditions: boolean;  // Share health conditions
  shareProgressPhotos: boolean;    // Share progress photos
  shareWorkoutData: boolean;       // Share workout data
  shareNutritionData: boolean;     // Share nutrition data
  profileVisibility: 'public' | 'friends' | 'private';
  allowHealthDataExport: boolean;  // Allow GDPR data export
}
```

### Body Metrics History Schema

```typescript
interface BodyMetricsHistory {
  _id: string;
  userId: string;
  recordedAt: Date;
  demographics?: Demographics;
  bodyComposition?: BodyComposition;
  source: 'manual' | 'body_scan' | 'smart_scale' | 'fitness_assessment' | 'admin_entry';
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}
```

---

## Error Handling

### Common Error Responses

**Authentication Error**:
```json
{
  "success": false,
  "message": "Invalid access token",
  "code": "AUTHENTICATION_FAILED"
}
```

**Authorization Error**:
```json
{
  "success": false,
  "message": "Insufficient permissions. Admin access required.",
  "code": "INSUFFICIENT_PERMISSIONS",
  "details": {
    "required": ["admin"],
    "current": "user"
  }
}
```

**User Not Found**:
```json
{
  "success": false,
  "message": "User not found",
  "code": "USER_NOT_FOUND"
}
```

**Validation Error**:
```json
{
  "success": false,
  "message": "Validation failed",
  "code": "VALIDATION_ERROR",
  "errors": {
    "field": "Error message"
  }
}
```

**Internal Server Error**:
```json
{
  "success": false,
  "message": "Internal server error",
  "code": "INTERNAL_ERROR"
}
```

---

## Validation Rules

### Demographics Validation

| Field | Type | Range | Required |
|-------|------|-------|----------|
| `age` | number | 13-120 | No |
| `heightCm` | number | 50-300 | No |
| `weightKg` | number | 20-500 | No |
| `gender` | string | 'Male', 'Female', 'Other' | No |
| `targetWeightKg` | number | 20-500 | No |
| `allergies` | array | string[] | No |
| `activityLevel` | string | any | No |

### Body Composition Validation

| Field | Type | Range | Required |
|-------|------|-------|----------|
| `bodyAge` | number | 10-120 | No |
| `fatMassKg` | number | 0-200 | No |
| `skeletalMuscleMassKg` | number | 0-100 | No |
| `rohrerIndex` | number | 5-30 | No |
| `bodyFatPercentage` | number | 0-100 | No |
| `waistToHipRatio` | number | 0.5-2.0 | No |
| `visceralFatAreaCm2` | number | 0-500 | No |
| `visceralFatLevel` | number | 1-30 | No |
| `subcutaneousFatMassKg` | number | 0-100 | No |
| `extracellularWaterL` | number | 0-50 | No |
| `bodyCellMassKg` | number | 0-100 | No |
| `bcmToEcwRatio` | number | 0-5 | No |
| `ecwToTbwRatio` | number | 0-1 | No |
| `tbwToFfmRatio` | number | 0-1 | No |
| `basalMetabolicRateKcal` | number | 800-5000 | No |
| `proteinGrams` | number | 0-50000 | No |
| `mineralsMg` | number | 0-10000 | No |

### Privacy Settings Validation

| Field | Type | Values | Required |
|-------|------|--------|----------|
| `shareBasicMetrics` | boolean | true/false | No |
| `shareBodyComposition` | boolean | true/false | No |
| `shareHealthConditions` | boolean | true/false | No |
| `shareProgressPhotos` | boolean | true/false | No |
| `shareWorkoutData` | boolean | true/false | No |
| `shareNutritionData` | boolean | true/false | No |
| `profileVisibility` | string | 'public', 'friends', 'private' | No |
| `allowHealthDataExport` | boolean | true/false | No |

### Query Parameters Validation

| Parameter | Type | Range | Default |
|-----------|------|-------|---------|
| `page` | number | ≥ 1 | 1 |
| `limit` | number | 1-100 | 20 |
| `startDate` | string | ISO 8601 format | - |
| `endDate` | string | ISO 8601 format, ≥ startDate | - |

---

## Usage Examples

### Complete Workflow Example

1. **Get current body metrics**:
```bash
curl -X GET "http://localhost:3000/api/users/687d5f17411050e8d9b69860/body-metrics" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json"
```

2. **Update body metrics**:
```bash
curl -X PUT "http://localhost:3000/api/users/687d5f17411050e8d9b69860/body-metrics" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "demographics": {
      "weightKg": 78
    },
    "bodyComposition": {
      "bodyFatPercentage": 20,
      "fatMassKg": 16
    },
    "notes": "Updated after workout session"
  }'
```

3. **Get body metrics history**:
```bash
curl -X GET "http://localhost:3000/api/users/687d5f17411050e8d9b69860/body-metrics/history?page=1&limit=10" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json"
```

4. **Update privacy settings**:
```bash
curl -X PUT "http://localhost:3000/api/users/687d5f17411050e8d9b69860/privacy" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "shareBasicMetrics": false,
    "shareBodyComposition": true,
    "profileVisibility": "private",
    "allowHealthDataExport": false
  }'
```

5. **Export health data** (if allowed):
```bash
curl -X GET "http://localhost:3000/api/users/687d5f17411050e8d9b69860/health-data/export" \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json"
```

---

## Notes

- All endpoints require admin authentication
- BMI and BMR are calculated automatically when height, weight, age, and gender are provided
- History records are created automatically when body metrics are updated
- Progress calculation requires at least 2 history records
- Health data export respects user privacy settings
- All timestamps are in ISO 8601 format
- Pagination is 1-based (page 1 is the first page)
- Date filtering supports ISO 8601 format for startDate and endDate 