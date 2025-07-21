import { Request, Response } from 'express';
import { AnalyticsEvent, AggregatedAnalytics } from '../models/Analytics';
import { validateRequest } from '../utils/validation';
import { 
  logEventSchema,
  engagementMetricsSchema,
  aggregationSchema,
  performanceMetricsSchema
} from '../utils/validation';
import logger from '../utils/logger';

export const logEvent = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      res.status(400).json({
        success: false,
        message: 'User ID is required',
        code: 'VALIDATION_ERROR'
      });
      return;
    }

    // Validate request body
    const validation = validateRequest(req.body, logEventSchema);
    if (!validation.isValid) {
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        errors: validation.errors
      });
      return;
    }

    const { 
      eventType, 
      eventName, 
      eventData, 
      sessionId,
      deviceInfo,
      ipAddress 
    } = validation.value;

    // Create analytics event
    const analyticsEvent = new AnalyticsEvent({
      userId,
      sessionId,
      eventType,
      eventName,
      eventData,
      deviceInfo,
      ipAddress: ipAddress || req.ip,
      timestamp: new Date()
    });

    await analyticsEvent.save();

    logger.info('Analytics event logged', { 
      userId, 
      eventType,
      eventName,
      sessionId 
    });

    res.status(201).json({
      success: true,
      message: 'Event logged successfully',
      data: {
        eventId: analyticsEvent._id,
        timestamp: analyticsEvent.timestamp
      }
    });

  } catch (error) {
    logger.error('Error logging analytics event', 
      error instanceof Error ? error : new Error('Unknown error'), 
      { userId: req.params['userId'] || 'unknown' }
    );
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
};

export const getEngagementMetrics = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      res.status(400).json({
        success: false,
        message: 'User ID is required',
        code: 'VALIDATION_ERROR'
      });
      return;
    }

    // Validate query parameters
    const validation = validateRequest(req.query, engagementMetricsSchema);
    if (!validation.isValid) {
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        errors: validation.errors
      });
      return;
    }

    const { 
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
      endDate = new Date(),
      period = 'daily'
    } = validation.value;

    // Calculate engagement metrics
    const dateFilter = {
      timestamp: { 
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      }
    };

    // Get total events
    const totalEvents = await AnalyticsEvent.countDocuments({
      userId,
      ...dateFilter
    });

    // Get unique sessions
    const uniqueSessions = await AnalyticsEvent.distinct('sessionId', {
      userId,
      ...dateFilter,
      sessionId: { $ne: null }
    });

    // Get feature usage breakdown
    const featureUsage = await AnalyticsEvent.aggregate([
      { 
        $match: { 
          userId,
          ...dateFilter,
          eventType: 'feature_usage'
        }
      },
      {
        $group: {
          _id: '$eventData.feature',
          count: { $sum: 1 },
          lastUsed: { $max: '$timestamp' }
        }
      },
      { $sort: { count: -1 } },
      { $limit: 10 }
    ]);

    // Get screen time data
    const screenTime = await AnalyticsEvent.aggregate([
      {
        $match: {
          userId,
          ...dateFilter,
          eventType: 'app_interaction',
          'eventData.duration': { $exists: true }
        }
      },
      {
        $group: {
          _id: '$eventData.screen',
          totalDuration: { $sum: '$eventData.duration' },
          visits: { $sum: 1 }
        }
      },
      { $sort: { totalDuration: -1 } }
    ]);

    // Calculate daily active usage
    const dailyStats = await AnalyticsEvent.aggregate([
      {
        $match: {
          userId,
          ...dateFilter
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$timestamp' },
            month: { $month: '$timestamp' },
            day: { $dayOfMonth: '$timestamp' }
          },
          events: { $sum: 1 },
          uniqueFeatures: { $addToSet: '$eventData.feature' },
          totalDuration: { $sum: '$eventData.duration' }
        }
      },
      { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
    ]);

    res.status(200).json({
      success: true,
      message: 'Engagement metrics retrieved successfully',
      data: {
        summary: {
          totalEvents,
          uniqueSessions: uniqueSessions.length,
          activeDays: dailyStats.length,
          averageEventsPerDay: dailyStats.length > 0 ? totalEvents / dailyStats.length : 0
        },
        featureUsage,
        screenTime,
        dailyStats,
        period: {
          startDate,
          endDate,
          granularity: period
        }
      }
    });

  } catch (error) {
    logger.error('Error retrieving engagement metrics', 
      error instanceof Error ? error : new Error('Unknown error'), 
      { userId: req.params['userId'] || 'unknown' }
    );
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
};

export const getAggregatedData = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    
    if (!userId) {
      res.status(400).json({
        success: false,
        message: 'User ID is required',
        code: 'VALIDATION_ERROR'
      });
      return;
    }

    // Validate query parameters
    const validation = validateRequest(req.query, aggregationSchema);
    if (!validation.isValid) {
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        errors: validation.errors
      });
      return;
    }

    const { 
      period = 'daily',
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endDate = new Date(),
      limit = 50
    } = validation.value;

    // Get aggregated analytics data
    const aggregatedData = await AggregatedAnalytics.find({
      userId,
      period,
      date: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      }
    })
    .sort({ date: -1 })
    .limit(limit)
    .lean();

    // If no aggregated data exists, generate it on-the-fly
    if (aggregatedData.length === 0) {
      const onTheFlyData = await generateAggregatedData(userId, period, new Date(startDate), new Date(endDate));
      
      res.status(200).json({
        success: true,
        message: 'Aggregated data retrieved successfully',
        data: {
          aggregatedData: onTheFlyData,
          period,
          isRealTime: true,
          summary: {
            totalPeriods: onTheFlyData.length,
            dateRange: { startDate, endDate }
          }
        }
      });
      return;
    }

    // Calculate summary statistics
    const totalSessions = aggregatedData.reduce((sum, item) => sum + item.metrics.sessionCount, 0);
    const totalDuration = aggregatedData.reduce((sum, item) => sum + item.metrics.totalDuration, 0);
    const averageEngagement = aggregatedData.reduce((sum, item) => sum + item.metrics.engagementScore, 0) / aggregatedData.length;

    res.status(200).json({
      success: true,
      message: 'Aggregated data retrieved successfully',
      data: {
        aggregatedData,
        period,
        isRealTime: false,
        summary: {
          totalPeriods: aggregatedData.length,
          totalSessions,
          totalDuration,
          averageEngagement: Math.round(averageEngagement * 100) / 100,
          dateRange: { startDate, endDate }
        }
      }
    });

  } catch (error) {
    logger.error('Error retrieving aggregated data', 
      error instanceof Error ? error : new Error('Unknown error'), 
      { userId: req.params['userId'] || 'unknown' }
    );
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
};

export const getPerformanceMetrics = async (req: Request, res: Response): Promise<void> => {
  try {
    // Validate query parameters
    const validation = validateRequest(req.query, performanceMetricsSchema);
    if (!validation.isValid) {
      res.status(400).json({
        success: false,
        message: 'Validation failed',
        code: 'VALIDATION_ERROR',
        errors: validation.errors
      });
      return;
    }

    const { 
      startDate = new Date(Date.now() - 24 * 60 * 60 * 1000), // 24 hours ago
      endDate = new Date(),
      eventType = 'performance'
    } = validation.value;

    const dateFilter = {
      timestamp: { 
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      }
    };

    // Get API performance metrics
    const apiMetrics = await AnalyticsEvent.aggregate([
      {
        $match: {
          eventType,
          ...dateFilter,
          'eventData.duration': { $exists: true }
        }
      },
      {
        $group: {
          _id: '$eventData.action',
          avgDuration: { $avg: '$eventData.duration' },
          minDuration: { $min: '$eventData.duration' },
          maxDuration: { $max: '$eventData.duration' },
          totalCalls: { $sum: 1 },
          successRate: {
            $avg: {
              $cond: [{ $eq: ['$eventData.success', true] }, 1, 0]
            }
          }
        }
      },
      { $sort: { avgDuration: -1 } }
    ]);

    // Get error rates
    const errorMetrics = await AnalyticsEvent.aggregate([
      {
        $match: {
          eventType: 'error',
          ...dateFilter
        }
      },
      {
        $group: {
          _id: '$eventData.errorCode',
          count: { $sum: 1 },
          lastOccurrence: { $max: '$timestamp' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Get overall app performance
    const overallMetrics = await AnalyticsEvent.aggregate([
      {
        $match: {
          ...dateFilter,
          eventType: { $in: ['app_interaction', 'api_call', 'performance'] }
        }
      },
      {
        $group: {
          _id: null,
          totalEvents: { $sum: 1 },
          avgResponseTime: { $avg: '$eventData.duration' },
          successfulRequests: {
            $sum: {
              $cond: [{ $eq: ['$eventData.success', true] }, 1, 0]
            }
          },
          failedRequests: {
            $sum: {
              $cond: [{ $eq: ['$eventData.success', false] }, 1, 0]
            }
          }
        }
      }
    ]);

    const overall = overallMetrics[0] || {
      totalEvents: 0,
      avgResponseTime: 0,
      successfulRequests: 0,
      failedRequests: 0
    };

    res.status(200).json({
      success: true,
      message: 'Performance metrics retrieved successfully',
      data: {
        apiMetrics,
        errorMetrics,
        overall: {
          ...overall,
          successRate: overall.totalEvents > 0 ? (overall.successfulRequests / overall.totalEvents) * 100 : 0,
          errorRate: overall.totalEvents > 0 ? (overall.failedRequests / overall.totalEvents) * 100 : 0
        },
        period: {
          startDate,
          endDate
        }
      }
    });

  } catch (error) {
    logger.error('Error retrieving performance metrics', 
      error instanceof Error ? error : new Error('Unknown error')
    );
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      code: 'SERVER_ERROR'
    });
  }
};

// Helper function to generate aggregated data on-the-fly
async function generateAggregatedData(userId: string, period: string, startDate: Date, endDate: Date): Promise<any[]> {
  const dateFilter = {
    userId,
    timestamp: { 
      $gte: startDate,
      $lte: endDate
    }
  };

  // Group by the specified period
  let groupBy: any;
  switch (period) {
    case 'daily':
      groupBy = {
        year: { $year: '$timestamp' },
        month: { $month: '$timestamp' },
        day: { $dayOfMonth: '$timestamp' }
      };
      break;
    case 'weekly':
      groupBy = {
        year: { $year: '$timestamp' },
        week: { $week: '$timestamp' }
      };
      break;
    case 'monthly':
      groupBy = {
        year: { $year: '$timestamp' },
        month: { $month: '$timestamp' }
      };
      break;
    default:
      groupBy = {
        year: { $year: '$timestamp' },
        month: { $month: '$timestamp' },
        day: { $dayOfMonth: '$timestamp' }
      };
  }

  const aggregated = await AnalyticsEvent.aggregate([
    { $match: dateFilter },
    {
      $group: {
        _id: groupBy,
        sessionCount: { $addToSet: '$sessionId' },
        totalDuration: { $sum: '$eventData.duration' },
        featureUsage: { $addToSet: '$eventData.feature' },
        apiCalls: {
          $sum: {
            $cond: [{ $eq: ['$eventType', 'api_call'] }, 1, 0]
          }
        },
        errors: {
          $sum: {
            $cond: [{ $eq: ['$eventType', 'error'] }, 1, 0]
          }
        },
        uniqueScreens: { $addToSet: '$eventData.screen' }
      }
    },
    {
      $addFields: {
        sessionCount: { $size: '$sessionCount' },
        uniqueScreens: { $size: '$uniqueScreens' },
        engagementScore: {
          $min: [
            100,
            {
              $multiply: [
                { $divide: ['$totalDuration', 3600000] }, // Convert to hours
                10 // Scale factor
              ]
            }
          ]
        }
      }
    },
    { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
  ]);

  return aggregated.map(item => ({
    date: period === 'weekly' 
      ? new Date(item._id.year, 0, (item._id.week - 1) * 7)
      : new Date(item._id.year, (item._id.month || 1) - 1, item._id.day || 1),
    period,
    metrics: {
      sessionCount: item.sessionCount || 0,
      totalDuration: item.totalDuration || 0,
      featureUsage: {},
      apiCalls: item.apiCalls || 0,
      errors: item.errors || 0,
      uniqueScreens: item.uniqueScreens || 0,
      engagementScore: Math.round((item.engagementScore || 0) * 100) / 100
    }
  }));
}