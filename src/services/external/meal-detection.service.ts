import axios, { AxiosInstance, AxiosResponse } from 'axios';
import winston from 'winston';
import Joi from 'joi';
import CircuitBreaker from 'opossum';
import FormData from 'form-data';

interface MealDetectionFood {
  name: string;
  quantity: string;
  unit: string;
  description: string;
  caloriesPerQuantity: number;
  carbsPerQuantity: number;
  fatPerQuantity: number;
  proteinPerQuantity: number;
  fiberPerQuantity: number;
  nutrition: {
    calories: number;
    carbs: number;
    fat: number;
    protein: number;
    fiber: number;
  };
}

interface MealDetectionResponse {
  foods: MealDetectionFood[];
}

interface MealCorrectionRequest {
  previous_breakdown: string;
  user_correction: string;
}

class MealDetectionService {
  private client: AxiosInstance;
  private logger: winston.Logger;
  private circuitBreaker: CircuitBreaker;

  constructor() {
    this.client = axios.create({
      baseURL: process.env['MEAL_DETECTION_BASE_URL'] || 'https://productionbreakdown-330329704801.us-central1.run.app',
      timeout: 30000,
      headers: {
        'Authorization': `Bearer ${process.env['MEAL_DETECTION_API_TOKEN']}`,
        'Content-Type': 'multipart/form-data'
      }
    });

    this.logger = winston.createLogger({
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/meal-detection.log' })
      ]
    });

    const options = {
      timeout: 30000,
      errorThresholdPercentage: 50,
      resetTimeout: 60000
    };

    this.circuitBreaker = new CircuitBreaker(this.makeRequest.bind(this), options);
    
    this.circuitBreaker.on('open', () => {
      this.logger.warn('Meal detection service circuit breaker opened');
    });

    this.circuitBreaker.on('halfOpen', () => {
      this.logger.info('Meal detection service circuit breaker half-open');
    });

    this.circuitBreaker.on('close', () => {
      this.logger.info('Meal detection service circuit breaker closed');
    });
  }

  private async makeRequest(url: string, data: FormData): Promise<AxiosResponse> {
    const startTime = Date.now();
    const requestId = Math.random().toString(36).substring(7);

    try {
      this.logger.info('Making meal detection API request', {
        requestId,
        url,
        timestamp: new Date().toISOString()
      });

      const response = await this.client.post(url, data);
      
      const duration = Date.now() - startTime;
      this.logger.info('Meal detection API request completed', {
        requestId,
        status: response.status,
        duration,
        timestamp: new Date().toISOString()
      });

      return response;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error('Meal detection API request failed', {
        requestId,
        error: error instanceof Error ? error.message : 'Unknown error',
        duration,
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  }

  private validateMealDetectionResponse(data: any): MealDetectionResponse {
    const schema = Joi.object({
      foods: Joi.array().items(
        Joi.object({
          name: Joi.string().required(),
          quantity: Joi.string().required(),
          unit: Joi.string().required(),
          description: Joi.string().required(),
          caloriesPerQuantity: Joi.number().required(),
          carbsPerQuantity: Joi.number().required(),
          fatPerQuantity: Joi.number().required(),
          proteinPerQuantity: Joi.number().required(),
          fiberPerQuantity: Joi.number().required(),
          nutrition: Joi.object({
            calories: Joi.number().required(),
            carbs: Joi.number().required(),
            fat: Joi.number().required(),
            protein: Joi.number().required(),
            fiber: Joi.number().required()
          }).required()
        })
      ).required()
    });

    const { error, value } = schema.validate(data);
    if (error) {
      throw new Error(`Invalid meal detection response: ${error.message}`);
    }

    return value;
  }

  async identifyMeal(imageBuffer: Buffer, originalName: string): Promise<MealDetectionResponse> {
    try {
      const formData = new FormData();
      formData.append('file', imageBuffer, {
        filename: originalName,
        contentType: 'image/png'
      });
      formData.append('user_prompt', 'identify');

      const response = await this.circuitBreaker.fire('/identify/', formData) as AxiosResponse;
      return this.validateMealDetectionResponse(response.data);
    } catch (error) {
      this.logger.error('Failed to identify meal', {
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  }

  async correctMeal(previousBreakdown: string, userCorrection: string): Promise<MealDetectionResponse> {
    try {
      const requestData: MealCorrectionRequest = {
        previous_breakdown: previousBreakdown,
        user_correction: userCorrection
      };

      const formData = new FormData();
      formData.append('data', JSON.stringify(requestData));

      const response = await this.circuitBreaker.fire('/edit/', formData) as AxiosResponse;
      return this.validateMealDetectionResponse(response.data);
    } catch (error) {
      this.logger.error('Failed to correct meal', {
        error: error instanceof Error ? error.message : 'Unknown error',
        previousBreakdown,
        userCorrection,
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  }

  formatMealForCorrection(foods: MealDetectionFood[]): string {
    let breakdown = '';
    let totalCalories = 0;
    let totalCarbs = 0;
    let totalFat = 0;
    let totalProtein = 0;
    let totalFiber = 0;

    foods.forEach(food => {
      breakdown += `[${food.name}][${food.quantity} ${food.unit}][${food.description}]\n`;
      totalCalories += food.nutrition.calories;
      totalCarbs += food.nutrition.carbs;
      totalFat += food.nutrition.fat;
      totalProtein += food.nutrition.protein;
      totalFiber += food.nutrition.fiber;
    });

    breakdown += `Total Calories: ${totalCalories}\n`;
    breakdown += `Total Carbs: ${totalCarbs}\n`;
    breakdown += `Total Fat: ${totalFat}\n`;
    breakdown += `Total Protein: ${totalProtein}\n`;
    breakdown += `Total Fiber: ${totalFiber}`;

    return breakdown;
  }

  async compressImage(imageBuffer: Buffer, maxSizeKB: number = 1024): Promise<Buffer> {
    const sharp = require('sharp');
    
    try {
      let compressed = await sharp(imageBuffer)
        .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toBuffer();

      let quality = 85;
      while (compressed.length > maxSizeKB * 1024 && quality > 20) {
        quality -= 10;
        compressed = await sharp(imageBuffer)
          .resize(1024, 1024, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality })
          .toBuffer();
      }

      this.logger.info('Image compressed', {
        originalSize: imageBuffer.length,
        compressedSize: compressed.length,
        quality,
        timestamp: new Date().toISOString()
      });

      return compressed;
    } catch (error) {
      this.logger.error('Failed to compress image', {
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      });
      throw error;
    }
  }

  async retryWithBackoff<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error');
        
        if (attempt === maxRetries) {
          break;
        }

        const delay = baseDelay * Math.pow(2, attempt);
        this.logger.warn('Operation failed, retrying', {
          attempt: attempt + 1,
          maxRetries: maxRetries + 1,
          delay,
          error: lastError.message,
          timestamp: new Date().toISOString()
        });

        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError!;
  }
}

export default MealDetectionService;
export { MealDetectionFood, MealDetectionResponse };