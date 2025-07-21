import { ConnectOptions } from 'mongoose';

// Database configuration interface
export interface DatabaseConfig {
  uri: string;
  options: ConnectOptions;
  retryOptions: RetryOptions;
}

// Retry configuration interface
export interface RetryOptions {
  maxRetries: number;
  initialRetryDelay: number;
  maxRetryDelay: number;
  retryDelayMultiplier: number;
}

// Get database configuration based on environment
export const getDatabaseConfig = (): DatabaseConfig => {
  const env = process.env['NODE_ENV'] || 'development';
  
  // Default MongoDB URI for different environments
  const getMongoUri = (): string => {
    switch (env) {
      case 'production':
        return process.env['MONGODB_URI'] || process.env['DATABASE_URL'] || '';
      case 'test':
        return process.env['MONGODB_TEST_URI'] || 'mongodb://localhost:27017/connect_app';
      case 'development':
      default:
        return process.env['MONGODB_DEV_URI'] || 'mongodb://localhost:27017/connect_app';
    }
  };

  // Validate MongoDB URI
  const uri = getMongoUri();
  if (!uri) {
    throw new Error(`MongoDB URI is required for environment: ${env}. Please set MONGODB_URI environment variable.`);
  }

  // Connection options with pooling and performance optimization
  const options: ConnectOptions = {
    // Connection pooling
    minPoolSize: parseInt(process.env['DB_MIN_POOL_SIZE'] || '5', 10),
    maxPoolSize: parseInt(process.env['DB_MAX_POOL_SIZE'] || '10', 10),
    
    // Connection timeouts
    connectTimeoutMS: parseInt(process.env['DB_CONNECT_TIMEOUT'] || '10000', 10), // 10 seconds
    socketTimeoutMS: parseInt(process.env['DB_SOCKET_TIMEOUT'] || '45000', 10), // 45 seconds
    
    // Server selection
    serverSelectionTimeoutMS: parseInt(process.env['DB_SERVER_SELECTION_TIMEOUT'] || '5000', 10), // 5 seconds
    
    // Buffering
    bufferCommands: process.env['DB_BUFFER_COMMANDS'] !== 'false',
    
    // Write concern
    writeConcern: {
      w: 'majority',
      j: true, // Journal
      wtimeout: parseInt(process.env['DB_WRITE_TIMEOUT'] || '10000', 10)
    },
    
    // Read preference
    readPreference: 'primary',
    
    // MongoDB driver options
    family: 4, // Use IPv4
    
    // App name for connection tracking
    appName: `nxg-fitness-${env}`,
  };

  // Retry options for connection failures
  const retryOptions: RetryOptions = {
    maxRetries: parseInt(process.env['DB_MAX_RETRIES'] || '5', 10),
    initialRetryDelay: parseInt(process.env['DB_INITIAL_RETRY_DELAY'] || '1000', 10), // 1 second
    maxRetryDelay: parseInt(process.env['DB_MAX_RETRY_DELAY'] || '30000', 10), // 30 seconds
    retryDelayMultiplier: parseFloat(process.env['DB_RETRY_DELAY_MULTIPLIER'] || '2'), // Exponential backoff
  };

  return {
    uri,
    options,
    retryOptions,
  };
};

// Database connection states for monitoring
export enum DatabaseConnectionState {
  DISCONNECTED = 0,
  CONNECTED = 1,
  CONNECTING = 2,
  DISCONNECTING = 3,
}

export default getDatabaseConfig; 