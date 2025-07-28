import jwt from 'jsonwebtoken';

/**
 * Generate test JWT token for authentication
 */
export const generateTestJWT = (userId: string, role: string = 'user'): string => {
  const secret = process.env['JWT_SECRET'] || 'test-secret-key';
  
  return jwt.sign(
    {
      id: userId,
      role: role
    },
    secret,
    {
      expiresIn: '1h',
      issuer: 'nxg-fitness-test'
    }
  );
};

/**
 * Generate expired JWT token for testing
 */
export const generateExpiredJWT = (userId: string): string => {
  const secret = process.env['JWT_SECRET'] || 'test-secret-key';
  
  return jwt.sign(
    {
      id: userId,
      role: 'user'
    },
    secret,
    {
      expiresIn: '-1h', // Already expired
      issuer: 'nxg-fitness-test'
    }
  );
};

/**
 * Generate admin JWT token for testing
 */
export const generateAdminJWT = (userId: string): string => {
  return generateTestJWT(userId, 'admin');
};

/**
 * Test user data
 */
export const testUsers = {
  regularUser: {
    username: 'testuser',
    email: 'testuser@example.com',
    name: 'Test User',
    passwordHash: '$2b$10$hashedpasswordhere',
    fitnessProfile: {
      level: 'intermediate',
      goal: 'weight_loss'
    },
    demographics: {
      age: 28,
      heightCm: 170,
      weightKg: 65,
      activityLevel: 'active'
    }
  },
  adminUser: {
    username: 'adminuser',
    email: 'admin@example.com',
    name: 'Admin User',
    passwordHash: '$2b$10$hashedpasswordhere',
    role: 'admin',
    fitnessProfile: {
      level: 'advanced',
      goal: 'muscle_building'
    },
    demographics: {
      age: 35,
      heightCm: 180,
      weightKg: 80,
      activityLevel: 'very_active'
    }
  }
};

export default {
  generateTestJWT,
  generateExpiredJWT,
  generateAdminJWT,
  testUsers
};