import { Router } from 'express';
import healthController from '../controllers/health.controller';

const router = Router();

/**
 * @route   GET /health
 * @desc    Comprehensive health check endpoint
 * @access  Public
 * @returns Detailed system health status with service checks
 */
router.get('/health', healthController.checkHealth);

/**
 * @route   GET /health/liveness
 * @desc    Liveness probe for container orchestration
 * @access  Public
 * @returns Simple alive status (for Kubernetes liveness probes)
 */
router.get('/health/liveness', healthController.liveness);

/**
 * @route   GET /health/readiness
 * @desc    Readiness probe for container orchestration
 * @access  Public
 * @returns Service readiness status (for Kubernetes readiness probes)
 */
router.get('/health/readiness', healthController.readiness);

export default router; 