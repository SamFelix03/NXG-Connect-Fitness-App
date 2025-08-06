import AWS from 'aws-sdk';
import sharp from 'sharp';
import { fileStorageService, FileStorageService } from './file-storage.service';
import { logger } from '../utils/logger';

jest.mock('aws-sdk');
jest.mock('sharp');
jest.mock('../utils/logger');

const MockedAWS = AWS as jest.Mocked<typeof AWS>;
const mockedSharp = sharp as jest.MockedFunction<typeof sharp>;

describe('FileStorageService', () => {
  let service: FileStorageService;
  let mockS3: jest.Mocked<AWS.S3>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock S3 instance
    mockS3 = {
      upload: jest.fn().mockReturnValue({
        promise: jest.fn()
      }),
      getSignedUrlPromise: jest.fn(),
      deleteObject: jest.fn().mockReturnValue({
        promise: jest.fn()
      }),
      deleteObjects: jest.fn().mockReturnValue({
        promise: jest.fn()
      }),
      listObjectsV2: jest.fn().mockReturnValue({
        promise: jest.fn()
      }),
      headBucket: jest.fn().mockReturnValue({
        promise: jest.fn()
      })
    } as any;

    // Mock AWS SDK
    MockedAWS.S3.mockImplementation(() => mockS3);
    MockedAWS.config = {
      update: jest.fn()
    } as any;

    // Create service instance
    service = new FileStorageService();
  });

  describe('constructor', () => {
    it('should initialize with environment variables', () => {
      process.env['S3_BUCKET_NAME'] = 'test-bucket';
      process.env['CLOUDFRONT_DOMAIN'] = 'test-cdn.com';
      process.env['AWS_REGION'] = 'us-west-2';
      process.env['AWS_ACCESS_KEY_ID'] = 'test-key';
      process.env['AWS_SECRET_ACCESS_KEY'] = 'test-secret';

      const newService = new FileStorageService();

      expect(MockedAWS.config.update).toHaveBeenCalledWith({
        region: 'us-west-2',
        accessKeyId: 'test-key',
        secretAccessKey: 'test-secret'
      });
    });

    it('should use default values when environment variables are not set', () => {
      delete process.env['S3_BUCKET_NAME'];
      delete process.env['CLOUDFRONT_DOMAIN'];
      delete process.env['AWS_REGION'];

      const newService = new FileStorageService();

      expect(MockedAWS.S3).toHaveBeenCalledWith({
        region: 'us-east-1',
        signatureVersion: 'v4'
      });
    });
  });

  describe('uploadMealImage', () => {
    const mockUploadOptions = {
      userId: 'user123',
      mealId: 'meal456',
      originalBuffer: Buffer.from('test-image-data'),
      originalName: 'meal.jpg',
      optimize: true,
      makePublic: false
    };

    const mockS3Response = {
      Location: 'https://s3.amazonaws.com/test-bucket/meals/user123/meal456_1234567890.jpg',
      Key: 'meals/user123/meal456_1234567890.jpg'
    };

    const mockOptimizedBuffer = Buffer.from('optimized-image-data');
    const mockSharpInstance = {
      resize: jest.fn().mockReturnThis(),
      jpeg: jest.fn().mockReturnThis(),
      toBuffer: jest.fn().mockResolvedValue({
        data: mockOptimizedBuffer,
        info: { size: 1024 }
      })
    };

    beforeEach(() => {
      mockedSharp.mockReturnValue(mockSharpInstance as any);
      (mockS3.upload().promise as jest.Mock).mockResolvedValue(mockS3Response);
    });

    it('should upload meal image successfully with optimization', async () => {
      const result = await service.uploadMealImage(mockUploadOptions);

      expect(mockedSharp).toHaveBeenCalledWith(mockUploadOptions.originalBuffer);
      expect(mockSharpInstance.resize).toHaveBeenCalledWith(1024, 1024, {
        fit: 'inside',
        withoutEnlargement: true
      });
      expect(mockSharpInstance.jpeg).toHaveBeenCalledWith({ quality: 85 });

      expect(mockS3.upload).toHaveBeenCalledWith({
        Bucket: 'nxg-fitness-meals',
        Key: expect.stringMatching(/^meals\/user123\/meal456_\d+\.jpg$/),
        Body: mockOptimizedBuffer,
        ContentType: 'image/jpeg',
        Metadata: {
          userId: 'user123',
          mealId: 'meal456',
          originalName: 'meal.jpg',
          uploadId: expect.any(String),
          uploadedAt: expect.any(String)
        },
        ServerSideEncryption: 'AES256',
        StorageClass: 'STANDARD'
      });

      expect(result).toEqual({
        s3Key: expect.stringMatching(/^meals\/user123\/meal456_\d+\.jpg$/),
        s3Url: mockS3Response.Location,
        cdnUrl: expect.stringMatching(/^https:\/\/cdn\.nxg-fitness\.com\/meals\/user123\/meal456_\d+\.jpg$/),
        contentType: 'image/jpeg',
        size: mockOptimizedBuffer.length,
        uploadedAt: expect.any(Date)
      });
    });

    it('should upload without optimization when optimize is false', async () => {
      const optionsWithoutOptimization = {
        ...mockUploadOptions,
        optimize: false
      };

      await service.uploadMealImage(optionsWithoutOptimization);

      expect(mockedSharp).not.toHaveBeenCalled();
      expect(mockS3.upload).toHaveBeenCalledWith(
        expect.objectContaining({
          Body: mockUploadOptions.originalBuffer,
          ContentType: 'image/jpeg'
        })
      );
    });

    it('should set ACL to public-read when makePublic is true', async () => {
      const publicOptions = {
        ...mockUploadOptions,
        makePublic: true
      };

      await service.uploadMealImage(publicOptions);

      expect(mockS3.upload).toHaveBeenCalledWith(
        expect.objectContaining({
          ACL: 'public-read'
        })
      );
    });

    it('should handle S3 upload errors', async () => {
      const uploadError = new Error('S3 upload failed');
      (mockS3.upload().promise as jest.Mock).mockRejectedValue(uploadError);

      await expect(service.uploadMealImage(mockUploadOptions))
        .rejects.toThrow('S3 upload failed');

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to upload meal image',
        uploadError,
        expect.objectContaining({
          service: 'file-storage-service',
          userId: 'user123',
          mealId: 'meal456'
        })
      );
    });

    it('should handle image optimization errors gracefully', async () => {
      const optimizationError = new Error('Sharp optimization failed');
      mockSharpInstance.toBuffer.mockRejectedValue(optimizationError);

      await expect(service.uploadMealImage(mockUploadOptions))
        .rejects.toThrow('Sharp optimization failed');
    });

    it('should detect content type from filename', async () => {
      const pngOptions = {
        ...mockUploadOptions,
        originalName: 'meal.png'
      };

      await service.uploadMealImage(pngOptions);

      expect(mockS3.upload).toHaveBeenCalledWith(
        expect.objectContaining({
          ContentType: 'image/png'
        })
      );
    });
  });

  describe('getSignedUrl', () => {
    const mockS3Key = 'meals/user123/meal456_1234567890.jpg';
    const mockSignedUrl = 'https://s3.amazonaws.com/signed-url';

    beforeEach(() => {
      mockS3.getSignedUrlPromise.mockResolvedValue(mockSignedUrl);
    });

    it('should generate signed URL successfully', async () => {
      const result = await service.getSignedUrl(mockS3Key, 3600);

      expect(mockS3.getSignedUrlPromise).toHaveBeenCalledWith('getObject', {
        Bucket: 'nxg-fitness-meals',
        Key: mockS3Key,
        Expires: 3600
      });

      expect(result).toBe(mockSignedUrl);
    });

    it('should use default expiry time', async () => {
      await service.getSignedUrl(mockS3Key);

      expect(mockS3.getSignedUrlPromise).toHaveBeenCalledWith('getObject', {
        Bucket: 'nxg-fitness-meals',
        Key: mockS3Key,
        Expires: 3600
      });
    });

    it('should handle S3 errors', async () => {
      const signedUrlError = new Error('Failed to generate signed URL');
      mockS3.getSignedUrlPromise.mockRejectedValue(signedUrlError);

      await expect(service.getSignedUrl(mockS3Key))
        .rejects.toThrow('Failed to generate signed URL');

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to generate signed URL',
        signedUrlError,
        expect.objectContaining({
          service: 'file-storage-service',
          s3Key: mockS3Key
        })
      );
    });
  });

  describe('deleteMealImage', () => {
    const mockS3Key = 'meals/user123/meal456_1234567890.jpg';

    beforeEach(() => {
      (mockS3.deleteObject().promise as jest.Mock).mockResolvedValue({});
    });

    it('should delete meal image successfully', async () => {
      await service.deleteMealImage(mockS3Key);

      expect(mockS3.deleteObject).toHaveBeenCalledWith({
        Bucket: 'nxg-fitness-meals',
        Key: mockS3Key
      });

      expect(logger.info).toHaveBeenCalledWith(
        'Meal image deleted successfully',
        expect.objectContaining({
          service: 'file-storage-service',
          s3Key: mockS3Key
        })
      );
    });

    it('should handle deletion errors', async () => {
      const deleteError = new Error('S3 delete failed');
      (mockS3.deleteObject().promise as jest.Mock).mockRejectedValue(deleteError);

      await expect(service.deleteMealImage(mockS3Key))
        .rejects.toThrow('S3 delete failed');

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to delete meal image',
        deleteError,
        expect.objectContaining({
          service: 'file-storage-service',
          s3Key: mockS3Key
        })
      );
    });
  });

  describe('cleanupOrphanedImages', () => {
    const userId = 'user123';
    const activeMealIds = ['meal1', 'meal2'];
    const mockObjects = {
      Contents: [
        { Key: 'meals/user123/meal1_1234567890.jpg' },
        { Key: 'meals/user123/meal3_1234567891.jpg' }, // Orphaned
        { Key: 'meals/user123/meal4_1234567892.jpg' }  // Orphaned
      ]
    };

    beforeEach(() => {
      (mockS3.listObjectsV2().promise as jest.Mock).mockResolvedValue(mockObjects);
      (mockS3.deleteObjects().promise as jest.Mock).mockResolvedValue({
        Deleted: [
          { Key: 'meals/user123/meal3_1234567891.jpg' },
          { Key: 'meals/user123/meal4_1234567892.jpg' }
        ]
      });
    });

    it('should cleanup orphaned images successfully', async () => {
      const deletedCount = await service.cleanupOrphanedImages(userId, activeMealIds);

      expect(mockS3.listObjectsV2).toHaveBeenCalledWith({
        Bucket: 'nxg-fitness-meals',
        Prefix: 'meals/user123/'
      });

      expect(mockS3.deleteObjects).toHaveBeenCalledWith({
        Bucket: 'nxg-fitness-meals',
        Delete: {
          Objects: [
            { Key: 'meals/user123/meal3_1234567891.jpg' },
            { Key: 'meals/user123/meal4_1234567892.jpg' }
          ],
          Quiet: false
        }
      });

      expect(deletedCount).toBe(2);
    });

    it('should return 0 when no objects found', async () => {
      (mockS3.listObjectsV2().promise as jest.Mock).mockResolvedValue({ Contents: [] });

      const deletedCount = await service.cleanupOrphanedImages(userId, activeMealIds);

      expect(deletedCount).toBe(0);
      expect(mockS3.deleteObjects).not.toHaveBeenCalled();
    });

    it('should return 0 when no orphaned images found', async () => {
      const mockObjectsNoOrphans = {
        Contents: [
          { Key: 'meals/user123/meal1_1234567890.jpg' },
          { Key: 'meals/user123/meal2_1234567891.jpg' }
        ]
      };
      (mockS3.listObjectsV2().promise as jest.Mock).mockResolvedValue(mockObjectsNoOrphans);

      const deletedCount = await service.cleanupOrphanedImages(userId, activeMealIds);

      expect(deletedCount).toBe(0);
      expect(mockS3.deleteObjects).not.toHaveBeenCalled();
    });

    it('should handle cleanup errors gracefully', async () => {
      const listError = new Error('S3 list failed');
      (mockS3.listObjectsV2().promise as jest.Mock).mockRejectedValue(listError);

      const deletedCount = await service.cleanupOrphanedImages(userId, activeMealIds);

      expect(deletedCount).toBe(0);
      expect(logger.error).toHaveBeenCalledWith(
        'Failed to cleanup orphaned images',
        listError,
        expect.objectContaining({
          service: 'file-storage-service',
          userId
        })
      );
    });
  });

  describe('getStorageStats', () => {
    const userId = 'user123';
    const mockObjects = {
      Contents: [
        {
          Key: 'meals/user123/meal1_1234567890.jpg',
          Size: 1024,
          LastModified: new Date('2023-01-01')
        },
        {
          Key: 'meals/user123/meal2_1234567891.jpg',
          Size: 2048,
          LastModified: new Date('2023-01-02')
        }
      ]
    };

    beforeEach(() => {
      (mockS3.listObjectsV2().promise as jest.Mock).mockResolvedValue(mockObjects);
    });

    it('should return storage statistics', async () => {
      const stats = await service.getStorageStats(userId);

      expect(mockS3.listObjectsV2).toHaveBeenCalledWith({
        Bucket: 'nxg-fitness-meals',
        Prefix: 'meals/user123/'
      });

      expect(stats).toEqual({
        totalImages: 2,
        totalSize: 3072,
        oldestImage: new Date('2023-01-01'),
        newestImage: new Date('2023-01-02')
      });
    });

    it('should handle empty storage', async () => {
      (mockS3.listObjectsV2().promise as jest.Mock).mockResolvedValue({ Contents: [] });

      const stats = await service.getStorageStats(userId);

      expect(stats).toEqual({
        totalImages: 0,
        totalSize: 0,
        oldestImage: null,
        newestImage: null
      });
    });

    it('should handle errors gracefully', async () => {
      const statsError = new Error('S3 stats failed');
      (mockS3.listObjectsV2().promise as jest.Mock).mockRejectedValue(statsError);

      const stats = await service.getStorageStats(userId);

      expect(stats).toEqual({
        totalImages: 0,
        totalSize: 0,
        oldestImage: null,
        newestImage: null
      });

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to get storage statistics',
        statsError,
        expect.objectContaining({
          service: 'file-storage-service',
          userId
        })
      );
    });
  });

  describe('checkConnection', () => {
    it('should return true when bucket is accessible', async () => {
      (mockS3.headBucket().promise as jest.Mock).mockResolvedValue({});

      const isConnected = await service.checkConnection();

      expect(isConnected).toBe(true);
      expect(mockS3.headBucket).toHaveBeenCalledWith({ Bucket: 'nxg-fitness-meals' });
    });

    it('should return false when bucket is not accessible', async () => {
      const connectionError = new Error('Access denied');
      (mockS3.headBucket().promise as jest.Mock).mockRejectedValue(connectionError);

      const isConnected = await service.checkConnection();

      expect(isConnected).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        'S3 connection check failed',
        connectionError,
        expect.objectContaining({
          service: 'file-storage-service',
          bucketName: 'nxg-fitness-meals'
        })
      );
    });
  });

  describe('private methods', () => {
    describe('generateS3Key', () => {
      it('should generate correct S3 key format', () => {
        const s3Key = (service as any).generateS3Key('user123', 'meal456', 'image/jpeg');
        
        expect(s3Key).toMatch(/^meals\/user123\/meal456_\d+\.jpg$/);
      });

      it('should use correct file extension for content type', () => {
        const pngKey = (service as any).generateS3Key('user123', 'meal456', 'image/png');
        const webpKey = (service as any).generateS3Key('user123', 'meal456', 'image/webp');
        
        expect(pngKey).toMatch(/\.png$/);
        expect(webpKey).toMatch(/\.webp$/);
      });
    });

    describe('getContentType', () => {
      it('should detect content types correctly', () => {
        expect((service as any).getContentType('image.jpg')).toBe('image/jpeg');
        expect((service as any).getContentType('image.jpeg')).toBe('image/jpeg');
        expect((service as any).getContentType('image.png')).toBe('image/png');
        expect((service as any).getContentType('image.webp')).toBe('image/webp');
        expect((service as any).getContentType('image.gif')).toBe('image/gif');
        expect((service as any).getContentType('image.unknown')).toBe('image/jpeg');
      });
    });

    describe('getFileExtension', () => {
      it('should return correct extensions for content types', () => {
        expect((service as any).getFileExtension('image/jpeg')).toBe('.jpg');
        expect((service as any).getFileExtension('image/png')).toBe('.png');
        expect((service as any).getFileExtension('image/webp')).toBe('.webp');
        expect((service as any).getFileExtension('image/gif')).toBe('.gif');
        expect((service as any).getFileExtension('unknown/type')).toBe('.jpg');
      });
    });
  });

  describe('image optimization', () => {
    const testBuffer = Buffer.from('test-image');
    const mockSharpInstance = {
      resize: jest.fn().mockReturnThis(),
      jpeg: jest.fn().mockReturnThis(),
      png: jest.fn().mockReturnThis(),
      webp: jest.fn().mockReturnThis(),
      toBuffer: jest.fn()
    };

    beforeEach(() => {
      mockedSharp.mockReturnValue(mockSharpInstance as any);
    });

    it('should optimize JPEG images', async () => {
      const mockResult = {
        data: Buffer.from('optimized'),
        info: { size: 500 }
      };
      mockSharpInstance.toBuffer.mockResolvedValue(mockResult);

      const result = await (service as any).optimizeImage(testBuffer, {
        format: 'jpeg',
        quality: 90,
        maxWidth: 800,
        maxHeight: 800
      });

      expect(mockedSharp).toHaveBeenCalledWith(testBuffer);
      expect(mockSharpInstance.resize).toHaveBeenCalledWith(800, 800, {
        fit: 'inside',
        withoutEnlargement: true
      });
      expect(mockSharpInstance.jpeg).toHaveBeenCalledWith({ quality: 90 });
      expect(result).toEqual(mockResult);
    });

    it('should optimize PNG images', async () => {
      const mockResult = {
        data: Buffer.from('optimized'),
        info: { size: 500 }
      };
      mockSharpInstance.toBuffer.mockResolvedValue(mockResult);

      await (service as any).optimizeImage(testBuffer, {
        format: 'png',
        quality: 80
      });

      expect(mockSharpInstance.png).toHaveBeenCalledWith({
        compressionLevel: 9,
        quality: 80
      });
    });

    it('should optimize WebP images', async () => {
      const mockResult = {
        data: Buffer.from('optimized'),
        info: { size: 500 }
      };
      mockSharpInstance.toBuffer.mockResolvedValue(mockResult);

      await (service as any).optimizeImage(testBuffer, {
        format: 'webp',
        quality: 85
      });

      expect(mockSharpInstance.webp).toHaveBeenCalledWith({ quality: 85 });
    });

    it('should handle optimization errors', async () => {
      const optimizationError = new Error('Sharp failed');
      mockSharpInstance.toBuffer.mockRejectedValue(optimizationError);

      await expect((service as any).optimizeImage(testBuffer, {}))
        .rejects.toThrow('Sharp failed');

      expect(logger.error).toHaveBeenCalledWith(
        'Failed to optimize image',
        optimizationError,
        expect.objectContaining({
          service: 'file-storage-service'
        })
      );
    });
  });
});