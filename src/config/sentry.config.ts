import * as Sentry from '@sentry/node';

// Sentry configuration interface
export interface SentryConfig {
  dsn: string;
  environment: string;
  release?: string;
  sampleRate: number;
  debug: boolean;
  tracesSampleRate: number;
  beforeSend?: (event: Sentry.Event) => Sentry.Event | null;
}

// Get Sentry configuration based on environment
export const getSentryConfig = (): SentryConfig => {
  const environment = process.env['NODE_ENV'] || 'development';
  const dsn = process.env['SENTRY_DSN'];

  // Don't initialize Sentry in test environment or if DSN is not provided
  if (environment === 'test' || !dsn) {
    return {
      dsn: '',
      environment,
      sampleRate: 0,
      debug: false,
      tracesSampleRate: 0,
    };
  }

  const config: SentryConfig = {
    dsn,
    environment,
    release: process.env['APP_VERSION'] || '1.0.0',
    sampleRate: parseFloat(process.env['SENTRY_SAMPLE_RATE'] || '1.0'),
    debug: environment === 'development',
    tracesSampleRate: parseFloat(process.env['SENTRY_TRACES_SAMPLE_RATE'] || '0.1'),
    
    // Custom beforeSend filter
    beforeSend: (event: Sentry.Event) => {
      // Don't send events in development unless explicitly enabled
      if (environment === 'development' && process.env['SENTRY_DEBUG_MODE'] !== 'true') {
        return null;
      }

      // Filter out certain error types that shouldn't be reported
      if (event.exception?.values) {
        for (const exception of event.exception.values) {
          const errorType = exception.type;
          
          // Skip client errors (4xx status codes)
          if (errorType && ['ValidationError', 'AuthenticationError', 'AuthorizationError', 'NotFoundError'].includes(errorType)) {
            return null;
          }
        }
      }

      return event;
    },
  };

  return config;
};

// Initialize Sentry with configuration
export const initializeSentry = (): void => {
  const config = getSentryConfig();
  
  // Skip initialization if no DSN provided or in test environment
  if (!config.dsn) {
    console.log('📊 Sentry initialization skipped (no DSN or test environment)');
    return;
  }

  Sentry.init({
    dsn: config.dsn,
    environment: config.environment,
    ...(config.release && { release: config.release }),
    sampleRate: config.sampleRate,
    debug: config.debug,
    tracesSampleRate: config.tracesSampleRate,
    ...(config.beforeSend && { beforeSend: config.beforeSend }),
    
    // Additional Sentry options
    integrations: [
      // Add Node.js specific integrations
      new Sentry.Integrations.Http({ tracing: true }),
      // Express integration will be set up in middleware
    ],
    
    // Performance monitoring
    beforeSendTransaction: (event) => {
      // Skip certain transactions in development
      if (config.environment === 'development' && event.transaction === 'GET /health') {
        return null;
      }
      return event;
    },
  });

  console.log(`📊 Sentry initialized for ${config.environment} environment`);
};

// Export Sentry instance for use in middleware
export { Sentry }; 