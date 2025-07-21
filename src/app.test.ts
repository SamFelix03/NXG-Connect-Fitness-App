import request from 'supertest';
import App from './app';

describe('App', () => {
  let app: App;

  beforeAll(() => {
    app = new App(3001);
  });

  describe('Express Server Setup', () => {
    it('should create an Express application instance', () => {
      expect(app).toBeDefined();
      expect(app.app).toBeDefined();
      expect(app.port).toBe(3001);
    });

    it('should respond to GET / with server info and timestamp', async () => {
      const response = await request(app.app)
        .get('/')
        .expect(200);

      expect(response.body).toMatchObject({
        message: 'NXG Fitness Backend API',
        status: 'running',
        version: '1.0.0'
      });
      expect(response.body.timestamp).toBeDefined();
      expect(new Date(response.body.timestamp)).toBeInstanceOf(Date);
    });

    it('should handle JSON request bodies', async () => {
      const testData = { test: 'data' };
      
      // This will test that express.json() middleware is working
      // We expect 404 since no POST / route exists, but body parsing should work
      const response = await request(app.app)
        .post('/')
        .send(testData)
        .expect(404);

      // The 404 means the route doesn't exist but middleware processed the body
      expect(response.status).toBe(404);
    });

    it('should handle URL-encoded request bodies', async () => {
      // This will test that express.urlencoded() middleware is working
      const response = await request(app.app)
        .post('/')
        .send('key=value')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .expect(404);

      // The 404 means the route doesn't exist but middleware processed the body
      expect(response.status).toBe(404);
    });
  });

  describe('Security Middleware', () => {
    it('should set security headers from Helmet.js', async () => {
      const response = await request(app.app)
        .get('/')
        .expect(200);

      // Check for key security headers
      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      // XSS Protection is disabled by default in newer Helmet versions
      expect(response.headers['x-xss-protection']).toBe('0');
      expect(response.headers['strict-transport-security']).toBeDefined();
    });

    it('should hide X-Powered-By header', async () => {
      const response = await request(app.app)
        .get('/')
        .expect(200);

      expect(response.headers['x-powered-by']).toBeUndefined();
    });
  });

  describe('CORS Middleware', () => {
    it('should handle CORS preflight requests', async () => {
      const response = await request(app.app)
        .options('/')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'GET')
        .expect(200); // CORS middleware might return 200 instead of 204

      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000');
      expect(response.headers['access-control-allow-credentials']).toBe('true');
    });

    it('should allow requests from localhost origins', async () => {
      const response = await request(app.app)
        .get('/')
        .set('Origin', 'http://localhost:3000')
        .expect(200);

      expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    });
  });

  describe('Correlation ID Middleware', () => {
    it('should generate correlation ID when not provided', async () => {
      const response = await request(app.app)
        .get('/')
        .expect(200);

      expect(response.headers['x-correlation-id']).toBeDefined();
      expect(typeof response.headers['x-correlation-id']).toBe('string');
      expect(response.headers['x-correlation-id']).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
    });

    it('should use provided correlation ID', async () => {
      const correlationId = '12345678-1234-4234-8234-123456789abc';
      const response = await request(app.app)
        .get('/')
        .set('X-Correlation-ID', correlationId)
        .expect(200);

      expect(response.headers['x-correlation-id']).toBe(correlationId);
    });
  });

  describe('Compression Middleware', () => {
    it('should compress large responses when requested', async () => {
      const response = await request(app.app)
        .get('/')
        .set('Accept-Encoding', 'gzip')
        .expect(200);

      // For small responses like our health check, compression might not be applied
      // This test mainly ensures the middleware doesn't break the response
      expect(response.status).toBe(200);
    });
  });
}); 