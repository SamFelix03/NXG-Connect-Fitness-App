import AWS from 'aws-sdk';
import sharp from 'sharp';
import { logger } from '../utils/logger';
import crypto from 'crypto';
import path from 'path';

/**
 * File Storage Service
 * 
 * This service manages file storage and CDN integration for meal images:
 * 1. Upload images to AWS S3 with organized folder structure
 * 2. Generate CloudFront CDN URLs for optimized delivery
 * 3. Implement image optimization pipeline with Sharp
 * 4. Handle secure signed URLs for private access
 * 5. Manage cleanup of orphaned images
 */

interface UploadImageOptions {
  userId: string;
  mealId: string;
  originalBuffer: Buffer;
  originalName: string;
  optimize?: boolean;
  makePublic?: boolean;
}

interface UploadResult {
  s3Key: string;
  s3Url: string;
  cdnUrl: string;
  contentType: string;
  size: number;
  uploadedAt: Date;
}

interface ImageOptimizationOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'jpeg' | 'png' | 'webp';
}

class FileStorageService {
  private s3: AWS.S3;
  private bucketName: string;
  private cdnDomain: string;
  private region: string;

  constructor() {
    this.bucketName = process.env['S3_BUCKET_NAME'] || 'nxg-fitness-meals';
    this.cdnDomain = process.env['CLOUDFRONT_DOMAIN'] || 'cdn.nxg-fitness.com';
    this.region = process.env['AWS_REGION'] || 'us-east-1';

    // Configure AWS SDK
    const awsAccessKeyId = process.env['AWS_ACCESS_KEY_ID'];
    const awsSecretAccessKey = process.env['AWS_SECRET_ACCESS_KEY'];
    
    if (awsAccessKeyId && awsSecretAccessKey) {
      AWS.config.update({
        region: this.region,
        accessKeyId: awsAccessKeyId,
        secretAccessKey: awsSecretAccessKey
      });
    }

    this.s3 = new AWS.S3({
      region: this.region,
      signatureVersion: 'v4'
    });
  }

  /**
   * Upload meal image to S3 with optimization
   */
  async uploadMealImage(options: UploadImageOptions): Promise<UploadResult> {
    try {
      const startTime = Date.now();
      const uploadId = crypto.randomUUID();

      logger.info('Starting meal image upload', {
        service: 'file-storage-service',
        userId: options.userId,
        mealId: options.mealId,
        originalName: options.originalName,
        originalSize: options.originalBuffer.length,
        uploadId,
        event: 'upload-start'
      });

      // Optimize image if requested
      let processedBuffer = options.originalBuffer;
      let contentType = this.getContentType(options.originalName);

      if (options.optimize) {
        const optimized = await this.optimizeImage(options.originalBuffer, {
          maxWidth: 1024,
          maxHeight: 1024,
          quality: 85,
          format: 'jpeg'
        });
        processedBuffer = optimized.buffer;
        contentType = 'image/jpeg';
      }

      // Generate S3 key with organized structure
      const s3Key = this.generateS3Key(options.userId, options.mealId, contentType);

      // Upload to S3
      const uploadParams: AWS.S3.PutObjectRequest = {
        Bucket: this.bucketName,
        Key: s3Key,
        Body: processedBuffer,
        ContentType: contentType,
        Metadata: {
          userId: options.userId,
          mealId: options.mealId,
          originalName: options.originalName,
          uploadId,
          uploadedAt: new Date().toISOString()
        },
        ServerSideEncryption: 'AES256',
        StorageClass: 'STANDARD'
      };

      if (options.makePublic) {
        uploadParams.ACL = 'public-read';
      }

      const uploadResult = await this.s3.upload(uploadParams).promise();
      
      // Generate URLs
      const s3Url = uploadResult.Location;
      const cdnUrl = `https://${this.cdnDomain}/${s3Key}`;

      const duration = Date.now() - startTime;

      logger.info('Meal image uploaded successfully', {
        service: 'file-storage-service',
        userId: options.userId,
        mealId: options.mealId,
        s3Key,
        s3Url,
        cdnUrl,
        fileSize: processedBuffer.length,
        duration,
        uploadId,
        event: 'upload-success'
      });

      return {
        s3Key,
        s3Url,
        cdnUrl,
        contentType,
        size: processedBuffer.length,
        uploadedAt: new Date()
      };

    } catch (error) {
      logger.error('Failed to upload meal image', error as Error, {
        service: 'file-storage-service',
        userId: options.userId,
        mealId: options.mealId,
        event: 'upload-error'
      });
      throw error;
    }
  }

  /**
   * Generate signed URL for private access to meal image
   */
  async getSignedUrl(s3Key: string, expiresIn: number = 3600): Promise<string> {
    try {
      const params = {
        Bucket: this.bucketName,
        Key: s3Key,
        Expires: expiresIn
      };

      const signedUrl = await this.s3.getSignedUrlPromise('getObject', params);

      logger.debug('Generated signed URL for meal image', {
        service: 'file-storage-service',
        s3Key,
        expiresIn,
        event: 'signed-url-generated'
      });

      return signedUrl;
    } catch (error) {
      logger.error('Failed to generate signed URL', error as Error, {
        service: 'file-storage-service',
        s3Key,
        event: 'signed-url-error'
      });
      throw error;
    }
  }

  /**
   * Delete meal image from S3
   */
  async deleteMealImage(s3Key: string): Promise<void> {
    try {
      const params = {
        Bucket: this.bucketName,
        Key: s3Key
      };

      await this.s3.deleteObject(params).promise();

      logger.info('Meal image deleted successfully', {
        service: 'file-storage-service',
        s3Key,
        event: 'delete-success'
      });
    } catch (error) {
      logger.error('Failed to delete meal image', error as Error, {
        service: 'file-storage-service',
        s3Key,
        event: 'delete-error'
      });
      throw error;
    }
  }

  /**
   * Cleanup orphaned meal images for a user
   */
  async cleanupOrphanedImages(userId: string, activeMealIds: string[]): Promise<number> {
    try {
      logger.info('Starting orphaned images cleanup', {
        service: 'file-storage-service',
        userId,
        activeMealCount: activeMealIds.length,
        event: 'cleanup-start'
      });

      // List all objects for user
      const listParams = {
        Bucket: this.bucketName,
        Prefix: `meals/user${userId}/`
      };

      const objects = await this.s3.listObjectsV2(listParams).promise();
      
      if (!objects.Contents || objects.Contents.length === 0) {
        return 0;
      }

      // Filter orphaned objects
      const orphanedObjects = objects.Contents.filter(obj => {
        if (!obj.Key) return false;
        
        const mealIdMatch = obj.Key.match(/meal([^/.]+)/);
        if (!mealIdMatch || !mealIdMatch[1]) return false;
        
        const mealId = mealIdMatch[1];
        return !activeMealIds.includes(mealId);
      });

      if (orphanedObjects.length === 0) {
        logger.info('No orphaned images found', {
          service: 'file-storage-service',
          userId,
          event: 'cleanup-complete'
        });
        return 0;
      }

      // Delete orphaned objects
      const deleteParams = {
        Bucket: this.bucketName,
        Delete: {
          Objects: orphanedObjects.map(obj => ({ Key: obj.Key! })),
          Quiet: false
        }
      };

      const deleteResult = await this.s3.deleteObjects(deleteParams).promise();
      const deletedCount = deleteResult.Deleted?.length || 0;

      logger.info('Orphaned images cleanup completed', {
        service: 'file-storage-service',
        userId,
        deletedCount,
        event: 'cleanup-success'
      });

      return deletedCount;
    } catch (error) {
      logger.error('Failed to cleanup orphaned images', error as Error, {
        service: 'file-storage-service',
        userId,
        event: 'cleanup-error'
      });
      return 0;
    }
  }

  /**
   * Get storage statistics for a user
   */
  async getStorageStats(userId: string): Promise<{
    totalImages: number;
    totalSize: number;
    oldestImage: Date | null;
    newestImage: Date | null;
  }> {
    try {
      const listParams = {
        Bucket: this.bucketName,
        Prefix: `meals/user${userId}/`
      };

      const objects = await this.s3.listObjectsV2(listParams).promise();
      
      if (!objects.Contents || objects.Contents.length === 0) {
        return {
          totalImages: 0,
          totalSize: 0,
          oldestImage: null,
          newestImage: null
        };
      }

      const totalImages = objects.Contents.length;
      const totalSize = objects.Contents.reduce((sum, obj) => sum + (obj.Size || 0), 0);
      
      const dates = objects.Contents
        .map(obj => obj.LastModified)
        .filter((date): date is Date => date !== undefined)
        .sort((a, b) => a.getTime() - b.getTime());

      return {
        totalImages,
        totalSize,
        oldestImage: dates.length > 0 ? dates[0] || null : null,
        newestImage: dates.length > 0 ? dates[dates.length - 1] || null : null
      };
    } catch (error) {
      logger.error('Failed to get storage statistics', error as Error, {
        service: 'file-storage-service',
        userId,
        event: 'storage-stats-error'
      });
      return {
        totalImages: 0,
        totalSize: 0,
        oldestImage: null,
        newestImage: null
      };
    }
  }

  /**
   * Optimize image using Sharp
   */
  private async optimizeImage(
    buffer: Buffer, 
    options: ImageOptimizationOptions
  ): Promise<{ buffer: Buffer; info: sharp.OutputInfo }> {
    try {
      const {
        maxWidth = 1024,
        maxHeight = 1024,
        quality = 85,
        format = 'jpeg'
      } = options;

      let sharpInstance = sharp(buffer)
        .resize(maxWidth, maxHeight, { 
          fit: 'inside', 
          withoutEnlargement: true 
        });

      switch (format) {
        case 'jpeg':
          sharpInstance = sharpInstance.jpeg({ quality });
          break;
        case 'png':
          sharpInstance = sharpInstance.png({ 
            compressionLevel: 9,
            quality 
          });
          break;
        case 'webp':
          sharpInstance = sharpInstance.webp({ quality });
          break;
      }

      const result = await sharpInstance.toBuffer({ resolveWithObject: true });

      return {
        buffer: result.data,
        info: result.info
      };
    } catch (error) {
      logger.error('Failed to optimize image', error as Error, {
        service: 'file-storage-service',
        event: 'optimize-error'
      });
      throw error;
    }
  }

  /**
   * Generate S3 key with organized structure
   */
  private generateS3Key(userId: string, mealId: string, contentType: string): string {
    const timestamp = Date.now();
    const extension = this.getFileExtension(contentType);
    return `meals/user${userId}/meal${mealId}_${timestamp}${extension}`;
  }

  /**
   * Get content type from filename
   */
  private getContentType(filename: string): string {
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.webp': 'image/webp',
      '.gif': 'image/gif'
    };
    return mimeTypes[ext] || 'image/jpeg';
  }

  /**
   * Get file extension from content type
   */
  private getFileExtension(contentType: string): string {
    const extensions: Record<string, string> = {
      'image/jpeg': '.jpg',
      'image/png': '.png',
      'image/webp': '.webp',
      'image/gif': '.gif'
    };
    return extensions[contentType] || '.jpg';
  }

  /**
   * Check if S3 bucket is accessible
   */
  async checkConnection(): Promise<boolean> {
    try {
      await this.s3.headBucket({ Bucket: this.bucketName || '' }).promise();
      return true;
    } catch (error) {
      logger.error('S3 connection check failed', error as Error, {
        service: 'file-storage-service',
        bucketName: this.bucketName,
        event: 'connection-check-failed'
      });
      return false;
    }
  }
}

export const fileStorageService = new FileStorageService();
export default FileStorageService;
export { UploadImageOptions, UploadResult, ImageOptimizationOptions };