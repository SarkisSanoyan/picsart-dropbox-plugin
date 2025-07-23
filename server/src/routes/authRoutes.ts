import { Router } from 'express';
import { AuthController } from '../controllers/AuthController';

const router = Router();
const authController = new AuthController();

// OAuth token exchange
router.post('/exchange-token', authController.exchangeToken.bind(authController));

// Test token endpoint
router.get('/test-token', authController.testToken.bind(authController));

// Test 4-hour token flow (requires auth middleware)
router.get('/test-token-flow', authController.testTokenFlow.bind(authController));

// Manual token refresh
router.post('/refresh-token', authController.refreshToken.bind(authController));

// Auth status endpoint (matches server.js /status endpoint)
router.get('/status', authController.getAuthStatus.bind(authController));

// Debug endpoints (matching server.js debug endpoints)
router.get('/debug/sessions', authController.debugSessions.bind(authController));
router.get('/debug/sessions/:userId', authController.debugUserSession.bind(authController));
router.get('/debug/sessions/log', authController.debugSessionsLog.bind(authController));
router.post('/debug/sessions/clear', authController.debugSessionsClear.bind(authController));

export default router; 