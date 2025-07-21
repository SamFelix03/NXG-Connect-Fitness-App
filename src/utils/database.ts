import mongoose from 'mongoose';
import { getDatabaseConfig, DatabaseConfig, DatabaseConnectionState } from '../config/database.config';

// Database connection class with retry logic and monitoring
export class Database {
  private config: DatabaseConfig;
  private connectionState: DatabaseConnectionState = DatabaseConnectionState.DISCONNECTED;
  private retryCount: number = 0;
  private retryTimeoutId: NodeJS.Timeout | null = null;

  constructor() {
    this.config = getDatabaseConfig();
    this.setupEventListeners();
  }

  // Setup Mongoose event listeners for connection monitoring
  private setupEventListeners(): void {
    // Connection opened
    mongoose.connection.on('connected', () => {
      this.connectionState = DatabaseConnectionState.CONNECTED;
      this.retryCount = 0; // Reset retry count on successful connection
      console.log(`✅ MongoDB connected to ${this.config.uri.replace(/\/\/.*@/, '//***:***@')}`);
    });

    // Connection error
    mongoose.connection.on('error', (error: Error) => {
      this.connectionState = DatabaseConnectionState.DISCONNECTED;
      console.error('❌ MongoDB connection error:', error.message);
    });

    // Connection disconnected
    mongoose.connection.on('disconnected', () => {
      this.connectionState = DatabaseConnectionState.DISCONNECTED;
      console.log('⚠️ MongoDB disconnected');
    });

    // Connection reconnected
    mongoose.connection.on('reconnected', () => {
      this.connectionState = DatabaseConnectionState.CONNECTED;
      console.log('🔄 MongoDB reconnected');
    });

    // Process termination handling
    process.on('SIGINT', async () => {
      await this.disconnect();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      await this.disconnect();
      process.exit(0);
    });
  }

  // Connect to MongoDB with retry logic
  public async connect(): Promise<void> {
    if (this.connectionState === DatabaseConnectionState.CONNECTED) {
      console.log('📡 Database already connected');
      return;
    }

    if (this.connectionState === DatabaseConnectionState.CONNECTING) {
      console.log('⏳ Database connection already in progress');
      return;
    }

    this.connectionState = DatabaseConnectionState.CONNECTING;

    try {
      console.log(`🔗 Connecting to MongoDB (attempt ${this.retryCount + 1}/${this.config.retryOptions.maxRetries + 1})...`);
      
      await mongoose.connect(this.config.uri, this.config.options);
      
      console.log('🎉 MongoDB connection established successfully');
    } catch (error) {
      this.connectionState = DatabaseConnectionState.DISCONNECTED;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ MongoDB connection failed: ${errorMessage}`);

      // Implement exponential backoff retry logic
      if (this.retryCount < this.config.retryOptions.maxRetries) {
        await this.scheduleRetry();
      } else {
        console.error(`💥 Maximum retry attempts (${this.config.retryOptions.maxRetries}) exceeded. Giving up.`);
        throw new Error(`Failed to connect to MongoDB after ${this.config.retryOptions.maxRetries + 1} attempts: ${errorMessage}`);
      }
    }
  }

  // Schedule retry with exponential backoff
  private async scheduleRetry(): Promise<void> {
    this.retryCount++;
    
    // Calculate delay with exponential backoff
    const delay = Math.min(
      this.config.retryOptions.initialRetryDelay * Math.pow(this.config.retryOptions.retryDelayMultiplier, this.retryCount - 1),
      this.config.retryOptions.maxRetryDelay
    );

    console.log(`🔄 Retrying connection in ${delay}ms (attempt ${this.retryCount}/${this.config.retryOptions.maxRetries})...`);

    return new Promise((resolve) => {
      this.retryTimeoutId = setTimeout(async () => {
        try {
          await this.connect();
          resolve();
        } catch (error) {
          resolve(); // Error handling is done in connect method
        }
      }, delay);
    });
  }

  // Disconnect from MongoDB
  public async disconnect(): Promise<void> {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
      this.retryTimeoutId = null;
    }

    if (this.connectionState === DatabaseConnectionState.DISCONNECTED) {
      console.log('📡 Database already disconnected');
      return;
    }

    this.connectionState = DatabaseConnectionState.DISCONNECTING;

    try {
      await mongoose.disconnect();
      this.connectionState = DatabaseConnectionState.DISCONNECTED;
      console.log('👋 MongoDB disconnected gracefully');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error(`❌ Error during MongoDB disconnection: ${errorMessage}`);
      throw error;
    }
  }

  // Get current connection state
  public getConnectionState(): DatabaseConnectionState {
    return this.connectionState;
  }

  // Check if database is connected
  public isConnected(): boolean {
    return this.connectionState === DatabaseConnectionState.CONNECTED && mongoose.connection.readyState === 1;
  }

  // Get database connection health info
  public getHealthInfo(): { connected: boolean; state: string; readyState: number; host?: string; name?: string } {
    return {
      connected: this.isConnected(),
      state: DatabaseConnectionState[this.connectionState],
      readyState: mongoose.connection.readyState,
      host: mongoose.connection.host,
      name: mongoose.connection.name,
    };
  }

  // Test database connectivity
  public async ping(): Promise<boolean> {
    try {
      if (!this.isConnected()) {
        return false;
      }

      // Simple ping by running admin command
      const admin = mongoose.connection.db?.admin();
      if (admin) {
        await admin.ping();
        return true;
      }
      return false;
    } catch (error) {
      console.error('❌ Database ping failed:', error);
      return false;
    }
  }
}

// Singleton instance
const database = new Database();

// Export singleton instance
export default database; 