import cors, { CorsOptions } from 'cors';

// CORS configuration with origin validation
const corsOptions: CorsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, origin?: boolean | string | RegExp | (boolean | string | RegExp)[]) => void) => {
    // Allow requests with no origin (like mobile apps or curl requests) in development
    if (!origin && process.env['NODE_ENV'] === 'development') {
      return callback(null, true);
    }

    // Define allowed origins based on environment
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'https://localhost:3000',
      'https://localhost:3001',
    ];

    // Add production origins from environment variables
    if (process.env['FRONTEND_URL']) {
      allowedOrigins.push(process.env['FRONTEND_URL']);
    }

    if (process.env['ADMIN_URL']) {
      allowedOrigins.push(process.env['ADMIN_URL']);
    }

    // Check if the origin is allowed
    if (!origin || allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS policy'), false);
    }
  },
  credentials: true, // Allow cookies and authorization headers
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'Cache-Control',
    'X-Correlation-ID'
  ],
  exposedHeaders: ['X-Correlation-ID'],
  maxAge: 86400, // Cache preflight response for 24 hours
  optionsSuccessStatus: 200, // Support legacy browsers
};

export default cors(corsOptions); 