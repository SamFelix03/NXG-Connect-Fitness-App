// Jest setup file for test configuration
import { jest } from '@jest/globals';

// Type declarations for global test utilities
declare global {
  var testUtils: {
    generateTestId: () => string;
    createMockRequest: (overrides?: any) => any;
    createMockResponse: () => any;
  };
}

// Increase timeout for integration tests
jest.setTimeout(30000);

// Mock console methods in test environment
if (process.env['NODE_ENV'] === 'test') {
  global.console = {
    ...console,
    // Keep log and warn for debugging
    log: jest.fn(),
    warn: jest.fn(),
    // Silence info, debug, and error in tests unless needed
    info: jest.fn(),
    debug: jest.fn(),
    error: jest.fn()
  };
}

// Global test utilities
global.testUtils = {
  generateTestId: () => `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
  createMockRequest: (overrides = {}) => ({
    body: {},
    params: {},
    query: {},
    headers: {},
    ...overrides
  }),
  createMockResponse: () => {
    const res: any = {};
    res.status = jest.fn().mockReturnValue(res);
    res.json = jest.fn().mockReturnValue(res);
    res.send = jest.fn().mockReturnValue(res);
    res.end = jest.fn().mockReturnValue(res);
    return res;
  }
};

// Setup test environment variables
process.env['NODE_ENV'] = 'test';
process.env['PORT'] = '3001';

export {}; 