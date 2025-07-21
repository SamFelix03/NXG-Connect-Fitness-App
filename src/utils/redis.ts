import { createClient, RedisClientType, RedisClusterType, createCluster } from 'redis';
import { redisConfig, RedisConfig } from '../config/redis.config';

export enum RedisConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTED = 'connected',
  CONNECTING = 'connecting',
  DISCONNECTING = 'disconnecting',
  ERROR = 'error'
}

export interface RedisHealthStatus {
  state: RedisConnectionState;
  uptime?: number;
  connectedClients?: number;
  lastError?: string;
  clusterInfo?: {
    clusterEnabled: boolean;
    clusterSize?: number;
    clusterState?: string;
  };
}

class RedisConnection {
  private static instance: RedisConnection;
  private client: RedisClientType | RedisClusterType | null = null;
  private config: RedisConfig | null = null;
  private connectionState: RedisConnectionState = RedisConnectionState.DISCONNECTED;
  private lastError: string | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 10;

  private constructor() {
    this.setupProcessHandlers();
  }

  public static getInstance(): RedisConnection {
    if (!RedisConnection.instance) {
      RedisConnection.instance = new RedisConnection();
    }
    return RedisConnection.instance;
  }

  public async connect(): Promise<void> {
    if (this.connectionState === RedisConnectionState.CONNECTED) {
      return;
    }

    if (this.connectionState === RedisConnectionState.CONNECTING) {
      throw new Error('Redis connection already in progress');
    }

    this.connectionState = RedisConnectionState.CONNECTING;

    try {
      // Load config here to ensure mocks are properly set up
      this.config = redisConfig.getConfig();
      
      // Validate environment configuration
      const validation = redisConfig.validateEnvironment();
      if (!validation.isValid) {
        throw new Error(`Missing required Redis environment variables: ${validation.missingVars.join(', ')}`);
      }

      if (this.config.cluster?.enabled && this.config.cluster.nodes) {
        await this.connectCluster();
      } else {
        await this.connectSingle();
      }

      this.connectionState = RedisConnectionState.CONNECTED;
      this.lastError = null;
      this.reconnectAttempts = 0;

      console.log('✅ Redis connection established successfully');
    } catch (error) {
      this.connectionState = RedisConnectionState.ERROR;
      this.lastError = error instanceof Error ? error.message : 'Unknown error';
      console.error('❌ Redis connection failed:', this.lastError);
      
      // Attempt reconnection with exponential backoff
      await this.handleReconnection();
      throw error;
    }
  }

  private async connectSingle(): Promise<void> {
    const options = redisConfig.getConnectionOptions();
    this.client = createClient(options) as RedisClientType;

    this.setupClientEventHandlers(this.client);
    await this.client.connect();
  }

  private async connectCluster(): Promise<void> {
    if (!this.config?.cluster?.nodes || this.config.cluster.nodes.length === 0) {
      throw new Error('Redis cluster nodes not configured');
    }

    const clusterOptions = {
      rootNodes: this.config.cluster.nodes.map(node => {
        const [host, port] = node.split(':');
        return {
          socket: {
            host: host || 'localhost',
            port: parseInt(port || '6379', 10)
          }
        };
      }),
      defaults: {
        socket: {
          connectTimeout: this.config.connectTimeout,
          commandTimeout: this.config.commandTimeout
        }
      }
    };

    // Only add password if it exists
    if (this.config.password) {
      (clusterOptions.defaults as any).password = this.config.password;
    }

    this.client = createCluster(clusterOptions) as RedisClusterType;
    this.setupClientEventHandlers(this.client);
    await this.client.connect();
  }

  private setupClientEventHandlers(client: RedisClientType | RedisClusterType): void {
    client.on('error', (error: Error) => {
      this.connectionState = RedisConnectionState.ERROR;
      this.lastError = error.message;
      console.error('Redis client error:', error.message);
    });

    client.on('connect', () => {
      console.log('Redis client connected');
    });

    client.on('ready', () => {
      this.connectionState = RedisConnectionState.CONNECTED;
      console.log('Redis client ready');
    });

    client.on('end', () => {
      this.connectionState = RedisConnectionState.DISCONNECTED;
      console.log('Redis client disconnected');
    });

    client.on('reconnecting', () => {
      this.connectionState = RedisConnectionState.CONNECTING;
      console.log('Redis client reconnecting...');
    });
  }

  private async handleReconnection(): Promise<void> {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error(`Max reconnection attempts (${this.maxReconnectAttempts}) reached`);
      return;
    }

    this.reconnectAttempts++;
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    
    console.log(`Attempting Redis reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
    
    setTimeout(async () => {
      try {
        await this.connect();
      } catch (error) {
        console.error('Redis reconnection failed:', error);
      }
    }, delay);
  }

  public async disconnect(): Promise<void> {
    if (!this.client || this.connectionState === RedisConnectionState.DISCONNECTED) {
      return;
    }

    this.connectionState = RedisConnectionState.DISCONNECTING;

    try {
      await this.client.quit();
      this.connectionState = RedisConnectionState.DISCONNECTED;
      console.log('✅ Redis disconnected gracefully');
    } catch (error) {
      console.error('❌ Error during Redis disconnection:', error);
      this.connectionState = RedisConnectionState.ERROR;
      throw error;
    } finally {
      this.client = null;
    }
  }

  public getClient(): RedisClientType | RedisClusterType {
    if (!this.client || this.connectionState !== RedisConnectionState.CONNECTED) {
      throw new Error('Redis client not connected');
    }
    return this.client;
  }

  public getConnectionState(): RedisConnectionState {
    return this.connectionState;
  }

  public async ping(): Promise<string> {
    if (!this.client || this.connectionState !== RedisConnectionState.CONNECTED) {
      throw new Error('Redis client not connected');
    }

    try {
      // Handle both single and cluster clients
      if ('ping' in this.client) {
        const result = await this.client.ping();
        return result;
      } else {
        // For cluster, use a random node
        const result = await (this.client as any).sendCommand(['PING']);
        return result;
      }
    } catch (error) {
      this.lastError = error instanceof Error ? error.message : 'Ping failed';
      throw error;
    }
  }

  public async getHealthStatus(): Promise<RedisHealthStatus> {
    const healthStatus: RedisHealthStatus = {
      state: this.connectionState
    };

    if (this.lastError) {
      healthStatus.lastError = this.lastError;
    }

    if (this.connectionState === RedisConnectionState.CONNECTED && this.client) {
      try {
        // Get Redis server info - handle both single and cluster
        let info: string;
        if ('info' in this.client) {
          info = await this.client.info();
        } else {
          // For cluster, get info from a random node
          info = await (this.client as any).sendCommand(['INFO']);
        }
        
        const infoLines = info.split('\r\n');
        
        // Parse server uptime
        const uptimeLine = infoLines.find((line: string) => line.startsWith('uptime_in_seconds:'));
        if (uptimeLine) {
          const uptimeValue = uptimeLine.split(':')[1];
          if (uptimeValue) {
            healthStatus.uptime = parseInt(uptimeValue, 10);
          }
        }

        // Parse connected clients
        const clientsLine = infoLines.find((line: string) => line.startsWith('connected_clients:'));
        if (clientsLine) {
          const clientsValue = clientsLine.split(':')[1];
          if (clientsValue) {
            healthStatus.connectedClients = parseInt(clientsValue, 10);
          }
        }

        // Check cluster information
        if (this.config?.cluster?.enabled) {
          healthStatus.clusterInfo = {
            clusterEnabled: true
          };

          try {
            // For cluster, get cluster info
            const clusterInfo = await (this.client as any).sendCommand(['CLUSTER', 'INFO']);
            const clusterState = clusterInfo.split('\r\n').find((line: string) => line.startsWith('cluster_state:'))?.split(':')[1];
            const clusterSizeLine = clusterInfo.split('\r\n').find((line: string) => line.startsWith('cluster_size:'))?.split(':')[1];
            
            healthStatus.clusterInfo.clusterState = clusterState;
            if (clusterSizeLine) {
              healthStatus.clusterInfo.clusterSize = parseInt(clusterSizeLine, 10);
            }
          } catch (clusterError) {
            console.error('Error getting cluster info:', clusterError);
          }
        } else {
          healthStatus.clusterInfo = {
            clusterEnabled: false
          };
        }
      } catch (error) {
        console.error('Error getting Redis health status:', error);
        healthStatus.lastError = error instanceof Error ? error.message : 'Health check failed';
      }
    }

    return healthStatus;
  }

  public buildKey(prefix: 'auth' | 'cache' | 'session', key: string): string {
    if (!this.config) {
      this.config = redisConfig.getConfig();
    }
    return `${this.config.keyPrefixes[prefix]}${key}`;
  }

  private setupProcessHandlers(): void {
    const handleShutdown = async (signal: string) => {
      console.log(`Received ${signal}. Shutting down Redis connection gracefully...`);
      try {
        await this.disconnect();
        process.exit(0);
      } catch (error) {
        console.error('Error during Redis shutdown:', error);
        process.exit(1);
      }
    };

    process.on('SIGINT', () => handleShutdown('SIGINT'));
    process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  }
}

export const redis = RedisConnection.getInstance();
export default redis; 