import compression from 'compression';
import { Request, Response } from 'express';

// Compression middleware configuration
const compressionMiddleware = compression({
  // Only compress responses that are larger than 1kb
  threshold: 1024,
  
  // Compression level (1-9, where 6 is default)
  level: 6,
  
  // Filter function to determine what to compress
  filter: (req: Request, res: Response) => {
    // Don't compress if explicitly disabled
    if (req.headers['x-no-compression']) {
      return false;
    }
    
    // Compress everything else that compression filter thinks should be compressed
    return compression.filter(req, res);
  },
});

export default compressionMiddleware;