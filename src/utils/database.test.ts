import { Database } from './database';
import { DatabaseConnectionState } from '../config/database.config';
import mongoose from 'mongoose';

// Mock mongoose
jest.mock('mongoose', () => ({
  connect: jest.fn(),
  disconnect: jest.fn(),
  connection: {
    on: jest.fn(),
    readyState: 1,
    host: 'localhost',
    name: 'test_db',
    db: {
      admin: () => ({
        ping: jest.fn().mockResolvedValue({}),
      }),
    },
  },
}));

// Mock process event listeners to prevent memory leak warnings
const originalProcessOn = process.on;
const processListeners: Array<{ event: string; listener: Function }> = [];

beforeAll(() => {
  process.on = jest.fn((event: string, listener: Function) => {
    processListeners.push({ event, listener });
    return process;
  }) as any;
});

afterAll(() => {
  process.on = originalProcessOn;
  processListeners.length = 0;
});

describe('Database', () => {
  let database: Database;
  const mockMongoose = mongoose as jest.Mocked<typeof mongoose>;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset environment variables
    process.env['NODE_ENV'] = 'test';
    process.env['MONGODB_TEST_URI'] = 'mongodb://localhost:27017/nxg_fitness_test';
    
    // Reset connection state
    Object.defineProperty(mockMongoose.connection, 'readyState', {
      value: 1,
      writable: true,
      configurable: true,
    });
    
    database = new Database();
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  describe('Constructor', () => {
    it('should initialize with disconnected state', () => {
      expect(database.getConnectionState()).toBe(DatabaseConnectionState.DISCONNECTED);
    });

    it('should setup event listeners', () => {
      expect(mockMongoose.connection.on).toHaveBeenCalledWith('connected', expect.any(Function));
      expect(mockMongoose.connection.on).toHaveBeenCalledWith('error', expect.any(Function));
      expect(mockMongoose.connection.on).toHaveBeenCalledWith('disconnected', expect.any(Function));
      expect(mockMongoose.connection.on).toHaveBeenCalledWith('reconnected', expect.any(Function));
    });
  });

  describe('connect()', () => {
    it('should connect to MongoDB successfully', async () => {
      mockMongoose.connect.mockResolvedValue(undefined as any);

      await database.connect();

      expect(mockMongoose.connect).toHaveBeenCalledWith(
        'mongodb://localhost:27017/nxg_fitness_test',
        expect.objectContaining({
          minPoolSize: 5,
          maxPoolSize: 10,
          appName: 'nxg-fitness-test',
        })
      );
    });

    it('should handle connection failure and retry', async () => {
      const connectionError = new Error('Connection failed');
      mockMongoose.connect
        .mockRejectedValueOnce(connectionError)
        .mockResolvedValueOnce(undefined as any);

      // Use fake timers and spy on scheduleRetry
      jest.useFakeTimers();
      const scheduleRetrySpy = jest.spyOn(database as any, 'scheduleRetry');

      const connectPromise = database.connect();

      // Wait for first connection attempt to fail
      await Promise.resolve();

      // Verify scheduleRetry was called
      expect(scheduleRetrySpy).toHaveBeenCalled();

      // Fast-forward time to trigger retry
      jest.advanceTimersByTime(1000);

      await connectPromise;

      expect(mockMongoose.connect).toHaveBeenCalledTimes(2);
    }, 15000);

    it('should not connect if already connected', async () => {
      // Simulate already connected state
      (database as any).connectionState = DatabaseConnectionState.CONNECTED;

      await database.connect();

      expect(mockMongoose.connect).not.toHaveBeenCalled();
    });

    it('should not connect if connection is in progress', async () => {
      // Simulate connecting state
      (database as any).connectionState = DatabaseConnectionState.CONNECTING;

      await database.connect();

      expect(mockMongoose.connect).not.toHaveBeenCalled();
    });
  });

  describe('disconnect()', () => {
    it('should disconnect from MongoDB successfully', async () => {
      // Simulate connected state
      (database as any).connectionState = DatabaseConnectionState.CONNECTED;
      mockMongoose.disconnect.mockResolvedValue();

      await database.disconnect();

      expect(mockMongoose.disconnect).toHaveBeenCalled();
      expect(database.getConnectionState()).toBe(DatabaseConnectionState.DISCONNECTED);
    });

    it('should handle disconnection error', async () => {
      // Simulate connected state
      (database as any).connectionState = DatabaseConnectionState.CONNECTED;
      const disconnectError = new Error('Disconnect failed');
      mockMongoose.disconnect.mockRejectedValue(disconnectError);

      await expect(database.disconnect()).rejects.toThrow('Disconnect failed');
    });

    it('should not disconnect if already disconnected', async () => {
      await database.disconnect();

      expect(mockMongoose.disconnect).not.toHaveBeenCalled();
    });
  });

  describe('isConnected()', () => {
    it('should return true when connected', () => {
      (database as any).connectionState = DatabaseConnectionState.CONNECTED;
      Object.defineProperty(mockMongoose.connection, 'readyState', {
        value: 1,
        configurable: true,
      });

      expect(database.isConnected()).toBe(true);
    });

    it('should return false when not connected', () => {
      (database as any).connectionState = DatabaseConnectionState.DISCONNECTED;
      Object.defineProperty(mockMongoose.connection, 'readyState', {
        value: 0,
        configurable: true,
      });

      expect(database.isConnected()).toBe(false);
    });
  });

  describe('getHealthInfo()', () => {
    it('should return health information', () => {
      (database as any).connectionState = DatabaseConnectionState.CONNECTED;

      const healthInfo = database.getHealthInfo();

      expect(healthInfo).toEqual({
        connected: true,
        state: 'CONNECTED',
        readyState: 1,
        host: 'localhost',
        name: 'test_db',
      });
    });
  });

  describe('ping()', () => {
    it('should return true when ping is successful', async () => {
      (database as any).connectionState = DatabaseConnectionState.CONNECTED;
      Object.defineProperty(mockMongoose.connection, 'readyState', {
        value: 1,
        configurable: true,
      });

      const result = await database.ping();

      expect(result).toBe(true);
    });

    it('should return false when not connected', async () => {
      (database as any).connectionState = DatabaseConnectionState.DISCONNECTED;

      const result = await database.ping();

      expect(result).toBe(false);
    });

    it('should return false when ping fails', async () => {
      (database as any).connectionState = DatabaseConnectionState.CONNECTED;
      Object.defineProperty(mockMongoose.connection, 'readyState', {
        value: 1,
        configurable: true,
      });
      
      // Mock admin().ping() to throw error
      Object.defineProperty(mockMongoose.connection, 'db', {
        value: {
          admin: () => ({
            ping: jest.fn().mockRejectedValue(new Error('Ping failed')),
          }),
        },
        configurable: true,
      });

      const result = await database.ping();

      expect(result).toBe(false);
    });
  });
}); 