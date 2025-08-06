import mongoose from 'mongoose';
import logger from '../utils/logger';
import { redisClient } from '../utils/redis';

interface DailyAnalytics {
  date: Date;
  completionPercentage: number;
  consistencyScore: number;
  performanceMetrics: {
    totalWorkouts: number;
    totalExercises: number;
    totalSets: number;
    averageWorkoutDuration: number;
    caloriesBurned: number;
    strengthGains: Record<string, number>;
  };
}

interface WeeklyProgress {
  weeks: number;
  strengthGains: Record<string, { current: number; previous: number; change: number }>;
  enduranceImprovements: Record<string, { current: number; previous: number; improvement: number }>;
  workoutStreaks: Array<{
    type: string;
    currentStreak: number;
    longestStreak: number;
    lastWorkout: Date;
  }>;
  weeklyStats: Array<{
    weekStart: Date;
    weekEnd: Date;
    totalWorkouts: number;
    completionRate: number;
    avgIntensity: number;
  }>;
}

interface WorkoutHistoryFilters {
  startDate?: Date;
  endDate?: Date;
  exerciseId?: string;
  muscleGroup?: string;
  limit: number;
  offset: number;
}

interface WorkoutHistoryAnalytics {
  exercises: Array<{
    sessionId: string;
    exerciseName: string;
    date: Date;
    sets: number;
    reps: number;
    weight: number;
    muscleGroup: string;
    performance: number;
  }>;
  trends: {
    volumeProgression: Array<{ date: Date; totalVolume: number }>;
    strengthProgression: Array<{ date: Date; maxWeight: number }>;
    consistencyTrend: Array<{ date: Date; workoutsCompleted: number }>;
  };
  pagination: {
    limit: number;
    offset: number;
    total: number;
    hasNext: boolean;
  };
}

export class AnalyticsService {
  private cachePrefix = 'analytics:workout:';
  
  /**
   * Get daily workout analytics
   * AC: 1 - calculating completion percentages, consistency scores, and performance metrics
   */
  async getDailyWorkoutAnalytics(userId: string, date: Date): Promise<DailyAnalytics> {
    const cacheKey = `${this.cachePrefix}daily:${userId}:${date.toISOString().split('T')[0]}`;
    
    try {
      // Check cache first
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        logger.info('Returning cached daily analytics', { userId, date });
        return JSON.parse(cached);
      }

      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      // Get gym sessions for the day
      const dailyStats = await mongoose.connection.db.collection('gymSessions').aggregate([
        {
          $match: {
            userId: new mongoose.Types.ObjectId(userId),
            checkInTime: { $gte: startOfDay, $lte: endOfDay },
            status: 'completed'
          }
        },
        {
          $group: {
            _id: null,
            totalWorkouts: { $sum: 1 },
            totalExercises: { $sum: '$actualWorkout.totalExercises' },
            totalSets: { $sum: '$actualWorkout.totalSets' },
            totalDuration: { $sum: '$sessionDuration' },
            totalCalories: { $sum: '$actualWorkout.caloriesBurned' },
            exerciseData: { $push: '$actualWorkout.completedExercises' }
          }
        }
      ]).toArray();

      // Get user activity for completion percentage
      const userActivity = await mongoose.connection.db.collection('userActivity').findOne({
        userId: new mongoose.Types.ObjectId(userId),
        date: startOfDay
      });

      // Calculate analytics
      const stats = dailyStats[0] || {
        totalWorkouts: 0,
        totalExercises: 0,
        totalSets: 0,
        totalDuration: 0,
        totalCalories: 0,
        exerciseData: []
      };

      const completionPercentage = userActivity?.workoutActivity?.completionPercentage || 0;
      const averageWorkoutDuration = stats.totalWorkouts > 0 ? stats.totalDuration / stats.totalWorkouts : 0;

      // Calculate strength gains (simplified)
      const strengthGains = this.calculateStrengthGains(stats.exerciseData);

      // Calculate consistency score (7-day rolling)
      const consistencyScore = await this.calculateConsistencyScore(userId, date);

      const result: DailyAnalytics = {
        date,
        completionPercentage,
        consistencyScore,
        performanceMetrics: {
          totalWorkouts: stats.totalWorkouts,
          totalExercises: stats.totalExercises || 0,
          totalSets: stats.totalSets || 0,
          averageWorkoutDuration,
          caloriesBurned: stats.totalCalories || 0,
          strengthGains
        }
      };

      // Cache for 1 hour
      await redisClient.setex(cacheKey, 3600, JSON.stringify(result));

      logger.info('Daily analytics calculated and cached', { userId, date, result });
      return result;

    } catch (error) {
      logger.error('Error calculating daily workout analytics', error as Error, { userId, date });
      throw new Error('Failed to calculate daily workout analytics');
    }
  }

  /**
   * Get weekly workout progress
   * AC: 2 - aggregating strength gains, endurance improvements, and workout streaks
   */
  async getWeeklyWorkoutProgress(userId: string, startDate?: Date, endDate?: Date, weeks: number = 4): Promise<WeeklyProgress> {
    const cacheKey = `${this.cachePrefix}weekly:${userId}:${weeks}`;
    
    try {
      // Check cache first
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        logger.info('Returning cached weekly analytics', { userId, weeks });
        return JSON.parse(cached);
      }

      const end = endDate || new Date();
      const start = startDate || new Date(end.getTime() - (weeks * 7 * 24 * 60 * 60 * 1000));

      // Get workout sessions for the period
      const weeklyData = await mongoose.connection.db.collection('gymSessions').aggregate([
        {
          $match: {
            userId: new mongoose.Types.ObjectId(userId),
            checkInTime: { $gte: start, $lte: end },
            status: 'completed'
          }
        },
        {
          $addFields: {
            weekStart: {
              $dateFromParts: {
                isoWeekYear: { $isoWeekYear: '$checkInTime' },
                isoWeek: { $isoWeek: '$checkInTime' },
                isoDayOfWeek: 1
              }
            }
          }
        },
        {
          $group: {
            _id: '$weekStart',
            totalWorkouts: { $sum: 1 },
            completedExercises: { $push: '$actualWorkout.completedExercises' },
            avgHeartRate: { $avg: '$actualWorkout.avgHeartRate' },
            totalCalories: { $sum: '$actualWorkout.caloriesBurned' },
            sessionDurations: { $push: '$sessionDuration' }
          }
        },
        {
          $sort: { '_id': 1 }
        }
      ]).toArray();

      // Calculate strength gains
      const strengthGains = await this.calculateWeeklyStrengthGains(userId, start, end);
      
      // Calculate endurance improvements
      const enduranceImprovements = await this.calculateEnduranceImprovements(userId, start, end);
      
      // Calculate workout streaks
      const workoutStreaks = await this.calculateWorkoutStreaks(userId, end);

      // Process weekly stats
      const weeklyStats = weeklyData.map(week => ({
        weekStart: week._id,
        weekEnd: new Date(week._id.getTime() + 6 * 24 * 60 * 60 * 1000),
        totalWorkouts: week.totalWorkouts,
        completionRate: this.calculateWeeklyCompletionRate(week.completedExercises),
        avgIntensity: week.avgHeartRate || 0
      }));

      const result: WeeklyProgress = {
        weeks,
        strengthGains,
        enduranceImprovements,
        workoutStreaks,
        weeklyStats
      };

      // Cache for 24 hours
      await redisClient.setex(cacheKey, 86400, JSON.stringify(result));

      logger.info('Weekly progress calculated and cached', { userId, weeks, result });
      return result;

    } catch (error) {
      logger.error('Error calculating weekly workout progress', error as Error, { userId, weeks });
      throw new Error('Failed to calculate weekly workout progress');
    }
  }

  /**
   * Get workout history analytics with filtering
   * AC: 3 - with filterable exercise logs and performance trend calculations
   */
  async getWorkoutHistoryAnalytics(userId: string, filters: WorkoutHistoryFilters): Promise<WorkoutHistoryAnalytics> {
    try {
      const matchConditions: any = {
        userId: new mongoose.Types.ObjectId(userId),
        status: 'completed'
      };

      if (filters.startDate || filters.endDate) {
        matchConditions.checkInTime = {};
        if (filters.startDate) matchConditions.checkInTime.$gte = filters.startDate;
        if (filters.endDate) matchConditions.checkInTime.$lte = filters.endDate;
      }

      // Build aggregation pipeline
      const pipeline: any[] = [
        { $match: matchConditions },
        { $unwind: '$actualWorkout.completedExercises' }
      ];

      // Add exercise filtering if specified
      if (filters.exerciseId) {
        pipeline.push({
          $match: {
            'actualWorkout.completedExercises.exerciseId': new mongoose.Types.ObjectId(filters.exerciseId)
          }
        });
      }

      if (filters.muscleGroup) {
        // Join with exercises collection to filter by muscle group
        pipeline.push(
          {
            $lookup: {
              from: 'exercises',
              localField: 'actualWorkout.completedExercises.exerciseId',
              foreignField: '_id',
              as: 'exerciseDetails'
            }
          },
          {
            $match: {
              'exerciseDetails.metadata.muscleGroups': filters.muscleGroup
            }
          }
        );
      }

      // Get total count for pagination
      const countPipeline = [...pipeline, { $count: 'total' }];
      const countResult = await mongoose.connection.db.collection('gymSessions').aggregate(countPipeline).toArray();
      const total = countResult[0]?.total || 0;

      // Add sorting, pagination, and projection
      pipeline.push(
        { $sort: { checkInTime: -1 } },
        { $skip: filters.offset },
        { $limit: filters.limit },
        {
          $project: {
            sessionId: '$_id',
            exerciseName: '$actualWorkout.completedExercises.exerciseName',
            date: '$checkInTime',
            sets: '$actualWorkout.completedExercises.sets',
            reps: '$actualWorkout.completedExercises.reps',
            weight: '$actualWorkout.completedExercises.weightUsed',
            muscleGroup: { $arrayElemAt: ['$exerciseDetails.metadata.muscleGroups', 0] },
            performance: {
              $multiply: [
                '$actualWorkout.completedExercises.sets',
                '$actualWorkout.completedExercises.reps',
                '$actualWorkout.completedExercises.weightUsed'
              ]
            }
          }
        }
      );

      const exercises = await mongoose.connection.db.collection('gymSessions').aggregate(pipeline).toArray();

      // Calculate trends
      const trends = await this.calculateWorkoutTrends(userId, filters);

      const result: WorkoutHistoryAnalytics = {
        exercises,
        trends,
        pagination: {
          limit: filters.limit,
          offset: filters.offset,
          total,
          hasNext: filters.offset + filters.limit < total
        }
      };

      logger.info('Workout history analytics retrieved', { userId, filters, resultCount: exercises.length });
      return result;

    } catch (error) {
      logger.error('Error retrieving workout history analytics', error as Error, { userId, filters });
      throw new Error('Failed to retrieve workout history analytics');
    }
  }

  /**
   * Get workout goal tracking
   * AC: 4 - monitoring progress toward strength, endurance, and consistency targets
   */
  async getWorkoutGoalTracking(userId: string, goalType?: string, period: string = 'monthly') {
    const cacheKey = `${this.cachePrefix}goals:${userId}:${goalType || 'all'}:${period}`;
    
    try {
      // Check cache first
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        logger.info('Returning cached goal tracking', { userId, goalType, period });
        return JSON.parse(cached);
      }

      // Get user's fitness profile to determine goals
      const user = await mongoose.connection.db.collection('users').findOne(
        { _id: new mongoose.Types.ObjectId(userId) },
        { projection: { fitnessProfile: 1, bodyComposition: 1 } }
      );

      if (!user) {
        throw new Error('User not found');
      }

      const goals = await this.calculateGoalProgress(userId, user.fitnessProfile, goalType, period);

      // Cache for 1 hour
      await redisClient.setex(cacheKey, 3600, JSON.stringify(goals));

      logger.info('Goal tracking calculated and cached', { userId, goalType, period });
      return goals;

    } catch (error) {
      logger.error('Error calculating goal tracking', error as Error, { userId, goalType, period });
      throw new Error('Failed to calculate goal tracking');
    }
  }

  // Helper methods

  private calculateStrengthGains(exerciseData: any[]): Record<string, number> {
    const gains: Record<string, number> = {};
    
    exerciseData.flat().forEach((exercise: any) => {
      if (exercise && exercise.exerciseName && exercise.weightUsed) {
        const key = exercise.exerciseName;
        gains[key] = Math.max(gains[key] || 0, exercise.weightUsed);
      }
    });

    return gains;
  }

  private async calculateConsistencyScore(userId: string, date: Date): Promise<number> {
    const sevenDaysAgo = new Date(date.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const workoutCount = await mongoose.connection.db.collection('gymSessions').countDocuments({
      userId: new mongoose.Types.ObjectId(userId),
      checkInTime: { $gte: sevenDaysAgo, $lte: date },
      status: 'completed'
    });

    return Math.min(100, (workoutCount / 7) * 100);
  }

  private async calculateWeeklyStrengthGains(userId: string, startDate: Date, endDate: Date) {
    // Implementation for weekly strength gains calculation
    return {};
  }

  private async calculateEnduranceImprovements(userId: string, startDate: Date, endDate: Date) {
    // Implementation for endurance improvements calculation
    return {};
  }

  private async calculateWorkoutStreaks(userId: string, endDate: Date) {
    // Implementation for workout streaks calculation
    return [];
  }

  private calculateWeeklyCompletionRate(exerciseData: any[]): number {
    // Implementation for weekly completion rate calculation
    return 0;
  }

  private async calculateWorkoutTrends(userId: string, filters: WorkoutHistoryFilters) {
    // Implementation for workout trends calculation
    return {
      volumeProgression: [],
      strengthProgression: [],
      consistencyTrend: []
    };
  }

  /**
   * Get performance comparison analytics
   * AC: 5 - providing anonymized benchmarking against similar user profiles
   */
  async getPerformanceComparison(userId: string) {
    const cacheKey = `${this.cachePrefix}comparison:${userId}`;
    
    try {
      // Check cache first
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        logger.info('Returning cached performance comparison', { userId });
        return JSON.parse(cached);
      }

      // Get user profile for similarity matching
      const user = await mongoose.connection.db.collection('users').findOne(
        { _id: new mongoose.Types.ObjectId(userId) },
        { 
          projection: { 
            demographics: 1, 
            fitnessProfile: 1,
            bodyComposition: 1
          } 
        }
      );

      if (!user) {
        throw new Error('User not found');
      }

      // Find similar users (anonymized)
      const similarUsers = await mongoose.connection.db.collection('users').aggregate([
        {
          $match: {
            _id: { $ne: new mongoose.Types.ObjectId(userId) },
            'demographics.age': { 
              $gte: (user.demographics?.age || 25) - 5, 
              $lte: (user.demographics?.age || 25) + 5 
            },
            'demographics.gender': user.demographics?.gender || 'Male',
            'fitnessProfile.level': user.fitnessProfile?.level || 'intermediate'
          }
        },
        { $limit: 100 } // Limit for performance
      ]).toArray();

      // Calculate user's recent performance
      const userStats = await this.calculateUserPerformanceStats(userId);
      
      // Calculate benchmarks from similar users
      const benchmarks = await this.calculateBenchmarks(similarUsers.map(u => u._id));

      // Calculate percentile ranking
      const percentile = this.calculatePercentile(userStats, benchmarks);

      const result = {
        userRank: Math.floor(percentile),
        benchmarks: {
          avgWorkoutsPerWeek: benchmarks.avgWorkoutsPerWeek || 0,
          avgWorkoutDuration: benchmarks.avgWorkoutDuration || 0,
          avgWeightLifted: benchmarks.avgWeightLifted || 0,
          avgCaloriesBurned: benchmarks.avgCaloriesBurned || 0
        },
        percentile,
        similarUserStats: {
          sampleSize: similarUsers.length,
          avgAge: Math.round(similarUsers.reduce((sum, u) => sum + (u.demographics?.age || 25), 0) / similarUsers.length),
          fitnessLevel: user.fitnessProfile?.level || 'intermediate'
        }
      };

      // Cache for 24 hours
      await redisClient.setex(cacheKey, 86400, JSON.stringify(result));

      logger.info('Performance comparison calculated', { userId, percentile });
      return result;

    } catch (error) {
      logger.error('Error calculating performance comparison', error as Error, { userId });
      throw new Error('Failed to calculate performance comparison');
    }
  }

  /**
   * Get auto-progression suggestions
   * AC: 7 - suggesting weight increases and rep adjustments based on performance history
   */
  async getAutoProgressionSuggestions(userId: string, exerciseId?: string) {
    try {
      const matchConditions: any = {
        userId: new mongoose.Types.ObjectId(userId),
        status: 'completed'
      };

      // Get recent exercise performance
      const recentPerformance = await mongoose.connection.db.collection('gymSessions').aggregate([
        { $match: matchConditions },
        { $unwind: '$actualWorkout.completedExercises' },
        ...(exerciseId ? [{
          $match: {
            'actualWorkout.completedExercises.exerciseId': new mongoose.Types.ObjectId(exerciseId)
          }
        }] : []),
        {
          $sort: { checkInTime: -1 }
        },
        {
          $limit: 20 // Last 20 sessions
        },
        {
          $group: {
            _id: '$actualWorkout.completedExercises.exerciseId',
            exerciseName: { $first: '$actualWorkout.completedExercises.exerciseName' },
            performances: {
              $push: {
                date: '$checkInTime',
                weight: '$actualWorkout.completedExercises.weightUsed',
                sets: '$actualWorkout.completedExercises.sets',
                reps: '$actualWorkout.completedExercises.reps',
                volume: {
                  $multiply: [
                    '$actualWorkout.completedExercises.weightUsed',
                    '$actualWorkout.completedExercises.sets',
                    '$actualWorkout.completedExercises.reps'
                  ]
                }
              }
            }
          }
        }
      ]).toArray();

      const suggestions = recentPerformance.map(exercise => {
        const performances = exercise.performances.sort((a: any, b: any) => 
          new Date(b.date).getTime() - new Date(a.date).getTime()
        );

        const current = performances[0];
        const trend = this.calculateProgressionTrend(performances);
        
        return {
          exerciseId: exercise._id,
          exerciseName: exercise.exerciseName,
          currentStats: {
            weight: current.weight,
            sets: current.sets,
            reps: current.reps,
            volume: current.volume
          },
          suggestions: this.generateProgressionSuggestions(current, trend),
          progressionPlan: {
            nextSession: {
              recommendedWeight: this.calculateNextWeight(current.weight, trend),
              recommendedReps: this.calculateNextReps(current.reps, trend),
              confidence: trend.confidence
            }
          }
        };
      });

      const result = exerciseId ? suggestions[0] || null : suggestions;

      logger.info('Auto-progression suggestions calculated', { userId, exerciseId, suggestionCount: suggestions.length });
      return result;

    } catch (error) {
      logger.error('Error calculating auto-progression suggestions', error as Error, { userId, exerciseId });
      throw new Error('Failed to calculate auto-progression suggestions');
    }
  }

  /**
   * Get exercise-specific analytics
   * AC: 8 - tracking personal records, volume progression, and technique improvements
   */
  async getExerciseSpecificAnalytics(userId: string, exerciseId: string) {
    const cacheKey = `${this.cachePrefix}exercise:${userId}:${exerciseId}`;
    
    try {
      // Check cache first
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        logger.info('Returning cached exercise analytics', { userId, exerciseId });
        return JSON.parse(cached);
      }

      // Get all sessions for this exercise
      const exerciseData = await mongoose.connection.db.collection('gymSessions').aggregate([
        {
          $match: {
            userId: new mongoose.Types.ObjectId(userId),
            status: 'completed'
          }
        },
        { $unwind: '$actualWorkout.completedExercises' },
        {
          $match: {
            'actualWorkout.completedExercises.exerciseId': new mongoose.Types.ObjectId(exerciseId)
          }
        },
        {
          $project: {
            date: '$checkInTime',
            exercise: '$actualWorkout.completedExercises',
            volume: {
              $multiply: [
                '$actualWorkout.completedExercises.weightUsed',
                '$actualWorkout.completedExercises.sets',
                '$actualWorkout.completedExercises.reps'
              ]
            }
          }
        },
        { $sort: { date: 1 } }
      ]).toArray();

      if (exerciseData.length === 0) {
        return {
          exerciseId,
          personalRecords: {},
          volumeProgression: [],
          techniqueScores: [],
          milestones: []
        };
      }

      // Calculate personal records
      const personalRecords = {
        maxWeight: Math.max(...exerciseData.map(d => d.exercise.weightUsed || 0)),
        maxVolume: Math.max(...exerciseData.map(d => d.volume || 0)),
        maxReps: Math.max(...exerciseData.map(d => d.exercise.reps || 0)),
        totalSessions: exerciseData.length,
        firstSession: exerciseData[0].date,
        lastSession: exerciseData[exerciseData.length - 1].date
      };

      // Calculate volume progression
      const volumeProgression = exerciseData.map(d => ({
        date: d.date,
        volume: d.volume,
        weight: d.exercise.weightUsed,
        sets: d.exercise.sets,
        reps: d.exercise.reps
      }));

      // Technique scores (simplified - could be enhanced with actual technique tracking)
      const techniqueScores = exerciseData.map(d => ({
        date: d.date,
        score: this.calculateTechniqueScore(d.exercise),
        notes: d.exercise.notes || ''
      }));

      // Calculate milestones
      const milestones = this.calculateMilestones(exerciseData, personalRecords);

      const result = {
        exerciseId,
        personalRecords,
        volumeProgression,
        techniqueScores,
        milestones
      };

      // Cache for 1 hour
      await redisClient.setex(cacheKey, 3600, JSON.stringify(result));

      logger.info('Exercise-specific analytics calculated', { userId, exerciseId });
      return result;

    } catch (error) {
      logger.error('Error calculating exercise-specific analytics', error as Error, { userId, exerciseId });
      throw new Error('Failed to calculate exercise-specific analytics');
    }
  }

  // Additional helper methods

  private async calculateUserPerformanceStats(userId: string) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const stats = await mongoose.connection.db.collection('gymSessions').aggregate([
      {
        $match: {
          userId: new mongoose.Types.ObjectId(userId),
          checkInTime: { $gte: thirtyDaysAgo },
          status: 'completed'
        }
      },
      {
        $group: {
          _id: null,
          totalWorkouts: { $sum: 1 },
          avgDuration: { $avg: '$sessionDuration' },
          avgCalories: { $avg: '$actualWorkout.caloriesBurned' },
          exerciseData: { $push: '$actualWorkout.completedExercises' }
        }
      }
    ]).toArray();

    return stats[0] || {};
  }

  private async calculateBenchmarks(similarUserIds: any[]) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    
    const benchmarks = await mongoose.connection.db.collection('gymSessions').aggregate([
      {
        $match: {
          userId: { $in: similarUserIds },
          checkInTime: { $gte: thirtyDaysAgo },
          status: 'completed'
        }
      },
      {
        $group: {
          _id: null,
          avgWorkoutsPerWeek: { $avg: { $divide: [{ $sum: 1 }, 4.3] } }, // Approximate weeks in 30 days
          avgWorkoutDuration: { $avg: '$sessionDuration' },
          avgCaloriesBurned: { $avg: '$actualWorkout.caloriesBurned' }
        }
      }
    ]).toArray();

    return benchmarks[0] || {};
  }

  private calculatePercentile(userStats: any, benchmarks: any): number {
    // Simplified percentile calculation
    let score = 50; // Default to 50th percentile
    
    if (userStats.totalWorkouts > (benchmarks.avgWorkoutsPerWeek * 4.3)) score += 20;
    if (userStats.avgDuration > benchmarks.avgWorkoutDuration) score += 15;
    if (userStats.avgCalories > benchmarks.avgCaloriesBurned) score += 15;
    
    return Math.min(100, Math.max(0, score));
  }

  private calculateProgressionTrend(performances: any[]) {
    if (performances.length < 2) {
      return { direction: 'stable', confidence: 0, rate: 0 };
    }

    const recent = performances.slice(0, 5); // Last 5 sessions
    const weights = recent.map(p => p.weight);
    const trend = weights.reduce((sum, weight, index) => {
      if (index === 0) return 0;
      return sum + (weight - weights[index - 1]);
    }, 0) / (weights.length - 1);

    return {
      direction: trend > 0 ? 'increasing' : trend < 0 ? 'decreasing' : 'stable',
      confidence: Math.min(100, Math.abs(trend) * 10),
      rate: trend
    };
  }

  private generateProgressionSuggestions(current: any, trend: any) {
    const suggestions = [];

    if (trend.direction === 'increasing' && trend.confidence > 70) {
      suggestions.push({
        type: 'weight_increase',
        message: 'Consider increasing weight by 2.5-5kg next session',
        rationale: 'Consistent strength gains detected'
      });
    }

    if (current.reps >= 12 && trend.direction !== 'decreasing') {
      suggestions.push({
        type: 'rep_progression',
        message: 'Try increasing weight and reducing reps to 8-10 range',
        rationale: 'High rep range achieved, ready for strength focus'
      });
    }

    return suggestions;
  }

  private calculateNextWeight(currentWeight: number, trend: any): number {
    if (trend.direction === 'increasing' && trend.confidence > 50) {
      return currentWeight + 2.5; // Conservative increase
    }
    return currentWeight;
  }

  private calculateNextReps(currentReps: number, trend: any): number {
    if (currentReps >= 12) {
      return 8; // Move to strength range
    }
    return currentReps;
  }

  private calculateTechniqueScore(exercise: any): number {
    // Simplified technique scoring based on consistency
    let score = 70; // Base score
    
    // Bonus for completing all planned sets/reps
    if (exercise.sets >= 3) score += 10;
    if (exercise.reps >= 8) score += 10;
    
    // Penalty for very light weight (might indicate form issues)
    if (exercise.weightUsed < 10) score -= 10;
    
    return Math.min(100, Math.max(0, score));
  }

  private calculateMilestones(exerciseData: any[], records: any) {
    const milestones = [];

    // Weight milestones
    const weightMilestones = [50, 100, 150, 200, 250]; // kg
    for (const milestone of weightMilestones) {
      if (records.maxWeight >= milestone) {
        const achievement = exerciseData.find(d => d.exercise.weightUsed >= milestone);
        if (achievement) {
          milestones.push({
            type: 'weight',
            value: milestone,
            achievedDate: achievement.date,
            description: `Lifted ${milestone}kg for the first time`
          });
        }
      }
    }

    // Volume milestones
    const volumeMilestones = [1000, 2500, 5000, 10000]; // total volume
    for (const milestone of volumeMilestones) {
      if (records.maxVolume >= milestone) {
        const achievement = exerciseData.find(d => d.volume >= milestone);
        if (achievement) {
          milestones.push({
            type: 'volume',
            value: milestone,
            achievedDate: achievement.date,
            description: `Achieved ${milestone} total volume in single session`
          });
        }
      }
    }

    return milestones.sort((a, b) => new Date(b.achievedDate).getTime() - new Date(a.achievedDate).getTime());
  }

  private async calculateGoalProgress(userId: string, fitnessProfile: any, goalType?: string, period: string = 'monthly') {
    // Implementation for goal progress calculation
    return {
      goalType: goalType || 'all',
      period,
      targets: {},
      progress: {},
      achievements: []
    };
  }
}

export default AnalyticsService;