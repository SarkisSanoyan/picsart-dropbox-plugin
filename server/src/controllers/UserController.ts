import { Request, Response } from 'express';
import { UserService } from '../services/UserService';
import { UserModel } from '../models/User';

const userService = new UserService();

export const getUsers = async (_req: Request, res: Response): Promise<void> => {
  try {
    const users = await userService.findActiveSessions();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
};

export const createUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const user = await userService.create(req.body);
    res.status(201).json(user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create user' });
  }
};

// Get user session
export const getUserSession = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.headers['x-user-id'] as string;
    const userSession = await userService.getUserSession(userId);

    if (!userSession) {
      res.status(404).json({ error: 'User session not found' });
      return;
    }

    res.json({
      userId: userId,
      userInfo: userSession.userInfo,
      tokenCreatedAt: userSession.createdAt,
      lastRefresh: userSession.lastRefresh || 'Never',
      expiresAt: userSession.expiresAt
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to get user session', 
      message: (error as Error).message 
    });
  }
};

// Debug endpoint to view all user sessions
export const debugSessions = async (_req: Request, res: Response): Promise<void> => {
  try {
    const allUsers = await UserModel.find({});
    const sessions: any = {};
    const now = new Date();

    // Convert user documents to response format
    for (const user of allUsers) {
      sessions[user.userId] = {
        ...user.toObject(),
        // Mask sensitive tokens for security
        accessToken: user.accessToken ? user.accessToken.substring(0, 10) + '...' : null,
        refreshToken: user.refreshToken ? user.refreshToken.substring(0, 10) + '...' : null,
        // Add human-readable timestamps
        expiresAtFormatted: user.expiresAt ? user.expiresAt.toISOString() : null,
        createdAtFormatted: user.createdAt ? user.createdAt.toISOString() : null,
        lastRefreshFormatted: user.lastRefresh ? user.lastRefresh.toISOString() : 'Never',
        // Check if expired
        isExpired: user.expiresAt ? user.expiresAt < now : null,
        minutesUntilExpiry: user.expiresAt ? Math.round((user.expiresAt.getTime() - now.getTime()) / 1000 / 60) : null
      };
    }

    res.json({
      totalSessions: allUsers.length,
      currentTime: new Date().toISOString(),
      sessions: sessions
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to get sessions', 
      message: (error as Error).message 
    });
  }
};

// Debug endpoint to view specific user session
export const debugUserSession = async (req: Request, res: Response): Promise<void> => {
  try {
    const { userId } = req.params;
    const user = await UserModel.findOne({ userId });

    if (!user) {
      res.status(404).json({ error: 'Session not found', userId });
      return;
    }

    const now = new Date();

    res.json({
      userId,
      session: {
        ...user.toObject(),
        // Mask sensitive tokens
        accessToken: user.accessToken ? user.accessToken.substring(0, 10) + '...' : null,
        refreshToken: user.refreshToken ? user.refreshToken.substring(0, 10) + '...' : null,
        // Add human-readable info
        expiresAtFormatted: user.expiresAt ? user.expiresAt.toISOString() : null,
        createdAtFormatted: user.createdAt ? user.createdAt.toISOString() : null,
        lastRefreshFormatted: user.lastRefresh ? user.lastRefresh.toISOString() : 'Never',
        isExpired: user.expiresAt ? user.expiresAt < now : null,
        minutesUntilExpiry: user.expiresAt ? Math.round((user.expiresAt.getTime() - now.getTime()) / 1000 / 60) : null
      }
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to get session', 
      message: (error as Error).message 
    });
  }
};

// Debug endpoint to clear all sessions
export const clearAllSessions = async (_req: Request, res: Response): Promise<void> => {
  try {
    const deleteResult = await UserModel.deleteMany({});

    console.log(`🧹 Cleared ${deleteResult.deletedCount} user sessions`);

    res.json({
      success: true,
      message: `Cleared ${deleteResult.deletedCount} sessions`,
      remainingSessions: await UserModel.countDocuments({})
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to clear sessions', 
      message: (error as Error).message 
    });
  }
};

// Debug endpoint to log sessions to console
export const logSessions = async (_req: Request, res: Response): Promise<void> => {
  try {
    await userService.logUserSessions('Manual Session Log');

    res.json({
      success: true,
      message: 'Sessions logged to console',
      totalSessions: await UserModel.countDocuments({}),
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      error: 'Failed to log sessions', 
      message: (error as Error).message 
    });
  }
};
