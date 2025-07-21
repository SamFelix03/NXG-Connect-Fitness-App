# Database Schema

all the MongoDB collections in JSON format with sample values:

## **1. users**
```json
{
  "_id": ObjectId("65a1b2c3d4e5f6789abc3001"),
  "username": "john_doe_25",
  "email": "john.doe@email.com",
  "passwordHash": "$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewdBw9B9HlO7wq5K",
  "name": "John Doe",
  "isActive": true,
  "emailVerified": true,
  "lastLogin": ISODate("2025-07-19T10:30:00Z"),
  "demographics": {
    "age": 25,
    "heightCm": 175,
    "weightKg": 105.0,
    "gender": "Male",
    "targetWeightKg": 74.27,
    "bmi": 30.68,
    "allergies": ["None"],
    "activityLevel": "0 - 2 hours a day"
  },
  "fitnessProfile": {
    "level": "advanced",
    "restDay": "Thursday",
    "goal": "weight_loss",
    "goalWeightDiff": -5,
    "healthConditions": ["none"]
  },
  "dietPreferences": {
    "cuisinePreferences": {
      "Indian": ["Non-Veg", "Veg"],
      "RegionAndState": ["South Indian", "Kerala"]
    }
  },
  "bodyComposition": {
    "bodyAge": 32,
    "fatMassKg": 25,
    "skeletalMuscleMassKg": 25,
    "rohrerIndex": 15.8,
    "bodyFatPercentage": 29,
    "waistToHipRatio": 0.9,
    "visceralFatAreaCm2": 120,
    "visceralFatLevel": 14,
    "subcutaneousFatMassKg": 20,
    "extracellularWaterL": 20,
    "bodyCellMassKg": 35,
    "bcmToEcwRatio": 0.9,
    "ecwToTbwRatio": 0.4,
    "tbwToFfmRatio": 0.73,
    "basalMetabolicRateKcal": 1800,
    "proteinGrams": 10500,
    "mineralsMg": 3000
  },
  "activePlans": {
    "workoutPlanId": ObjectId("65a1b2c3d4e5f6789abc4001"),
    "dietPlanId": ObjectId("65a1b2c3d4e5f6789abc5001")
  },
  "branches": [
    {
      "branchId": ObjectId("65a1b2c3d4e5f6789abc0001"),
      "branchName": "NXG Downtown Chennai",
      "joinedAt": ISODate("2025-01-15T09:00:00Z")
    }
  ],
  "currentMacros": {
    "calories": "1850",
    "carbs": "223g",
    "protein": "119g",
    "fat": "58g",
    "fiber": "26g",
    "validTill": ISODate("2025-07-26T23:59:59Z")
  },
  "totalPoints": 1250,
  "createdAt": ISODate("2025-01-15T09:00:00Z"),
  "updatedAt": ISODate("2025-07-19T14:30:00Z")
}
```

## **2. branches**
```json
{
  "_id": ObjectId("65a1b2c3d4e5f6789abc0001"),
  "name": "NXG Downtown Chennai",
  "address": "123 Anna Salai, Teynampet, Chennai",
  "city": "Chennai",
  "contactNumber": "+91-9876543210",
  "machines": [
    {
      "_id": ObjectId("65a1b2c3d4e5f6789abc1001"),
      "name": "Bench Press Station #1",
      "description": "Olympic bench press with safety bars",
      "location": "Free weights area",
      "type": "strength",
      "modelNumber": "BP-2024",
      "qrCode": "NXG-BP-001",
      "imageUrl": "https://storage.nxg.com/machines/bench1.jpg",
      "isAvailable": true,
      "lastMaintenance": ISODate("2025-07-01T00:00:00Z")
    }
  ],
  "stats": {
    "totalMembers": 450,
    "totalMachines": 85,
    "peakHours": ["18:00-20:00", "06:00-08:00"]
  },
  "createdAt": ISODate("2025-01-01T00:00:00Z")
}
```

## **3. exercises**
```json
{
  "_id": ObjectId("65a1b2c3d4e5f6789abc2001"),
  "name": "Bench Press",
  "description": "Compound chest exercise performed lying on a bench",
  "type": "Core",
  "machines": [
    {
      "machineId": ObjectId("65a1b2c3d4e5f6789abc1001"),
      "machineName": "Bench Press Station #1",
      "usageInstructions": "Adjust bench to flat position, set safety bars"
    }
  ],
  "metadata": {
    "muscleGroups": ["Chest", "Triceps", "Shoulders"],
    "difficulty": "intermediate",
    "equipment": ["barbell", "bench"],
    "instructions": [
      "Lie flat on bench with feet on floor",
      "Grip bar with hands slightly wider than shoulders",
      "Lower bar to chest with control",
      "Press bar up explosively"
    ]
  },
  "createdAt": ISODate("2025-01-01T00:00:00Z")
}
```

## **4. workoutPlans**
```json
{
  "_id": ObjectId("65a1b2c3d4e5f6789abc4001"),
  "userId": ObjectId("65a1b2c3d4e5f6789abc3001"),
  "planName": "Advanced Muscle Building",
  "isActive": true,
  "workoutDays": [
    {
      "muscleGroup": "Chest",
      "dayOrder": 1,
      "categories": [
        {
          "categoryType": "Warmup",
          "categoryOrder": 1,
          "exercises": [
            {
              "exerciseId": ObjectId("65a1b2c3d4e5f6789abc2001"),
              "exerciseName": "Dynamic Chest Stretch",
              "sets": 2,
              "reps": 15,
              "seconds": null,
              "exerciseOrder": 1
            }
          ]
        },
        {
          "categoryType": "Core",
          "categoryOrder": 2,
          "exercises": [
            {
              "exerciseId": ObjectId("65a1b2c3d4e5f6789abc2002"),
              "exerciseName": "Bench Press",
              "sets": 4,
              "reps": 8,
              "seconds": null,
              "exerciseOrder": 1
            }
          ]
        }
      ]
    }
  ],
  "createdAt": ISODate("2025-07-15T10:00:00Z"),
  "updatedAt": ISODate("2025-07-19T14:30:00Z")
}
```

## **5. dietPlans**
```json
{
  "_id": ObjectId("65a1b2c3d4e5f6789abc5001"),
  "userId": ObjectId("65a1b2c3d4e5f6789abc3001"),
  "planName": "Kerala Weight Loss Plan",
  "targetWeightKg": 74.27,
  "totalMacros": {
    "calories": "1850",
    "carbs": "223g",
    "protein": "119g",
    "fat": "58g",
    "fiber": "26g"
  },
  "mealPlan": [
    {
      "day": 1,
      "dayName": "Monday",
      "meals": [
        {
          "mealType": "Breakfast",
          "mealDescription": "3 pieces Kozhukatta (150g) with 100ml Coconut Milk and 1 medium Banana (120g)",
          "shortName": "Kozhukatta, Coconut Milk, Banana",
          "calories": 350,
          "mealOrder": 1
        },
        {
          "mealType": "Lunch",
          "mealDescription": "150g Rice with 100ml Koorka Fry and 100ml Sambar",
          "shortName": "Rice, Koorka Fry, Sambar",
          "calories": 520,
          "mealOrder": 2
        }
      ]
    }
  ],
  "isActive": true,
  "createdAt": ISODate("2025-07-15T10:00:00Z")
}
```

## **6. gymSessions**
```json
{
  "_id": ObjectId("65a1b2c3d4e5f6789abca001"),
  "userId": ObjectId("65a1b2c3d4e5f6789abc3001"),
  "branchId": ObjectId("65a1b2c3d4e5f6789abc0001"),
  "branchName": "NXG Downtown Chennai",
  "checkInTime": ISODate("2025-07-19T09:00:00Z"),
  "checkOutTime": ISODate("2025-07-19T11:30:00Z"),
  "sessionDuration": 150,
  "status": "completed",
  "plannedWorkout": {
    "workoutPlanId": ObjectId("65a1b2c3d4e5f6789abc4001"),
    "plannedMuscleGroup": "Chest",
    "estimatedDuration": 120
  },
  "actualWorkout": {
    "completedExercises": [
      {
        "exerciseId": ObjectId("65a1b2c3d4e5f6789abc2002"),
        "exerciseName": "Bench Press",
        "categoryType": "Core",
        "sets": 4,
        "reps": 8,
        "seconds": null,
        "startTime": ISODate("2025-07-19T09:25:00Z"),
        "endTime": ISODate("2025-07-19T10:10:00Z"),
        "machineId": ObjectId("65a1b2c3d4e5f6789abc1001"),
        "machineName": "Bench Press Station #1",
        "weightUsed": 80,
        "speed": null,
        "incline": null,
        "notes": "Increased weight by 5kg from last session"
      }
    ],
    "totalExercises": 2,
    "totalSets": 6,
    "caloriesBurned": 420,
    "avgHeartRate": 145,
    "maxHeartRate": 168
  },
  "machinesUsed": [
    {
      "machineId": ObjectId("65a1b2c3d4e5f6789abc1001"),
      "machineName": "Bench Press Station #1",
      "usageStartTime": ISODate("2025-07-19T09:25:00Z"),
      "usageEndTime": ISODate("2025-07-19T10:10:00Z"),
      "usageDuration": 45
    }
  ],
  "sessionType": "regular",
  "companionUsers": [],
  "trainerAssigned": null,
  "userRating": 4,
  "sessionFeedback": "Great workout! Increased bench press weight.",
  "geoLocation": {
    "latitude": 13.0827,
    "longitude": 80.2707,
    "accuracy": 10
  },
  "pointsEarned": 75,
  "achievementsUnlocked": ["First Chest Day Complete"],
  "createdAt": ISODate("2025-07-19T09:00:00Z"),
  "updatedAt": ISODate("2025-07-19T11:30:00Z")
}
```

## **7. userActivity**
```json
{
  "_id": ObjectId("65a1b2c3d4e5f6789abc6001"),
  "userId": ObjectId("65a1b2c3d4e5f6789abc3001"),
  "date": ISODate("2025-07-19T00:00:00Z"),
  "workoutActivity": {
    "assignedWorkouts": 5,
    "completedWorkouts": 4,
    "completionPercentage": 80,
    "workoutHistory": [
      {
        "exerciseId": ObjectId("65a1b2c3d4e5f6789abc2002"),
        "exerciseName": "Bench Press",
        "machineId": ObjectId("65a1b2c3d4e5f6789abc1001"),
        "completedSets": 4,
        "completedReps": 8,
        "completedSeconds": null,
        "performanceNotes": "Increased weight by 5kg",
        "completedAt": ISODate("2025-07-19T10:30:00Z")
      }
    ]
  },
  "dietActivity": {
    "scheduledMeals": 5,
    "completedMeals": 4,
    "mealHistory": [
      {
        "mealType": "Breakfast",
        "mealDescription": "Kozhukatta with coconut milk",
        "consumedAt": ISODate("2025-07-19T08:00:00Z"),
        "wasOnSchedule": true,
        "notes": "Delicious as always"
      }
    ],
    "uploadedMeals": [
      {
        "imageUrl": "https://storage.nxg.com/meals/user123/meal456.jpg",
        "calories": 350,
        "macros": {
          "carbs": 45,
          "fat": 12,
          "protein": 15,
          "fiber": 8
        },
        "uploadedAt": ISODate("2025-07-19T12:30:00Z"),
        "aiVersion": "v2.1",
        "mealDetected": "Rice and Curry",
        "isVerified": true
      }
    ]
  },
  "pointsEarned": [
    {
      "points": 50,
      "reason": "Completed workout",
      "awardedAt": ISODate("2025-07-19T11:00:00Z")
    }
  ]
}
```

## **8. scan3d**
```json
{
  "_id": ObjectId("65a1b2c3d4e5f6789abc7001"),
  "userId": ObjectId("65a1b2c3d4e5f6789abc3001"),
  "scanDate": ISODate("2025-07-19T00:00:00Z"),
  "scans": {
    "original": {
      "scanUrl": "https://storage.nxg.com/scans/user123/original_20250719.obj",
      "uploadedAt": ISODate("2025-07-19T09:00:00Z"),
      "fileSize": 15728640,
      "metadata": {
        "deviceUsed": "iPhone 15 Pro",
        "scanQuality": "high"
      }
    },
    "measurement": {
      "scanUrl": "https://storage.nxg.com/scans/user123/measurement_20250719.obj",
      "generatedAt": ISODate("2025-07-19T09:15:00Z"),
      "aiModelVersion": "v3.2",
      "measurements": {
        "chest": 102.5,
        "waist": 85.2,
        "arms": 35.8,
        "thighs": 58.3
      }
    },
    "tripo": {
      "scanUrl": "https://storage.nxg.com/scans/user123/tripo_20250719.obj",
      "generatedAt": ISODate("2025-07-19T09:30:00Z"),
      "tripoVersion": "v1.8"
    }
  },
  "notes": "Great progress visible in scan quality",
  "processingStatus": "completed"
}
```

## **9. userSessions**
```json
{
  "_id": ObjectId("65a1b2c3d4e5f6789abc8001"),
  "userId": ObjectId("65a1b2c3d4e5f6789abc3001"),
  "sessionToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.fake_jwt_token_here",
  "deviceInfo": {
    "deviceType": "iPhone 15",
    "os": "iOS 17.5",
    "appVersion": "2.1.0",
    "userAgent": "NXGFitness/2.1.0 (iOS 17.5)"
  },
  "networkInfo": {
    "ipAddress": "192.168.1.100",
    "location": {
      "city": "Chennai",
      "country": "India"
    }
  },
  "expiresAt": ISODate("2025-07-26T14:30:00Z"),
  "createdAt": ISODate("2025-07-19T14:30:00Z"),
  "lastAccessed": ISODate("2025-07-19T16:45:00Z")
}
```

## **10. passwordResetTokens**
```json
{
  "_id": ObjectId("65a1b2c3d4e5f6789abc9001"),
  "userId": ObjectId("65a1b2c3d4e5f6789abc3001"),
  "token": "reset_token_abc123def456ghi789jkl012mno345pqr678stu901vwx234yz567",
  "expiresAt": ISODate("2025-07-19T16:30:00Z"),
  "used": false,
  "createdAt": ISODate("2025-07-19T14:30:00Z")
}
```

---

## Key MongoDB Design Decisions

### 1. **Embedding vs Referencing**

**Embedded (for frequent reads):**
- User body composition metrics
- Workout plan structure (days → categories → exercises)
- Diet plan structure (days → meals)
- Machine inventory within branches
- Daily activity data

**Referenced (for large/changing data):**
- User → Workout Plans
- User → Diet Plans
- Exercise library (referenced by workout plans)
- 3D scans (separate due to large file sizes)

### 2. **Denormalization for Performance**
- Exercise names embedded in workout plans
- Branch names embedded in user profiles
- Machine names embedded in workout history

### 3. **Document Structure Optimization**
- Single document reads for complete workout plans
- Single document reads for weekly diet plans
- Time-series pattern for daily user activity

### 4. **Indexing Strategy**
```javascript
// Recommended indexes
db.users.createIndex({ "username": 1 }, { unique: true })
db.users.createIndex({ "email": 1 }, { unique: true })
db.userActivity.createIndex({ "userId": 1, "date": -1 })
db.workoutPlans.createIndex({ "userId": 1, "isActive": 1 })
db.dietPlans.createIndex({ "userId": 1, "isActive": 1 })
db.3dScans.createIndex({ "userId": 1, "scanDate": -1 })
db.userSessions.createIndex({ "sessionToken": 1 })
db.userSessions.createIndex({ "expiresAt": 1 }, { expireAfterSeconds: 0 })
```
