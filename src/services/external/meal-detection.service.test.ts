import MealDetectionService from './meal-detection.service';
import axios, { AxiosInstance } from 'axios';
import FormData from 'form-data';
import CircuitBreaker from 'opossum';
import sharp from 'sharp';

jest.mock('axios');
jest.mock('form-data');
jest.mock('opossum');
jest.mock('sharp');

const mockedAxios = axios as jest.Mocked<typeof axios>;
const MockedFormData = FormData as jest.MockedClass<typeof FormData>;
const MockedCircuitBreaker = CircuitBreaker as jest.MockedClass<typeof CircuitBreaker>;
const mockedSharp = sharp as jest.MockedFunction<typeof sharp>;

describe('MealDetectionService', () => {
  let service: MealDetectionService;
  let mockAxiosInstance: jest.Mocked<AxiosInstance>;
  let mockCircuitBreaker: jest.Mocked<CircuitBreaker>;
  let mockFormData: jest.Mocked<FormData>;

  beforeEach(() => {
    jest.clearAllMocks();
    
    mockAxiosInstance = {
      post: jest.fn(),
      get: jest.fn(),
      defaults: {
        timeout: 30000,
        headers: {}
      }
    } as any;
    
    mockedAxios.create.mockReturnValue(mockAxiosInstance);

    mockCircuitBreaker = {
      fire: jest.fn(),
      on: jest.fn(),
      fallback: jest.fn()
    } as any;
    
    MockedCircuitBreaker.mockImplementation(() => mockCircuitBreaker);

    mockFormData = {
      append: jest.fn(),
      getHeaders: jest.fn().mockReturnValue({ 'content-type': 'multipart/form-data' })
    } as any;
    
    MockedFormData.mockImplementation(() => mockFormData);

    service = new MealDetectionService();
  });

  describe('constructor', () => {
    it('should initialize axios client with correct configuration', () => {
      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: expect.any(String),
        timeout: 30000,
        headers: expect.objectContaining({
          'Authorization': expect.stringContaining('Bearer'),
          'Content-Type': 'multipart/form-data'
        })
      });
    });

    it('should initialize circuit breaker with correct options', () => {
      expect(MockedCircuitBreaker).toHaveBeenCalledWith(
        expect.any(Function),
        expect.objectContaining({
          timeout: expect.any(Number),
          errorThresholdPercentage: expect.any(Number),
          resetTimeout: expect.any(Number)
        })
      );
    });
  });

  describe('identifyMeal', () => {
    const mockImageBuffer = Buffer.from('fake-image-data');
    const mockFilename = 'meal.jpg';
    
    const mockApiResponse = {
      data: {
        foods: [
          {
            name: 'Pizza',
            description: 'Cheese pizza slice',
            quantity: '1',
            unit: 'slice',
            caloriesPerQuantity: 285,
            carbsPerQuantity: 35,
            fatPerQuantity: 10,
            proteinPerQuantity: 12,
            fiberPerQuantity: 2,
            nutrition: {
              calories: 285,
              carbs: 35,
              fat: 10,
              protein: 12,
              fiber: 2
            }
          }
        ]
      }
    };

    beforeEach(() => {
      mockCircuitBreaker.fire.mockResolvedValue(mockApiResponse);
    });

    it('should successfully identify meal with valid image', async () => {
      const result = await service.identifyMeal(mockImageBuffer, mockFilename);

      expect(mockFormData.append).toHaveBeenCalledWith('image', mockImageBuffer, {
        filename: mockFilename,
        contentType: 'image/jpeg'
      });
      expect(mockCircuitBreaker.fire).toHaveBeenCalledWith('/identify/', mockFormData);
      expect(result).toEqual({
        foods: mockApiResponse.data.foods
      });
    });

    it('should handle API errors gracefully', async () => {
      const errorResponse = new Error('API Error');
      mockCircuitBreaker.fire.mockRejectedValue(errorResponse);

      await expect(service.identifyMeal(mockImageBuffer, mockFilename))
        .rejects.toThrow('Failed to identify meal: API Error');
    });

    it('should validate image buffer is not empty', async () => {
      const emptyBuffer = Buffer.alloc(0);

      await expect(service.identifyMeal(emptyBuffer, mockFilename))
        .rejects.toThrow('Image buffer cannot be empty');
    });

    it('should process meal detection response correctly', async () => {
      const result = await service.identifyMeal(mockImageBuffer, mockFilename);

      expect(result.foods).toEqual(mockApiResponse.data.foods);
      expect(result.foods[0].name).toBe('Pizza');
    });

    it('should set correct content type based on filename extension', async () => {
      await service.identifyMeal(mockImageBuffer, 'meal.png');

      expect(mockFormData.append).toHaveBeenCalledWith('image', mockImageBuffer, {
        filename: 'meal.png',
        contentType: 'image/png'
      });
    });
  });

  describe('correctMeal', () => {
    const mockPreviousBreakdown = 'Pizza slice with cheese';
    const mockUserCorrection = 'Actually it was two slices with pepperoni';
    
    const mockCorrectionResponse = {
      data: {
        foods: [
          {
            name: 'Pizza',
            description: 'Pepperoni pizza slices',
            quantity: '2',
            unit: 'slices',
            caloriesPerQuantity: 570,
            carbsPerQuantity: 70,
            fatPerQuantity: 20,
            proteinPerQuantity: 24,
            fiberPerQuantity: 4,
            nutrition: {
              calories: 570,
              carbs: 70,
              fat: 20,
              protein: 24,
              fiber: 4
            }
          }
        ]
      }
    };

    beforeEach(() => {
      mockCircuitBreaker.fire.mockResolvedValue(mockCorrectionResponse);
    });

    it('should successfully correct meal with valid input', async () => {
      const result = await service.correctMeal(mockPreviousBreakdown, mockUserCorrection);

      expect(mockFormData.append).toHaveBeenCalledWith('previous_breakdown', mockPreviousBreakdown);
      expect(mockFormData.append).toHaveBeenCalledWith('user_correction', mockUserCorrection);
      expect(mockCircuitBreaker.fire).toHaveBeenCalledWith('/edit/', mockFormData);
      expect(result).toEqual({
        foods: mockCorrectionResponse.data.foods
      });
    });

    it('should validate previous breakdown is not empty', async () => {
      await expect(service.correctMeal('', mockUserCorrection))
        .rejects.toThrow('Previous breakdown cannot be empty');
    });

    it('should validate user correction is not empty', async () => {
      await expect(service.correctMeal(mockPreviousBreakdown, ''))
        .rejects.toThrow('User correction cannot be empty');
    });

    it('should handle API errors during correction', async () => {
      const errorResponse = new Error('Correction API Error');
      mockCircuitBreaker.fire.mockRejectedValue(errorResponse);

      await expect(service.correctMeal(mockPreviousBreakdown, mockUserCorrection))
        .rejects.toThrow('Failed to correct meal: Correction API Error');
    });
  });

  describe('compressImage', () => {
    const mockImageBuffer = Buffer.from('large-image-data');
    const mockCompressedBuffer = Buffer.from('compressed-image-data');
    const mockSharpInstance = {
      jpeg: jest.fn().mockReturnThis(),
      resize: jest.fn().mockReturnThis(),
      toBuffer: jest.fn().mockResolvedValue(mockCompressedBuffer)
    };

    beforeEach(() => {
      mockedSharp.mockReturnValue(mockSharpInstance as any);
    });

    it('should compress image to target size', async () => {
      const targetSizeKB = 512;
      const result = await service.compressImage(mockImageBuffer, targetSizeKB);

      expect(mockedSharp).toHaveBeenCalledWith(mockImageBuffer);
      expect(mockSharpInstance.resize).toHaveBeenCalledWith(1024, 1024, {
        fit: 'inside',
        withoutEnlargement: true
      });
      expect(mockSharpInstance.jpeg).toHaveBeenCalledWith({ quality: 85 });
      expect(result).toBe(mockCompressedBuffer);
    });

    it('should use default size if not specified', async () => {
      await service.compressImage(mockImageBuffer);

      expect(mockSharpInstance.resize).toHaveBeenCalledWith(1024, 1024, {
        fit: 'inside',
        withoutEnlargement: true
      });
    });

    it('should handle compression errors', async () => {
      const compressionError = new Error('Sharp compression failed');
      mockSharpInstance.toBuffer.mockRejectedValue(compressionError);

      await expect(service.compressImage(mockImageBuffer))
        .rejects.toThrow('Image compression failed: Sharp compression failed');
    });

    it('should validate image buffer is not empty', async () => {
      const emptyBuffer = Buffer.alloc(0);

      await expect(service.compressImage(emptyBuffer))
        .rejects.toThrow('Image buffer cannot be empty');
    });
  });

  describe('retryWithBackoff', () => {
    it('should succeed on first attempt', async () => {
      const mockOperation = jest.fn().mockResolvedValue('success');

      const result = await service.retryWithBackoff(mockOperation, 3, 1000);

      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledTimes(1);
    });

    it('should retry on failure and eventually succeed', async () => {
      const mockOperation = jest.fn()
        .mockRejectedValueOnce(new Error('First failure'))
        .mockRejectedValueOnce(new Error('Second failure'))
        .mockResolvedValue('success');

      const result = await service.retryWithBackoff(mockOperation, 3, 100);

      expect(result).toBe('success');
      expect(mockOperation).toHaveBeenCalledTimes(3);
    });

    it('should fail after max attempts', async () => {
      const mockOperation = jest.fn().mockRejectedValue(new Error('Persistent failure'));

      await expect(service.retryWithBackoff(mockOperation, 2, 100))
        .rejects.toThrow('Persistent failure');
      expect(mockOperation).toHaveBeenCalledTimes(2);
    });

    it('should apply exponential backoff between retries', async () => {
      const mockOperation = jest.fn()
        .mockRejectedValueOnce(new Error('First failure'))
        .mockResolvedValue('success');

      const startTime = Date.now();
      await service.retryWithBackoff(mockOperation, 2, 50);
      const endTime = Date.now();

      expect(endTime - startTime).toBeGreaterThanOrEqual(50);
      expect(mockOperation).toHaveBeenCalledTimes(2);
    });
  });

  describe('circuit breaker integration', () => {
    it('should configure circuit breaker event handlers', () => {
      expect(mockCircuitBreaker.on).toHaveBeenCalledWith('open', expect.any(Function));
      expect(mockCircuitBreaker.on).toHaveBeenCalledWith('halfOpen', expect.any(Function));
      expect(mockCircuitBreaker.on).toHaveBeenCalledWith('close', expect.any(Function));
    });

    it('should provide fallback function for circuit breaker', () => {
      expect(mockCircuitBreaker.fallback).toHaveBeenCalledWith(expect.any(Function));
    });
  });

  describe('error handling', () => {
    it('should handle network timeouts', async () => {
      const timeoutError = { code: 'ECONNABORTED' };
      mockCircuitBreaker.fire.mockRejectedValue(timeoutError);

      await expect(service.identifyMeal(Buffer.from('image'), 'test.jpg'))
        .rejects.toThrow('Failed to identify meal');
    });

    it('should handle 429 rate limit responses', async () => {
      const rateLimitError = { response: { status: 429 } };
      mockCircuitBreaker.fire.mockRejectedValue(rateLimitError);

      await expect(service.identifyMeal(Buffer.from('image'), 'test.jpg'))
        .rejects.toThrow('Failed to identify meal');
    });

    it('should handle 500 server errors', async () => {
      const serverError = { response: { status: 500 } };
      mockCircuitBreaker.fire.mockRejectedValue(serverError);

      await expect(service.identifyMeal(Buffer.from('image'), 'test.jpg'))
        .rejects.toThrow('Failed to identify meal');
    });
  });

  describe('content type detection', () => {
    it('should detect JPEG content type', async () => {
      await service.identifyMeal(Buffer.from('image'), 'photo.jpg');
      
      expect(mockFormData.append).toHaveBeenCalledWith('image', expect.any(Buffer), {
        filename: 'photo.jpg',
        contentType: 'image/jpeg'
      });
    });

    it('should detect PNG content type', async () => {
      await service.identifyMeal(Buffer.from('image'), 'screenshot.png');
      
      expect(mockFormData.append).toHaveBeenCalledWith('image', expect.any(Buffer), {
        filename: 'screenshot.png',
        contentType: 'image/png'
      });
    });

    it('should default to JPEG for unknown extensions', async () => {
      await service.identifyMeal(Buffer.from('image'), 'unknown.xyz');
      
      expect(mockFormData.append).toHaveBeenCalledWith('image', expect.any(Buffer), {
        filename: 'unknown.xyz',
        contentType: 'image/jpeg'
      });
    });
  });
});