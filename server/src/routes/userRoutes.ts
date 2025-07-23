import express from 'express';
import { 
  getUsers, 
  createUser, 
  getUserSession, 
  debugSessions, 
  debugUserSession, 
  clearAllSessions, 
  logSessions 
} from '../controllers/UserController';
import { ensureValidToken } from '../middleware/auth';

const router = express.Router();

// Basic user operations
router.get('/', getUsers);
router.post('/', createUser);

// User session management
router.get('/session', ensureValidToken, getUserSession);

// Debug endpoints
router.get('/debug/sessions', debugSessions);
router.get('/debug/sessions/log', logSessions);
router.get('/debug/sessions/:userId', debugUserSession);
router.post('/debug/sessions/clear', clearAllSessions);

export default router;