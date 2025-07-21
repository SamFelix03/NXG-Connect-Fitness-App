import { RedisClientOptions } from 'redis';

export interface RedisConfig {
  url: string;
  password: string | undefined;
  database: number;
  maxRetriesPerRequest: number;
  retryDelayOnFailover: number;
  maxRetriesPerFailover: number;
  connectTimeout: number;
  commandTimeout: number;
  keyPrefixes: {
    auth: string;
    cache: string;
    session: string;
  };
  cluster?: {
    enabled: boolean;
    nodes?: string[];
  };
}

export interface RedisConnectionOptions extends RedisClientOptions {
  socket?: {
    host?: string;
    port?: number;
    connectTimeout?: number;
    commandTimeout?: number;
    reconnectStrategy?: (retries: number) => number | Error;
  };
  password?: string;
  database?: number;
}

class RedisConfiguration {
  private static instance: RedisConfiguration;
  
  private constructor() {}
  
  public static getInstance(): RedisConfiguration {
    if (!RedisConfiguration.instance) {
      RedisConfiguration.instance = new RedisConfiguration();
    }
    return RedisConfiguration.instance;
  }
  
  public getConfig(): RedisConfig {
    const clusterNodes = process.env['REDIS_CLUSTER_NODES'];
    const config: RedisConfig = {
      url: this.getRedisUrl(),
      password: process.env['REDIS_PASSWORD'],
      database: parseInt(process.env['REDIS_DATABASE'] || 'connectapp', 10),
      maxRetriesPerRequest: parseInt(process.env['REDIS_MAX_RETRIES'] || '3', 10),
      retryDelayOnFailover: parseInt(process.env['REDIS_RETRY_DELAY'] || '100', 10),
      maxRetriesPerFailover: parseInt(process.env['REDIS_MAX_RETRIES_FAILOVER'] || '3', 10),
      connectTimeout: parseInt(process.env['REDIS_CONNECT_TIMEOUT'] || '10000', 10),
      commandTimeout: parseInt(process.env['REDIS_COMMAND_TIMEOUT'] || '5000', 10),
      keyPrefixes: {
        auth: 'auth:',
        cache: 'cache:',
        session: 'session:'
      }
    };
    
    // Handle cluster configuration properly
    if (process.env['REDIS_CLUSTER_ENABLED'] === 'true') {
      config.cluster = {
        enabled: true,
        nodes: clusterNodes ? clusterNodes.split(',').map(node => node.trim()) : []
      };
    } else {
      config.cluster = {
        enabled: false
      };
    }
    
    return config;
  }
  
  public getConnectionOptions(): RedisConnectionOptions {
    const config = this.getConfig();
    
    const options: RedisConnectionOptions = {
      socket: {
        host: process.env['REDIS_HOST'] || 'localhost',
        port: parseInt(process.env['REDIS_PORT'] || '6379', 10),
        connectTimeout: config.connectTimeout,
        commandTimeout: config.commandTimeout,
        reconnectStrategy: this.getReconnectStrategy(config)
      },
      database: config.database
    };
    
    // Only add password if it exists
    if (config.password) {
      options.password = config.password;
    }
    
    return options;
  }
  
  private getRedisUrl(): string {
    if (process.env['REDIS_URL']) {
      return process.env['REDIS_URL'];
    }
    
    const host = process.env['REDIS_HOST'] || 'localhost';
    const port = process.env['REDIS_PORT'] || '6379';
    const password = process.env['REDIS_PASSWORD'];
    const database = process.env['REDIS_DATABASE'] || '0';
    
    const auth = password ? `:${password}@` : '';
    return `redis://${auth}${host}:${port}/${database}`;
  }
  
  private getReconnectStrategy(config: RedisConfig) {
    return (retries: number): number | Error => {
      if (retries >= config.maxRetriesPerFailover) {
        return new Error(`Max retries (${config.maxRetriesPerFailover}) exceeded`);
      }
      
      // Exponential backoff with jitter
      const baseDelay = config.retryDelayOnFailover;
      const exponentialDelay = baseDelay * Math.pow(2, retries);
      const jitter = Math.random() * 0.1 * exponentialDelay;
      
      return Math.min(exponentialDelay + jitter, 30000); // Max 30 seconds
    };
  }
  
  public validateEnvironment(): { isValid: boolean; missingVars: string[] } {
    const requiredVars: string[] = [];
    const missingVars: string[] = [];
    
    // Basic Redis connection is optional in development
    if (process.env['NODE_ENV'] === 'production') {
      requiredVars.push('REDIS_URL', 'REDIS_PASSWORD');
    }
    
    // Cluster configuration validation
    if (process.env['REDIS_CLUSTER_ENABLED'] === 'true') {
      requiredVars.push('REDIS_CLUSTER_NODES');
    }
    
    for (const varName of requiredVars) {
      if (!process.env[varName]) {
        missingVars.push(varName);
      }
    }
    
    return {
      isValid: missingVars.length === 0,
      missingVars
    };
  }
}

export const redisConfig = RedisConfiguration.getInstance();
export default redisConfig; 