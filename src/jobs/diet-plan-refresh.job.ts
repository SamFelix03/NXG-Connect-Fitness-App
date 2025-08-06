import cron from 'node-cron';
import { logger } from '../utils/logger';
import { DietPlan } from '../models/DietPlan';
import { User } from '../models/User';
import { dietPlanCacheService } from '../services/diet-plan-cache.service';

/**
 * Diet Plan Refresh Background Job
 * 
 * This job runs every day at 3:00 AM to check for diet plans that need refreshing
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

class DietPlanRefreshJob {
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
    // Run every day at 3:00 AM (offset from workout plan refresh at 2:00 AM)
    const cronExpression = '0 3 * * *';
    
    // For development/testing, you can use a more frequent schedule
    const testCronExpression = process.env['NODE_ENV'] === 'development' ? '*/35 * * * *' : cronExpression; // Every 35 minutes in dev
    
    cron.schedule(testCronExpression, async () => {
      if (this.isRunning) {
        logger.warn('Diet plan refresh job already running, skipping this execution', {
          service: 'diet-plan-refresh-job',
          event: 'job-skip-already-running'
        });
        return;
      }

      try {
        await this.executeRefreshJob();
      } catch (error) {
        logger.error('Diet plan refresh job failed', error as Error, {
          service: 'diet-plan-refresh-job',
          event: 'job-execution-error'
        });
      }
    }, {
      scheduled: true,
      timezone: 'UTC'
    });

    logger.info('Diet plan refresh job scheduled', {
      service: 'diet-plan-refresh-job',
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

    logger.info('Starting diet plan refresh job', {
      service: 'diet-plan-refresh-job',
      startTime: this.jobStats.startTime,
      event: 'job-start'
    });

    try {
      // Find all active diet plans that need refreshing
      const now = new Date();
      const plansToRefresh = await DietPlan.find({
        isActive: true,
        nextRefreshDate: { $lte: now }
      }).populate('userId', 'fitnessProfile demographics dietPreferences').lean();

      this.jobStats.plansChecked = plansToRefresh.length;

      logger.info('Found diet plans to refresh', {
        service: 'diet-plan-refresh-job',
        plansFound: plansToRefresh.length,
        event: 'plans-found'
      });

      // Process each plan
      for (const plan of plansToRefresh) {
        try {
          await this.refreshSinglePlan(plan);
          this.jobStats.plansRefreshed++;
        } catch (error) {
          logger.error('Failed to refresh individual diet plan', error as Error, {
            service: 'diet-plan-refresh-job',
            planId: plan._id.toString(),
            userId: plan.userId.toString(),
            event: 'individual-plan-refresh-error'
          });
          this.jobStats.errors++;
        }

        // Add small delay between requests to avoid overwhelming external service
        // Slightly longer delay than workout plans due to diet service rate limits
        await new Promise(resolve => setTimeout(resolve, 2000));
      }

      this.jobStats.endTime = new Date();
      this.jobStats.duration = this.jobStats.endTime.getTime() - this.jobStats.startTime.getTime();

      logger.info('Diet plan refresh job completed', {
        service: 'diet-plan-refresh-job',
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

      logger.error('Diet plan refresh job failed', error as Error, {
        service: 'diet-plan-refresh-job',
        stats: this.jobStats,
        event: 'job-error'
      });
    } finally {
      this.isRunning = false;
    }

    return this.jobStats;
  }

  /**
   * Refresh a single diet plan
   */
  private async refreshSinglePlan(plan: any): Promise<void> {
    const userId = plan.userId._id || plan.userId;
    const userProfile = plan.userId.fitnessProfile || {};
    const userDemographics = plan.userId.demographics || {};
    const userDietPreferences = plan.userId.dietPreferences || {};

    logger.info('Refreshing diet plan', {
      service: 'diet-plan-refresh-job',
      planId: plan._id.toString(),
      userId,
      planName: plan.planName,
      event: 'plan-refresh-start'
    });

    // Check if user still has required profile data
    if (!userProfile.goal || 
        !userDemographics.age || !userDemographics.heightCm || 
        !userDemographics.weightKg || !userDemographics.gender) {
      
      logger.warn('Skipping diet plan refresh due to incomplete user profile', {
        service: 'diet-plan-refresh-job',
        planId: plan._id.toString(),
        userId,
        missingFields: {
          goal: !userProfile.goal,
          age: !userDemographics.age,
          height: !userDemographics.heightCm,
          weight: !userDemographics.weightKg,
          gender: !userDemographics.gender
        },
        event: 'plan-refresh-skip-incomplete-profile'
      });

      this.jobStats.plansSkipped++;
      return;
    }

    // Prepare user profile for diet planning service
    const refreshUserProfile = {
      goal: userProfile.goal,
      age: userDemographics.age,
      heightCm: userDemographics.heightCm,
      weightKg: userDemographics.weightKg,
      targetWeightKg: userDemographics.targetWeightKg || userDemographics.weightKg,
      gender: userDemographics.gender,
      activityLevel: userDemographics.activityLevel || 'sedentary',
      allergies: userDemographics.allergies || [],
      healthConditions: userProfile.healthConditions || []
    };

    const dietPreferences = {
      cuisinePreferences: userDietPreferences.cuisinePreferences || {}
    };

    try {
      // Use the diet plan cache service to create/refresh the plan
      const refreshedPlan = await dietPlanCacheService.createOrRefreshDietPlan({
        userId: userId.toString(),
        userProfile: refreshUserProfile,
        dietPreferences,
        forceRefresh: true // Force refresh during background job
      });

      logger.info('Diet plan refreshed successfully', {
        service: 'diet-plan-refresh-job',
        oldPlanId: plan._id.toString(),
        newPlanId: refreshedPlan.planId,
        userId,
        planName: refreshedPlan.planName,
        targetWeight: refreshedPlan.targetWeightKg,
        totalCalories: refreshedPlan.totalMacros.calories,
        event: 'plan-refresh-success'
      });

    } catch (error) {
      logger.error('Failed to refresh diet plan via external service', error as Error, {
        service: 'diet-plan-refresh-job',
        planId: plan._id.toString(),
        userId,
        event: 'external-service-refresh-error'
      });

      // Update the existing plan's next refresh date to avoid repeated failures
      // Set it to 1 week from now to retry sooner than the normal 2-week cycle
      const nextRetryDate = new Date();
      nextRetryDate.setDate(nextRetryDate.getDate() + 7);

      await DietPlan.findByIdAndUpdate(plan._id, {
        nextRefreshDate: nextRetryDate,
        lastRefreshed: new Date() // Update to show we attempted refresh
      });

      logger.info('Updated failed diet plan retry date', {
        service: 'diet-plan-refresh-job',
        planId: plan._id.toString(),
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
    logger.info('Manual diet plan refresh triggered', {
      service: 'diet-plan-refresh-job',
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
    tomorrow.setHours(3, 0, 0, 0); // Next 3:00 AM

    return {
      nextRun: tomorrow,
      isRunning: this.isRunning
    };
  }

  /**
   * Refresh diet plans for users whose goals have changed
   * This can be called when user updates their fitness goals
   */
  public async refreshPlansForGoalChange(userId: string): Promise<void> {
    try {
      logger.info('Refreshing diet plan due to goal change', {
        service: 'diet-plan-refresh-job',
        userId,
        event: 'goal-change-refresh-start'
      });

      // Get user's active diet plan
      const activePlan = await DietPlan.findOne({ 
        userId, 
        isActive: true 
      });

      if (!activePlan) {
        logger.info('No active diet plan found for goal change refresh', {
          service: 'diet-plan-refresh-job',
          userId,
          event: 'no-active-plan-for-goal-change'
        });
        return;
      }

      // Use populated user data for refresh
      const user = await User.findById(userId)
        .select('fitnessProfile demographics dietPreferences')
        .lean();

      if (!user) {
        throw new Error('User not found for goal change refresh');
      }

      const planWithUser = {
        ...activePlan.toObject(),
        userId: user
      };

      await this.refreshSinglePlan(planWithUser);

      logger.info('Diet plan refreshed successfully due to goal change', {
        service: 'diet-plan-refresh-job',
        userId,
        event: 'goal-change-refresh-success'
      });

    } catch (error) {
      logger.error('Failed to refresh diet plan for goal change', error as Error, {
        service: 'diet-plan-refresh-job',
        userId,
        event: 'goal-change-refresh-error'
      });
      throw error;
    }
  }
}

// Create singleton instance
const dietPlanRefreshJob = new DietPlanRefreshJob();

// Auto-start the job when the module is loaded (in production)
if (process.env['NODE_ENV'] !== 'test') {
  dietPlanRefreshJob.startJob();
}

export { dietPlanRefreshJob, DietPlanRefreshJob };
export default dietPlanRefreshJob;