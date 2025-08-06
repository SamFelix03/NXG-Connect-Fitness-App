#!/usr/bin/env node

/**
 * Complete Server Journey Test Script
 * 
 * This script tests the complete user journey on the NXG Connect Fitness App server:
 * 1. Register a regular user and get their token
 * 2. Register an admin user and get their token  
 * 3. Complete the user's profile with full details (using admin)
 * 4. Generate a workout plan for the user (admin action)
 * 4.5. Generate a diet plan for the user (admin action)
 * 5. Retrieve and display specific workout days (push, pull, legs) (user access)
 * 6. Retrieve and display the user's complete diet plan (user access)
 * 7. Retrieve and display nutrition library (user access)
 * 
 * Tests both workout and nutrition functionality end-to-end with proper access control:
 * - Admins create/manage plans via integration endpoints
 * - Users access their assigned plans via user-facing endpoints
 * 
 * Usage: node test-server-journey.js
 * Make sure your server is running on port 3000
 */

const axios = require('axios');
const crypto = require('crypto');

// Configuration
const BASE_URL = 'http://localhost:3000';
const COLORS = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m'
};

// Utility functions
function log(message, color = 'reset') {
  console.log(`${COLORS[color]}${message}${COLORS.reset}`);
}

function logStep(step, description) {
  log(`\n${'='.repeat(60)}`, 'cyan');
  log(`STEP ${step}: ${description}`, 'bright');
  log(`${'='.repeat(60)}`, 'cyan');
}

function logSuccess(message) {
  log(`✅ ${message}`, 'green');
}

function logError(message) {
  log(`❌ ${message}`, 'red');
}

function logInfo(message) {
  log(`ℹ️  ${message}`, 'blue');
}

function logWarning(message) {
  log(`⚠️  ${message}`, 'yellow');
}

function generateRandomEmail() {
  const randomString = crypto.randomBytes(6).toString('hex');
  return `test_${randomString}@example.com`;
}

function generateRandomPassword() {
  return crypto.randomBytes(8).toString('hex') + '!A1';
}

function formatJson(obj) {
  return JSON.stringify(obj, null, 2);
}

async function makeRequest(method, endpoint, data = null, headers = {}) {
  try {
    const config = {
      method,
      url: `${BASE_URL}${endpoint}`,
      headers: {
        'Content-Type': 'application/json',
        ...headers
      }
    };

    if (data) {
      config.data = data;
    }

    logInfo(`${method.toUpperCase()} ${endpoint}`);
    if (data) {
      log(`Request Body: ${formatJson(data)}`, 'dim');
    }

    const response = await axios(config);
    
    logSuccess(`Status: ${response.status} ${response.statusText}`);
    log(`Response: ${formatJson(response.data)}`, 'dim');
    
    return response.data;
  } catch (error) {
    if (error.response) {
      logError(`Status: ${error.response.status} ${error.response.statusText}`);
      log(`Error Response: ${formatJson(error.response.data)}`, 'red');
      throw new Error(`API Error: ${error.response.status} - ${error.response.data.message || 'Unknown error'}`);
    } else {
      logError(`Network Error: ${error.message}`);
      throw error;
    }
  }
}

// Test Journey Functions
async function step1_registerUser() {
  logStep(1, 'Register Regular User');
  
  const password = generateRandomPassword();
  const userData = {
    username: 'johndoe_' + crypto.randomBytes(4).toString('hex'),
    email: generateRandomEmail(),
    password: password,
    confirmPassword: password,
    name: 'John Doe'
  };

  const response = await makeRequest('POST', '/api/auth/register', userData);
  
  if (!response.success || !response.data.tokens.accessToken) {
    throw new Error('User registration failed - no token received');
  }

  logSuccess(`User registered successfully`);
  logInfo(`User ID: ${response.data.user.id}`);
  logInfo(`Email: ${userData.email}`);
  logInfo(`Password: ${userData.password}`);
  
  return {
    userId: response.data.user.id,
    token: response.data.tokens.accessToken,
    email: userData.email,
    password: userData.password
  };
}

async function step2_registerAdmin() {
  logStep(2, 'Register Admin User');
  
  const password = generateRandomPassword();
  const adminData = {
    username: 'admin_' + crypto.randomBytes(4).toString('hex'),
    email: 'admin_' + crypto.randomBytes(6).toString('hex') + '@example.com', // Generate unique admin email
    password: password,
    confirmPassword: password,
    name: 'Admin User'
  };

  const response = await makeRequest('POST', '/api/auth/register', adminData);
  
  if (!response.success || !response.data.tokens.accessToken) {
    throw new Error('Admin registration failed - no token received');
  }

  logSuccess(`Admin registered successfully`);
  logInfo(`Admin ID: ${response.data.user.id}`);
  logInfo(`Email: ${adminData.email}`);
  logInfo(`Password: ${adminData.password}`);
  
  return {
    adminId: response.data.user.id,
    token: response.data.tokens.accessToken,
    email: adminData.email,
    password: adminData.password
  };
}

async function step3_completeUserProfile(user, admin) {
  logStep(3, 'Complete User Profile (Admin Action)');
  
  // First, let's get the current user profile to see what needs to be filled
  logInfo('Getting current user profile...');
  const currentProfile = await makeRequest('GET', `/api/users/${user.userId}`, null, {
    'Authorization': `Bearer ${admin.token}`
  });

  // Complete profile data
  const profileData = {
    demographics: {
      age: 28,
      heightCm: 175,
      weightKg: 80,
      targetWeightKg: 75,
      gender: 'Male',
      activityLevel: 'moderate'
    },
    fitnessProfile: {
      level: 'intermediate',
      goal: 'weight_loss',
      healthConditions: [],
      exercisePreferences: ['weight_training', 'cardio']
    },
    dietPreferences: {
      cuisinePreferences: {
        'Indian': ['Non-Veg', 'Veg'],
        'RegionAndState': ['South Indian', 'Kerala']
      }
    }
  };

  logInfo('Updating user profile with complete data...');
  const response = await makeRequest('PUT', `/api/users/${user.userId}/profile`, profileData, {
    'Authorization': `Bearer ${admin.token}`
  });

  if (!response.success) {
    throw new Error('Profile update failed');
  }

  logSuccess('User profile completed successfully');
  logInfo('Profile Summary:');
  log(`  Age: ${profileData.demographics.age}`, 'dim');
  log(`  Height: ${profileData.demographics.heightCm}cm`, 'dim');
  log(`  Weight: ${profileData.demographics.weightKg}kg`, 'dim');
  log(`  Target Weight: ${profileData.demographics.targetWeightKg}kg`, 'dim');
  log(`  Fitness Level: ${profileData.fitnessProfile.level}`, 'dim');
  log(`  Goal: ${profileData.fitnessProfile.goal}`, 'dim');

  return response.data;
}

async function step4_generateWorkoutPlan(user, admin) {
  logStep(4, 'Generate Workout Plan');
  
  logInfo('Creating workout plan for user...');
  const workoutPlanData = {
    weeklyWorkoutDays: 5,
    customPreferences: {
      focusAreas: ['chest', 'back', 'legs'],
      preferredEquipment: ['dumbbells', 'barbell', 'machines']
    }
  };

  let response;
  try {
    // First try with user token
    response = await makeRequest('POST', '/api/integrations/workout-plans', workoutPlanData, {
      'Authorization': `Bearer ${user.token}`
    });
  } catch (error) {
    logWarning(`User token failed, trying with admin token...`);
    // If user token fails, try with admin token
    const workoutPlanDataWithTarget = {
      ...workoutPlanData,
      targetUserId: user.userId
    };
    response = await makeRequest('POST', '/api/integrations/workout-plans', workoutPlanDataWithTarget, {
      'Authorization': `Bearer ${admin.token}`
    });
  }

  if (!response.success || !response.data.workoutPlan) {
    throw new Error('Workout plan creation failed');
  }

  logSuccess('Workout plan generated successfully');
  logInfo(`Plan ID: ${response.data.workoutPlan.planId}`);
  logInfo(`Plan Name: ${response.data.workoutPlan.planName}`);
  logInfo(`Difficulty: ${response.data.workoutPlan.difficultyLevel}`);
  logInfo(`Duration: ${response.data.workoutPlan.planDuration}`);
  logInfo(`Workout Days: ${response.data.workoutPlan.workoutDaysCount}`);

  return response.data.workoutPlan;
}

async function step5_retrieveWorkoutDays(user, workoutPlan) {
  logStep(5, 'Retrieve Specific Workout Days');
  
  const muscleGroups = ['push', 'pull', 'legs'];
  const workoutDays = {};

  for (const muscleGroup of muscleGroups) {
    logInfo(`Fetching ${muscleGroup.toUpperCase()} day workout...`);
    
    try {
      const response = await makeRequest('GET', `/api/workouts/days/${muscleGroup}`, null, {
        'Authorization': `Bearer ${user.token}`
      });

      if (response.success && response.data) {
        workoutDays[muscleGroup] = response.data;
        logSuccess(`${muscleGroup.toUpperCase()} day retrieved successfully`);
        
        // Display workout summary
        log(`\n--- ${muscleGroup.toUpperCase()} DAY WORKOUT ---`, 'magenta');
        log(`Focus: ${response.data.muscleGroup}`, 'dim');
        log(`Total Exercises: ${response.data.exercises.length}`, 'dim');
        log(`Estimated Duration: ${response.data.estimatedDuration}`, 'dim');
        
        // Show first few exercises
        log(`\nExercises Preview:`, 'yellow');
        response.data.exercises.slice(0, 3).forEach((exercise, index) => {
          log(`  ${index + 1}. ${exercise.name} - ${exercise.sets}x${exercise.reps} ${exercise.weight || ''}`, 'dim');
        });
        
        if (response.data.exercises.length > 3) {
          log(`  ... and ${response.data.exercises.length - 3} more exercises`, 'dim');
        }
      } else {
        logWarning(`${muscleGroup.toUpperCase()} day data not available`);
      }
    } catch (error) {
      logError(`Failed to retrieve ${muscleGroup.toUpperCase()} day: ${error.message}`);
    }
  }

  return workoutDays;
}

async function step4_5_generateDietPlan(user, admin) {
  logStep(4.5, 'Generate Diet Plan');
  
  logInfo('Creating diet plan for user...');
  const dietPlanData = {
    targetUserId: user.userId
    // Note: Diet plan will be generated based on user's profile data (age, weight, goals, etc.)
    // The external service will calculate appropriate calories and macros automatically
  };

  let response;
  try {
    // Admin creates diet plan for the user
    response = await makeRequest('POST', '/api/integrations/diet-plans', dietPlanData, {
      'Authorization': `Bearer ${admin.token}`
    });
  } catch (error) {
    logWarning(`Diet plan creation failed: ${error.message}`);
    throw error;
  }

  if (!response.success || !response.data.dietPlan) {
    throw new Error('Diet plan creation failed');
  }

  logSuccess('Diet plan generated successfully');
  logInfo(`Plan ID: ${response.data.dietPlan.id}`);
  logInfo(`Plan Name: ${response.data.dietPlan.planName}`);
  logInfo(`Target Weight: ${response.data.dietPlan.targetWeightKg}kg`);
  logInfo(`Total Calories: ${response.data.dietPlan.totalMacros.calories}`);
  logInfo(`Macro Breakdown: ${response.data.dietPlan.totalMacros.carbs} carbs, ${response.data.dietPlan.totalMacros.protein} protein, ${response.data.dietPlan.totalMacros.fat} fat`);
  logInfo(`Meal Plan Days: ${response.data.dietPlan.mealPlanDays}`);

  return response.data.dietPlan;
}

async function step6_retrieveDietPlan(user, dietPlan) {
  logStep(6, 'Retrieve User Diet Plan');
  
  logInfo('Fetching user\'s daily nutrition plan...');
  
  try {
    const response = await makeRequest('GET', '/api/nutrition/daily', null, {
      'Authorization': `Bearer ${user.token}`
    });

    if (response.success && response.data) {
      logSuccess('Daily nutrition plan retrieved successfully');
      
      // Display diet plan summary
      log(`\n--- DAILY NUTRITION PLAN ---`, 'magenta');
      log(`Plan Name: ${response.data.dietPlan.planName}`, 'dim');
      log(`Target Weight: ${response.data.dietPlan.targetWeightKg}kg`, 'dim');
      log(`Total Days: ${response.data.summary.totalDays}`, 'dim');
      log(`Avg Calories/Day: ${response.data.summary.avgCaloriesPerDay}`, 'dim');
      log(`Meals Per Day: ${response.data.summary.totalMealsPerDay}`, 'dim');
      
      // Show macro targets
      log(`\nMacro Targets:`, 'yellow');
      const macros = response.data.summary.macroTargets;
      log(`  Calories: ${macros.calories}`, 'dim');
      log(`  Carbs: ${macros.carbs}`, 'dim');
      log(`  Protein: ${macros.protein}`, 'dim');
      log(`  Fat: ${macros.fat}`, 'dim');
      log(`  Fiber: ${macros.fiber}`, 'dim');
      
      // Show sample meals for first 3 days
      log(`\nSample Meal Plan Preview:`, 'yellow');
      response.data.weeklyMealPlan.slice(0, 3).forEach((day) => {
        log(`\n${day.dayName} (${day.totalCalories} cal):`, 'cyan');
        day.meals.forEach((meal) => {
          log(`  ${meal.mealType}: ${meal.shortName} (${meal.calories} cal)`, 'dim');
        });
      });
      
      if (response.data.weeklyMealPlan.length > 3) {
        log(`  ... and ${response.data.weeklyMealPlan.length - 3} more days`, 'dim');
      }
      
      return response.data;
    } else {
      logWarning('Diet plan data not available');
      return null;
    }
  } catch (error) {
    logError(`Failed to retrieve diet plan: ${error.message}`);
    return null;
  }
}

async function step7_retrieveNutritionLibrary(user) {
  logStep(7, 'Retrieve Nutrition Library');
  
  logInfo('Fetching nutrition library...');
  
  try {
    const response = await makeRequest('GET', '/api/nutrition/library', null, {
      'Authorization': `Bearer ${user.token}`
    });

    if (response.success && response.data) {
      logSuccess('Nutrition library retrieved successfully');
      
      // Display library summary
      log(`\n--- NUTRITION LIBRARY ---`, 'magenta');
      log(`Total Items: ${response.data.metadata.totalItems}`, 'dim');
      log(`Last Updated: ${response.data.metadata.lastUpdated}`, 'dim');
      
      // Show cuisine types
      log(`\nAvailable Cuisines:`, 'yellow');
      response.data.library.cuisineTypes.slice(0, 3).forEach((cuisine) => {
        log(`  ${cuisine.name}: ${cuisine.subcategories.join(', ')}`, 'dim');
        log(`    Avg Calories: ${cuisine.avgCaloriesPerMeal}/meal`, 'dim');
      });
      
      // Show meal categories
      log(`\nMeal Categories:`, 'yellow');
      response.data.library.mealCategories.forEach((category) => {
        log(`  ${category.name}: ${category.recommendedCalories.min}-${category.recommendedCalories.max} cal`, 'dim');
        log(`    Timing: ${category.timing}`, 'dim');
      });
      
      return response.data;
    } else {
      logWarning('Nutrition library data not available');
      return null;
    }
  } catch (error) {
    logError(`Failed to retrieve nutrition library: ${error.message}`);
    return null;
  }
}

// Main execution function
async function runJourney() {
  log('\n🏋️‍♂️🥗  NXG CONNECT FITNESS APP - COMPLETE JOURNEY TEST 🥗🏋️‍♂️', 'bright');
  log(`Testing server at: ${BASE_URL}`, 'cyan');
  log(`Started at: ${new Date().toISOString()}`, 'dim');

  let user, admin, workoutPlan, dietPlan, workoutDays, nutritionPlan, nutritionLibrary;

  try {
    // Step 1: Register User
    user = await step1_registerUser();

    // Step 2: Register Admin
    admin = await step2_registerAdmin();

    // Step 3: Complete User Profile
    await step3_completeUserProfile(user, admin);

    // Step 4: Generate Workout Plan
    workoutPlan = await step4_generateWorkoutPlan(user, admin);

    // Step 4.5: Generate Diet Plan
    dietPlan = await step4_5_generateDietPlan(user, admin);

    // Step 5: Retrieve Workout Days
    workoutDays = await step5_retrieveWorkoutDays(user, workoutPlan);

    // Step 6: Retrieve Diet Plan
    nutritionPlan = await step6_retrieveDietPlan(user, dietPlan);

    // Step 7: Retrieve Nutrition Library
    nutritionLibrary = await step7_retrieveNutritionLibrary(user);

    // Final Summary
    log('\n' + '='.repeat(60), 'green');
    log('🎉 COMPLETE JOURNEY SUCCESSFULLY FINISHED! 🎉', 'bright');
    log('='.repeat(60), 'green');
    
    log('\n📊 COMPREHENSIVE SUMMARY:', 'bright');
    log(`✅ User registered: ${user.email}`, 'green');
    log(`✅ Admin registered: ${admin.email}`, 'green');
    log(`✅ Profile completed for user: ${user.userId}`, 'green');
    
    log('\n🏋️‍♂️ WORKOUT FUNCTIONALITY:', 'cyan');
    log(`✅ Workout plan generated: ${workoutPlan.planId}`, 'green');
    log(`✅ Workout days retrieved: ${Object.keys(workoutDays).length}/3`, 'green');
    
    log('\n🥗 NUTRITION FUNCTIONALITY:', 'cyan');
    log(`✅ Diet plan generated: ${dietPlan.id}`, 'green');
    log(`✅ Nutrition plan retrieved: ${nutritionPlan ? 'Yes' : 'No'}`, nutritionPlan ? 'green' : 'red');
    log(`✅ Nutrition library accessed: ${nutritionLibrary ? 'Yes' : 'No'}`, nutritionLibrary ? 'green' : 'red');
    
    if (dietPlan) {
      log(`   📋 Plan: ${dietPlan.planName}`, 'dim');
      log(`   🎯 Target: ${dietPlan.targetWeightKg}kg`, 'dim');
      log(`   🔥 Calories: ${dietPlan.totalMacros.calories}`, 'dim');
    }
    
    if (nutritionPlan && nutritionPlan.summary) {
      log(`   📅 Meal plan days: ${nutritionPlan.summary.totalDays}`, 'dim');
      log(`   🍽️ Avg calories/day: ${nutritionPlan.summary.avgCaloriesPerDay}`, 'dim');
      log(`   ⏰ Meals per day: ${nutritionPlan.summary.totalMealsPerDay}`, 'dim');
    }

    log('\n🔑 TEST CREDENTIALS:', 'yellow');
    log(`User Token: ${user.token.substring(0, 50)}...`, 'dim');
    log(`Admin Token: ${admin.token.substring(0, 50)}...`, 'dim');

  } catch (error) {
    log('\n' + '='.repeat(60), 'red');
    log('💥 JOURNEY FAILED! 💥', 'bright');
    log('='.repeat(60), 'red');
    logError(`Error: ${error.message}`);
    
    if (error.stack) {
      log('\nStack Trace:', 'dim');
      log(error.stack, 'dim');
    }
    
    process.exit(1);
  }

  log(`\nCompleted at: ${new Date().toISOString()}`, 'dim');
  log('\n👋 Test journey completed! Check your server logs for API call details.', 'cyan');
}

// Check if axios is available
if (typeof axios === 'undefined') {
  logError('axios is required but not found. Please install it:');
  logInfo('npm install axios');
  process.exit(1);
}

// Run the journey
runJourney().catch((error) => {
  logError(`Unexpected error: ${error.message}`);
  process.exit(1);
});