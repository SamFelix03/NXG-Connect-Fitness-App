import cron from 'node-cron';
import mongoose from 'mongoose';
import { logger } from '../utils/logger';
import { WorkoutPlan } from '../models/WorkoutPlan';
import { User } from '../models/User';
import { workoutPlanningService } from '../services/external/workout-planning.service';

/**
 * Workout Plan Refresh Background Job
 * 
 * This job runs every day at 2:00 AM to check for workout plans that need refreshing
 * based on their nextRefreshDate (2-week refresh cycle).
 * 
 * Features:
 * - Finds plans that need refreshing based on nextRefreshDate
 * - Maintains single active plan per user rule
 * - Handles errors gracefully with fallback mechanisms
 * - Logs all operations for monitoring and debugging
 */

interface RefreshJobStats {
  plansChecked: number;
  plansRefreshed: number;
  plansSkipped: number;
  errors: number;
  startTime: Date;
  endTime?: Date;
  duration?: number;
}

class WorkoutPlanRefreshJob {
  private jobStats: RefreshJobStats;
  private isRunning: boolean = false;

  constructor() {
    this.jobStats = this.initializeStats();
  }

  /**
   * Initialize job statistics
   */
  private initializeStats(): RefreshJobStats {
    return {
      plansChecked: 0,
      plansRefreshed: 0,
      plansSkipped: 0,
      errors: 0,
      startTime: new Date()
    };
  }

  /**
   * Start the cron job
   */
  public startJob(): void {
    // Run every day at 2:00 AM
    const cronExpression = '0 2 * * *';
    
    // For development/testing, you can use a more frequent schedule
    const testCronExpression = process.env['NODE_ENV'] === 'development' ? '*/30 * * * *' : cronExpression; // Every 30 minutes in dev
    
    cron.schedule(testCronExpression, async () => {
      if (this.isRunning) {
        logger.warn('Workout plan refresh job already running, skipping this execution', {
          service: 'workout-plan-refresh-job',
          event: 'job-skip-already-running'
        });
        return;
      }

      try {
        await this.executeRefreshJob();
      } catch (error) {
        logger.error('Workout plan refresh job failed', error as Error, {
          service: 'workout-plan-refresh-job',
          event: 'job-execution-error'
        });
      }
    }, {
      scheduled: true,
      timezone: 'UTC'
    });

    logger.info('Workout plan refresh job scheduled', {
      service: 'workout-plan-refresh-job',
      schedule: testCronExpression,
      timezone: 'UTC',
      event: 'job-scheduled'
    });
  }

  /**
   * Execute the refresh job
   */
  public async executeRefreshJob(): Promise<RefreshJobStats> {
    this.isRunning = true;
    this.jobStats = this.initializeStats();

    logger.info('Starting workout plan refresh job', {
      service: 'workout-plan-refresh-job',
      startTime: this.jobStats.startTime,
      event: 'job-start'
    });

    try {
      // Find all active workout plans that need refreshing
      const now = new Date();
      const plansToRefresh = await WorkoutPlan.find({
        isActive: true,
        nextRefreshDate: { $lte: now }
      }).populate('userId', 'fitnessProfile demographics').lean();

      this.jobStats.plansChecked = plansToRefresh.length;

      logger.info('Found workout plans to refresh', {
        service: 'workout-plan-refresh-job',
        plansFound: plansToRefresh.length,
        event: 'plans-found'
      });

      // Process each plan
      for (const plan of plansToRefresh) {
        try {
          await this.refreshSinglePlan(plan);
          this.jobStats.plansRefreshed++;
        } catch (error) {
          logger.error('Failed to refresh individual plan', error as Error, {
            service: 'workout-plan-refresh-job',
            planId: plan.planId,
            userId: plan.userId.toString(),
            event: 'individual-plan-refresh-error'
          });
          this.jobStats.errors++;
        }

        // Add small delay between requests to avoid overwhelming external service
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      this.jobStats.endTime = new Date();
      this.jobStats.duration = this.jobStats.endTime.getTime() - this.jobStats.startTime.getTime();

      logger.info('Workout plan refresh job completed', {
        service: 'workout-plan-refresh-job',
        stats: {
          plansChecked: this.jobStats.plansChecked,
          plansRefreshed: this.jobStats.plansRefreshed,
          plansSkipped: this.jobStats.plansSkipped,
          errors: this.jobStats.errors,
          duration: this.jobStats.duration
        },
        event: 'job-completed'
      });

    } catch (error) {
      this.jobStats.endTime = new Date();
      this.jobStats.duration = this.jobStats.endTime.getTime() - this.jobStats.startTime.getTime();

      logger.error('Workout plan refresh job failed', error as Error, {
        service: 'workout-plan-refresh-job',
        stats: this.jobStats,
        event: 'job-error'
      });
    } finally {
      this.isRunning = false;
    }

    return this.jobStats;
  }

  /**
   * Refresh a single workout plan
   */
  private async refreshSinglePlan(plan: any): Promise<void> {
    const userId = plan.userId._id || plan.userId;
    const userProfile = plan.userId.fitnessProfile || {};
    const userDemographics = plan.userId.demographics || {};

    logger.info('Refreshing workout plan', {
      service: 'workout-plan-refresh-job',
      planId: plan.planId,
      userId,
      planName: plan.planName,
      event: 'plan-refresh-start'
    });

    // Check if user still has required profile data
    if (!userProfile.level || !userProfile.goal || 
        !userDemographics.age || !userDemographics.heightCm || 
        !userDemographics.weightKg) {
      
      logger.warn('Skipping plan refresh due to incomplete user profile', {
        service: 'workout-plan-refresh-job',
        planId: plan.planId,
        userId,
        missingFields: {
          fitnessLevel: !userProfile.level,
          goal: !userProfile.goal,
          age: !userDemographics.age,
          height: !userDemographics.heightCm,
          weight: !userDemographics.weightKg
        },
        event: 'plan-refresh-skip-incomplete-profile'
      });

      this.jobStats.plansSkipped++;
      return;
    }

    // Prepare user profile for external service
    const refreshUserProfile = {
      fitnessLevel: userProfile.level,
      goal: userProfile.goal,
      age: userDemographics.age,
      heightCm: userDemographics.heightCm,
      weightKg: userDemographics.weightKg,
      activityLevel: userDemographics.activityLevel || 'moderate',
      healthConditions: userProfile.healthConditions || [],
      weeklyWorkoutDays: plan.weeklySchedule || 3
    };

    try {
      // Create new workout plan via external service
      const externalPlanResponse = await workoutPlanningService.createWorkoutPlan({
        userId: userId.toString(),
        userProfile: refreshUserProfile
      });

      // Start database transaction to ensure data consistency
      const session = await mongoose.startSession();
      
      try {
        await session.withTransaction(async () => {
          // Deactivate current plan
          await WorkoutPlan.findByIdAndUpdate(
            plan._id,
            { isActive: false },
            { session }
          );

          // Create new workout plan record
          const newWorkoutPlan = new WorkoutPlan({
            planId: externalPlanResponse.planId,
            planName: externalPlanResponse.planName,
            userId,
            isActive: true,
            source: 'external',
            workoutDays: externalPlanResponse.workoutDays,
            weeklySchedule: externalPlanResponse.weeklySchedule,
            planDuration: externalPlanResponse.planDuration,
            difficultyLevel: externalPlanResponse.difficultyLevel,
            userContext: {
              fitnessLevel: refreshUserProfile.fitnessLevel,
              goal: refreshUserProfile.goal,
              age: refreshUserProfile.age,
              heightCm: refreshUserProfile.heightCm,
              weightKg: refreshUserProfile.weightKg,
              activityLevel: refreshUserProfile.activityLevel,
              healthConditions: refreshUserProfile.healthConditions
            },
            lastRefreshed: new Date()
          });

          await newWorkoutPlan.save({ session });

          // Update user's activePlans reference
          await User.findByIdAndUpdate(
            userId,
            { 
              'activePlans.workoutPlanId': newWorkoutPlan._id 
            },
            { session }
          );

          logger.info('Workout plan refreshed successfully', {
            service: 'workout-plan-refresh-job',
            oldPlanId: plan.planId,
            newPlanId: newWorkoutPlan.planId,
            userId,
            planName: newWorkoutPlan.planName,
            event: 'plan-refresh-success'
          });
        });
      } finally {
        await session.endSession();
      }

    } catch (error) {
      logger.error('Failed to refresh workout plan via external service', error as Error, {
        service: 'workout-plan-refresh-job',
        planId: plan.planId,
        userId,
        event: 'external-service-refresh-error'
      });

      // Update the existing plan's next refresh date to avoid repeated failures
      // Set it to 1 week from now to retry sooner than the normal 2-week cycle
      const nextRetryDate = new Date();
      nextRetryDate.setDate(nextRetryDate.getDate() + 7);

      await WorkoutPlan.findByIdAndUpdate(plan._id, {
        nextRefreshDate: nextRetryDate,
        lastRefreshed: new Date() // Update to show we attempted refresh
      });

      logger.info('Updated failed plan retry date', {
        service: 'workout-plan-refresh-job',
        planId: plan.planId,
        userId,
        nextRetryDate,
        event: 'plan-retry-scheduled'
      });

      throw error; // Re-throw to be caught by caller
    }
  }

  /**
   * Manual trigger for testing or admin operations
   */
  public async triggerManualRefresh(): Promise<RefreshJobStats> {
    logger.info('Manual workout plan refresh triggered', {
      service: 'workout-plan-refresh-job',
      event: 'manual-trigger'
    });

    return await this.executeRefreshJob();
  }

  /**
   * Get current job statistics
   */
  public getJobStats(): RefreshJobStats {
    return { ...this.jobStats };
  }

  /**
   * Check if job is currently running
   */
  public isJobRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Get next scheduled run time (approximate)
   */
  public getNextRunInfo(): { nextRun: Date; isRunning: boolean } {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(2, 0, 0, 0); // Next 2:00 AM

    return {
      nextRun: tomorrow,
      isRunning: this.isRunning
    };
  }
}

// Create singleton instance
const workoutPlanRefreshJob = new WorkoutPlanRefreshJob();

// Auto-start the job when the module is loaded (in production)
if (process.env['NODE_ENV'] !== 'test') {
  workoutPlanRefreshJob.startJob();
}

export { workoutPlanRefreshJob, WorkoutPlanRefreshJob };
export default workoutPlanRefreshJob;