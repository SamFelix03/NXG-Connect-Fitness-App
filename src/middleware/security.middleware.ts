import helmet from 'helmet';

// Security middleware configuration for API
const securityMiddleware = helmet({
  // Content Security Policy for API - more permissive for API endpoints
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      blockAllMixedContent: [],
      fontSrc: ["'self'", 'https:', 'data:'],
      frameAncestors: ["'none'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      objectSrc: ["'none'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", 'https:', "'unsafe-inline'"],
      upgradeInsecureRequests: [],
    },
  },
  
  // Cross-Origin-Resource-Policy for API
  crossOriginResourcePolicy: { 
    policy: 'cross-origin' // Allow cross-origin requests for API
  },

  // DNS Prefetch Control
  dnsPrefetchControl: {
    allow: false
  },

  // Frameguard to prevent clickjacking
  frameguard: {
    action: 'deny'
  },

  // Hide X-Powered-By header
  hidePoweredBy: true,

  // HTTP Strict Transport Security
  hsts: {
    maxAge: 31536000, // 1 year
    includeSubDomains: true,
    preload: true
  },

  // IE No Open for IE8+
  ieNoOpen: true,

  // Don't sniff mimetype
  noSniff: true,

  // Origin Agent Cluster
  originAgentCluster: true,

  // Permitted Cross-Domain Policies
  permittedCrossDomainPolicies: false,

  // Referrer Policy
  referrerPolicy: {
    policy: ['no-referrer', 'strict-origin-when-cross-origin']
  },

  // X-XSS-Protection
  xssFilter: true,
});

export default securityMiddleware; 