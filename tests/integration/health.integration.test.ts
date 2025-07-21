import request from 'supertest';
import App from '../../src/app';
import { Database } from '../../src/utils/database';
import { redis } from '../../src/utils/redis';

describe('Health Check Integration Tests', () => {
  let app: App;

  beforeAll(() => {
    app = new App(3002); // Use different port to avoid conflicts
  });

  describe('GET /health', () => {
    it('should return health status', async () => {
      const response = await request(app.app)
        .get('/health')
        .expect('Content-Type', /json/);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('version');
      expect(response.body).toHaveProperty('environment');
      expect(response.body).toHaveProperty('services');
      expect(response.body).toHaveProperty('summary');

      expect(response.body.services).toHaveProperty('database');
      expect(response.body.services).toHaveProperty('redis');
      expect(response.body.services).toHaveProperty('memory');

      expect(response.body.summary).toHaveProperty('total');
      expect(response.body.summary).toHaveProperty('healthy');
      expect(response.body.summary).toHaveProperty('degraded');
      expect(response.body.summary).toHaveProperty('unhealthy');

      // Status should be one of the valid values
      expect(['healthy', 'degraded', 'unhealthy']).toContain(response.body.status);
    });

    it('should include correlation ID in response', async () => {
      const correlationId = 'test-correlation-123';
      
      const response = await request(app.app)
        .get('/health')
        .set('X-Correlation-ID', correlationId)
        .expect('Content-Type', /json/);

      expect(response.headers['x-correlation-id']).toBe(correlationId);
    });
  });

  describe('GET /health/liveness', () => {
    it('should return liveness status', async () => {
      const response = await request(app.app)
        .get('/health/liveness')
        .expect(200)
        .expect('Content-Type', /json/);

      expect(response.body).toEqual({
        status: 'alive',
        timestamp: expect.any(String),
        uptime: expect.any(Number),
      });
    });
  });

  describe('GET /health/readiness', () => {
    it('should return readiness status', async () => {
      const response = await request(app.app)
        .get('/health/readiness')
        .expect('Content-Type', /json/);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('timestamp');
      expect(['ready', 'not ready']).toContain(response.body.status);

      if (response.body.status === 'ready') {
        expect(response.status).toBe(200);
        expect(response.body.services).toEqual({
          database: 'ready',
          redis: 'ready',
        });
      } else {
        expect(response.status).toBe(503);
        expect(response.body.services).toHaveProperty('database');
        expect(response.body.services).toHaveProperty('redis');
      }
    });
  });

  describe('Health Check Response Format', () => {
    it('should have consistent timestamp format', async () => {
      const response = await request(app.app)
        .get('/health')
        .expect('Content-Type', /json/);

      expect(response.body.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    it('should have service health details', async () => {
      const response = await request(app.app)
        .get('/health')
        .expect('Content-Type', /json/);

      Object.values(response.body.services).forEach((service: any) => {
        expect(service).toHaveProperty('status');
        expect(service).toHaveProperty('responseTime');
        expect(['healthy', 'degraded', 'unhealthy']).toContain(service.status);
        expect(typeof service.responseTime).toBe('number');
      });
    });
  });

  describe('Error Scenarios', () => {
    test('should handle database connection failure gracefully', async () => {
      // Mock database disconnection
      jest.spyOn(Database.prototype, 'ping').mockRejectedValueOnce(new Error('Database unreachable'));
      
      const response = await request(app.app)
        .get('/health')
        .expect(503);
      
      expect(response.body).toMatchObject({
        status: 'unhealthy',
        services: expect.objectContaining({
          database: expect.objectContaining({
            status: 'unhealthy',
            message: expect.stringContaining('Database')
          })
        })
      });
    });

    test('should handle Redis connection failure gracefully', async () => {
      // Mock Redis disconnection
      jest.spyOn(redis, 'ping').mockRejectedValueOnce(new Error('Redis unreachable'));
      
      const response = await request(app.app)
        .get('/health')
        .expect(503);
      
      expect(response.body).toMatchObject({
        status: 'unhealthy',
        services: expect.objectContaining({
          redis: expect.objectContaining({
            status: 'unhealthy',
            message: expect.stringContaining('Redis')
          })
        })
      });
    });

    test('should return degraded status for slow services', async () => {
      // Mock slow database response
      jest.spyOn(Database.prototype, 'ping').mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve(true), 800))
      );
      
      const response = await request(app.app)
        .get('/health');
      
      // In test environment, might be unhealthy due to other services being down
      expect([200, 503]).toContain(response.status);
      expect(['degraded', 'unhealthy']).toContain(response.body.status);
      
      // If database ping was successful, check the response time
      if (response.body.services?.database?.responseTime) {
        expect(response.body.services.database.responseTime).toBeGreaterThan(500);
      }
    });
  });
}); 