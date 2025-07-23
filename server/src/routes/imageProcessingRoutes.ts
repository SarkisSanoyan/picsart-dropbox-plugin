import express from 'express';
import { ImageProcessingController } from '../controllers/ImageProcessingController';
import { strictAuthMiddleware } from '../middleware/auth';

const router = express.Router();
const imageProcessingController = new ImageProcessingController();

// Main image processing endpoint 
router.post('/process-image', strictAuthMiddleware, imageProcessingController.processImage.bind(imageProcessingController));

// Test endpoint
router.get('/test', imageProcessingController.test.bind(imageProcessingController));

// Test Picsart API endpoint
router.get('/test-picsart', imageProcessingController.testPicsart.bind(imageProcessingController));

export default router; 