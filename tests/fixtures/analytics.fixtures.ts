import mongoose from 'mongoose';

export interface TestUser {
  _id: mongoose.Types.ObjectId;
  username: string;
  email: string;
  name: string;
  demographics?: {
    age: number;
    heightCm: number;
    weightKg: number;
    gender: string;
    targetWeightKg: number;
  };
  fitnessProfile?: {
    level: string;
    goal: string;
    restDay: string;
  };
  bodyComposition?: {
    bodyAge: number;
    bodyFatPercentage: number;
    basalMetabolicRateKcal: number;
  };
}

export interface TestGymSession {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  branchId: mongoose.Types.ObjectId;
  checkInTime: Date;
  checkOutTime: Date;
  sessionDuration: number;
  status: string;
  actualWorkout: {
    totalExercises: number;
    totalSets: number;
    caloriesBurned: number;
    avgHeartRate?: number;
    maxHeartRate?: number;
    completedExercises: Array<{
      exerciseId: mongoose.Types.ObjectId;
      exerciseName: string;
      sets: number;
      reps: number;
      weightUsed: number;
      startTime?: Date;
      endTime?: Date;
      notes?: string;
    }>;
  };
  pointsEarned: number;
}

export interface TestUserActivity {
  _id: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  date: Date;
  workoutActivity: {
    assignedWorkouts: number;
    completedWorkouts: number;
    completionPercentage: number;
    workoutHistory: Array<{
      exerciseId: mongoose.Types.ObjectId;
      exerciseName: string;
      completedSets: number;
      completedReps: number;
      performanceNotes?: string;
      completedAt: Date;
    }>;
  };
}

export interface TestExercise {
  _id: mongoose.Types.ObjectId;
  name: string;
  description: string;
  type: string;
  metadata: {
    muscleGroups: string[];
    difficulty: string;
    equipment: string[];
  };
}

export class AnalyticsTestFixtures {
  static createTestUser(overrides: Partial<TestUser> = {}): TestUser {
    return {
      _id: new mongoose.Types.ObjectId(),
      username: 'testuser123',
      email: 'test@example.com',
      name: 'Test User',
      demographics: {
        age: 25,
        heightCm: 175,
        weightKg: 75,
        gender: 'Male',
        targetWeightKg: 70
      },
      fitnessProfile: {
        level: 'intermediate',
        goal: 'strength',
        restDay: 'Sunday'
      },
      bodyComposition: {
        bodyAge: 25,
        bodyFatPercentage: 15,
        basalMetabolicRateKcal: 1800
      },
      ...overrides
    };
  }

  static createSimilarUsers(count: number, baseAge: number = 25): TestUser[] {
    return Array.from({ length: count }, (_, index) => 
      this.createTestUser({
        _id: new mongoose.Types.ObjectId(),
        username: `similaruser${index}`,
        email: `similar${index}@example.com`,
        name: `Similar User ${index}`,
        demographics: {
          age: baseAge + (index % 6) - 3, // Ages range from baseAge-3 to baseAge+2
          heightCm: 175 + (index % 10),
          weightKg: 75 + (index % 15),
          gender: index % 2 === 0 ? 'Male' : 'Female',
          targetWeightKg: 70 + (index % 10)
        }
      })
    );
  }

  static createTestExercises(): TestExercise[] {
    return [
      {
        _id: new mongoose.Types.ObjectId(),
        name: 'Bench Press',
        description: 'Compound chest exercise',
        type: 'Core',
        metadata: {
          muscleGroups: ['Chest', 'Triceps', 'Shoulders'],
          difficulty: 'intermediate',
          equipment: ['barbell', 'bench']
        }
      },
      {
        _id: new mongoose.Types.ObjectId(),
        name: 'Squat',
        description: 'Compound leg exercise',
        type: 'Core',
        metadata: {
          muscleGroups: ['Legs', 'Glutes', 'Core'],
          difficulty: 'intermediate',
          equipment: ['barbell']
        }
      },
      {
        _id: new mongoose.Types.ObjectId(),
        name: 'Deadlift',
        description: 'Compound full-body exercise',
        type: 'Core',
        metadata: {
          muscleGroups: ['Back', 'Legs', 'Glutes', 'Core'],
          difficulty: 'advanced',
          equipment: ['barbell']
        }
      },
      {
        _id: new mongoose.Types.ObjectId(),
        name: 'Pull-up',
        description: 'Upper body pulling exercise',
        type: 'Core',
        metadata: {
          muscleGroups: ['Back', 'Biceps'],
          difficulty: 'intermediate',
          equipment: ['pull-up bar']
        }
      }
    ];
  }

  static createProgressiveGymSessions(
    userId: mongoose.Types.ObjectId,
    exercises: TestExercise[],
    sessionCount: number = 10,
    startDate: Date = new Date('2025-01-01')
  ): TestGymSession[] {
    const sessions: TestGymSession[] = [];
    const branchId = new mongoose.Types.ObjectId();

    for (let i = 0; i < sessionCount; i++) {
      const sessionDate = new Date(startDate);
      sessionDate.setDate(startDate.getDate() + (i * 2)); // Every 2 days

      const benchPressExercise = exercises.find(e => e.name === 'Bench Press')!;
      const squatExercise = exercises.find(e => e.name === 'Squat')!;

      // Progressive overload - increase weight over time
      const baseWeight = i === 0 ? 60 : 60 + (i * 2.5);
      const squatWeight = i === 0 ? 80 : 80 + (i * 5);

      const session: TestGymSession = {
        _id: new mongoose.Types.ObjectId(),
        userId,
        branchId,
        checkInTime: new Date(sessionDate.getTime()),
        checkOutTime: new Date(sessionDate.getTime() + 90 * 60 * 1000), // 90 minutes
        sessionDuration: 90,
        status: 'completed',
        actualWorkout: {
          totalExercises: 2,
          totalSets: 8,
          caloriesBurned: 350 + (i * 10), // Progressive calorie burn
          avgHeartRate: 140 + (i * 2),
          maxHeartRate: 165 + (i * 2),
          completedExercises: [
            {
              exerciseId: benchPressExercise._id,
              exerciseName: 'Bench Press',
              sets: 4,
              reps: 8,
              weightUsed: baseWeight,
              startTime: new Date(sessionDate.getTime() + 10 * 60 * 1000),
              endTime: new Date(sessionDate.getTime() + 30 * 60 * 1000),
              notes: i > 5 ? 'Form improving' : 'Good session'
            },
            {
              exerciseId: squatExercise._id,
              exerciseName: 'Squat',
              sets: 4,
              reps: 8,
              weightUsed: squatWeight,
              startTime: new Date(sessionDate.getTime() + 40 * 60 * 1000),
              endTime: new Date(sessionDate.getTime() + 70 * 60 * 1000),
              notes: i > 7 ? 'Depth improved' : 'Solid workout'
            }
          ]
        },
        pointsEarned: 50 + (i * 5) // Progressive points
      };

      sessions.push(session);
    }

    return sessions;
  }

  static createUserActivityHistory(
    userId: mongoose.Types.ObjectId,
    sessions: TestGymSession[]
  ): TestUserActivity[] {
    const activities: TestUserActivity[] = [];
    const dateMap = new Map<string, TestGymSession[]>();

    // Group sessions by date
    sessions.forEach(session => {
      const dateKey = session.checkInTime.toISOString().split('T')[0];
      if (!dateMap.has(dateKey)) {
        dateMap.set(dateKey, []);
      }
      dateMap.get(dateKey)!.push(session);
    });

    // Create activities for each date
    dateMap.forEach((daySessions, dateKey) => {
      const date = new Date(dateKey);
      const totalExercises = daySessions.reduce((sum, s) => sum + s.actualWorkout.totalExercises, 0);
      const completedExercises = daySessions.reduce((sum, s) => sum + s.actualWorkout.completedExercises.length, 0);

      const activity: TestUserActivity = {
        _id: new mongoose.Types.ObjectId(),
        userId,
        date,
        workoutActivity: {
          assignedWorkouts: totalExercises,
          completedWorkouts: completedExercises,
          completionPercentage: Math.round((completedExercises / totalExercises) * 100),
          workoutHistory: daySessions.flatMap(session =>
            session.actualWorkout.completedExercises.map(exercise => ({
              exerciseId: exercise.exerciseId,
              exerciseName: exercise.exerciseName,
              completedSets: exercise.sets,
              completedReps: exercise.reps,
              performanceNotes: exercise.notes,
              completedAt: exercise.endTime || session.checkOutTime
            }))
          )
        }
      };

      activities.push(activity);
    });

    return activities;
  }

  static createInconsistentProgressSessions(
    userId: mongoose.Types.ObjectId,
    exercise: TestExercise,
    sessionCount: number = 8
  ): TestGymSession[] {
    const sessions: TestGymSession[] = [];
    const branchId = new mongoose.Types.ObjectId();
    const weights = [70, 72.5, 70, 75, 72.5, 77.5, 75, 80]; // Inconsistent progress

    for (let i = 0; i < sessionCount; i++) {
      const sessionDate = new Date('2025-01-01');
      sessionDate.setDate(1 + (i * 3)); // Every 3 days

      const session: TestGymSession = {
        _id: new mongoose.Types.ObjectId(),
        userId,
        branchId: branchId,
        checkInTime: sessionDate,
        checkOutTime: new Date(sessionDate.getTime() + 60 * 60 * 1000),
        sessionDuration: 60,
        status: 'completed',
        actualWorkout: {
          totalExercises: 1,
          totalSets: 4,
          caloriesBurned: 300,
          avgHeartRate: 145,
          completedExercises: [
            {
              exerciseId: exercise._id,
              exerciseName: exercise.name,
              sets: 4,
              reps: i < 4 ? 8 : (i < 6 ? 6 : 10), // Varying reps
              weightUsed: weights[i],
              notes: i % 3 === 0 ? 'Struggled today' : 'Felt good'
            }
          ]
        },
        pointsEarned: 40
      };

      sessions.push(session);
    }

    return sessions;
  }

  static createHighVolumeTrainingSessions(
    userId: mongoose.Types.ObjectId,
    exercises: TestExercise[],
    sessionCount: number = 5
  ): TestGymSession[] {
    const sessions: TestGymSession[] = [];
    const branchId = new mongoose.Types.ObjectId();

    for (let i = 0; i < sessionCount; i++) {
      const sessionDate = new Date('2025-01-01');
      sessionDate.setDate(1 + (i * 7)); // Weekly sessions

      const completedExercises = exercises.slice(0, 4).map((exercise, exerciseIndex) => ({
        exerciseId: exercise._id,
        exerciseName: exercise.name,
        sets: 5, // High volume
        reps: 12,
        weightUsed: 50 + (exerciseIndex * 10) + (i * 2.5), // Progressive
        notes: 'High volume training'
      }));

      const session: TestGymSession = {
        _id: new mongoose.Types.ObjectId(),
        userId,
        branchId,
        checkInTime: sessionDate,
        checkOutTime: new Date(sessionDate.getTime() + 120 * 60 * 1000), // 2 hours
        sessionDuration: 120,
        status: 'completed',
        actualWorkout: {
          totalExercises: completedExercises.length,
          totalSets: completedExercises.length * 5,
          caloriesBurned: 600,
          avgHeartRate: 150,
          maxHeartRate: 175,
          completedExercises
        },
        pointsEarned: 100
      };

      sessions.push(session);
    }

    return sessions;
  }

  static createMilestoneAchievementSessions(
    userId: mongoose.Types.ObjectId,
    exercise: TestExercise
  ): TestGymSession[] {
    const milestoneWeights = [50, 75, 100, 125, 150]; // Milestone achievements
    const sessions: TestGymSession[] = [];
    const branchId = new mongoose.Types.ObjectId();

    milestoneWeights.forEach((weight, index) => {
      const sessionDate = new Date('2025-01-01');
      sessionDate.setMonth(index); // Monthly milestones

      const session: TestGymSession = {
        _id: new mongoose.Types.ObjectId(),
        userId,
        branchId,
        checkInTime: sessionDate,
        checkOutTime: new Date(sessionDate.getTime() + 90 * 60 * 1000),
        sessionDuration: 90,
        status: 'completed',
        actualWorkout: {
          totalExercises: 1,
          totalSets: 5,
          caloriesBurned: 400,
          avgHeartRate: 160,
          completedExercises: [
            {
              exerciseId: exercise._id,
              exerciseName: exercise.name,
              sets: 5,
              reps: weight >= 100 ? 3 : (weight >= 75 ? 5 : 8), // Lower reps for higher weights
              weightUsed: weight,
              notes: `Milestone achieved: ${weight}kg!`
            }
          ]
        },
        pointsEarned: 75
      };

      sessions.push(session);
    });

    return sessions;
  }

  static createStreakTestData(
    userId: mongoose.Types.ObjectId,
    exercises: TestExercise[]
  ): {
    sessions: TestGymSession[];
    activities: TestUserActivity[];
  } {
    const sessions: TestGymSession[] = [];
    const branchId = new mongoose.Types.ObjectId();

    // Create a 14-day streak with one rest day
    for (let i = 0; i < 15; i++) {
      if (i === 7) continue; // Skip day 7 (rest day)

      const sessionDate = new Date('2025-01-01');
      sessionDate.setDate(1 + i);

      const exercise = exercises[i % exercises.length];
      const session: TestGymSession = {
        _id: new mongoose.Types.ObjectId(),
        userId,
        branchId,
        checkInTime: sessionDate,
        checkOutTime: new Date(sessionDate.getTime() + 75 * 60 * 1000),
        sessionDuration: 75,
        status: 'completed',
        actualWorkout: {
          totalExercises: 1,
          totalSets: 4,
          caloriesBurned: 350,
          avgHeartRate: 145,
          completedExercises: [
            {
              exerciseId: exercise._id,
              exerciseName: exercise.name,
              sets: 4,
              reps: 8,
              weightUsed: 70 + (i * 1.25),
              notes: `Day ${i + 1} of streak`
            }
          ]
        },
        pointsEarned: 60
      };

      sessions.push(session);
    }

    const activities = this.createUserActivityHistory(userId, sessions);
    return { sessions, activities };
  }

  static async seedAnalyticsTestData(database: any): Promise<{
    user: TestUser;
    similarUsers: TestUser[];
    exercises: TestExercise[];
    sessions: TestGymSession[];
    activities: TestUserActivity[];
  }> {
    // Create test user
    const user = this.createTestUser();
    await database.collection('users').insertOne(user);

    // Create similar users for comparison
    const similarUsers = this.createSimilarUsers(10, user.demographics!.age);
    await database.collection('users').insertMany(similarUsers);

    // Create exercises
    const exercises = this.createTestExercises();
    await database.collection('exercises').insertMany(exercises);

    // Create progressive training sessions
    const sessions = this.createProgressiveGymSessions(user._id, exercises, 15);
    await database.collection('gymSessions').insertMany(sessions);

    // Create user activities
    const activities = this.createUserActivityHistory(user._id, sessions);
    await database.collection('userActivity').insertMany(activities);

    return {
      user,
      similarUsers,
      exercises,
      sessions,
      activities
    };
  }
}

export default AnalyticsTestFixtures;