import { Request, Response, NextFunction } from 'express';
import { Dropbox, DropboxAuth } from 'dropbox';
import fetch from 'node-fetch';
import { UserService } from '../services/UserService';

const userService = new UserService();

// Function to refresh access token using refresh token (matching server.js implementation)
async function refreshAccessTokenIfNeeded(userRefreshToken: string) {
  try {
    const CLIENT_ID = process.env.DROPBOX_CLIENT_ID;
    const CLIENT_SECRET = process.env.DROPBOX_CLIENT_SECRET;

    if (!CLIENT_ID || !CLIENT_SECRET) {
      throw new Error('Missing OAuth configuration (DROPBOX_CLIENT_ID or DROPBOX_CLIENT_SECRET)');
    }

    const auth = new DropboxAuth({
      clientId: CLIENT_ID,
      clientSecret: CLIENT_SECRET,
    });

    // Use provided refresh token
    if (!userRefreshToken) {
      throw new Error('No refresh token available');
    }

    auth.setRefreshToken(userRefreshToken);
    await auth.refreshAccessToken();

    // Get the new access token
    const newAccessToken = auth.getAccessToken();
    const newRefreshToken = auth.getRefreshToken();

    console.log('✅ Successfully refreshed access token');

    return {
      dbx: new Dropbox({ auth }),
      accessToken: newAccessToken,
      refreshToken: newRefreshToken
    };
  } catch (error) {
    console.error('❌ Failed to refresh access token:', error);
    throw error;
  }
}

// Extend Request interface to include dropbox instance
declare global {
  namespace Express {
    interface Request {
      dbx?: Dropbox;
      accessToken?: string;
      currentAccountId?: string;
    }
  }
}

export async function ensureValidToken(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    const accessToken = authHeader?.split(' ')[1];
    const userId = req.headers['x-user-id'] as string;

    if (!accessToken) {
      res.status(401).json({ error: 'No access token provided' });
      return;
    }

    if (!userId) {
      res.status(401).json({ error: 'No user ID provided' });
      return;
    }

    console.log(`🔍 [AUTH MIDDLEWARE] Validating token for user: ${userId}`);

    // Try to use the current token
    try {
      const dbx = new Dropbox({ accessToken, fetch });
      // Test if token is valid with a simple API call
      const currentAccount = await dbx.usersGetCurrentAccount();
      const currentAccountId = currentAccount.result.account_id;

      // CRITICAL SECURITY: Validate that token's account matches the user ID
      if (userId && currentAccountId !== userId) {
        console.log(`🚨 [AUTH MIDDLEWARE] SECURITY ALERT: Token account mismatch!`);
        console.log(`🚨 [AUTH MIDDLEWARE] Token belongs to: ${currentAccountId}, but request claims: ${userId}`);
        res.status(403).json({ 
          error: 'Account mismatch detected',
          message: 'Token does not belong to the specified user',
          shouldReauth: true
        });
        return;
      }

      // Token is valid and belongs to correct user, add to request
      req.dbx = dbx;
      req.accessToken = accessToken;
      req.currentAccountId = currentAccountId;
      console.log(`✅ [AUTH MIDDLEWARE] Token valid for user: ${userId}`);
      next();
      return;
    } catch (error) {
      // Token might be expired, try to refresh
      console.log(`🔄 [AUTH MIDDLEWARE] Access token expired for user: ${userId}, attempting refresh...`);

      const userSession = await userService.getUserSession(userId);
      if (!userSession?.refreshToken) {
        console.log(`❌ [AUTH MIDDLEWARE] No refresh token available for user: ${userId}`);
        res.status(401).json({
          error: 'Token expired and no refresh token available',
          shouldReauth: true
        });
        return;
      }

      try {
        console.log(`🔄 [AUTH MIDDLEWARE] Found refresh token for user: ${userId}, refreshing...`);
        const refreshResult = await refreshAccessTokenIfNeeded(userSession.refreshToken);

        // Update stored tokens in MongoDB 
        await userService.updateTokens(userId, refreshResult.accessToken, refreshResult.refreshToken, 14400);

        // Add refreshed token to request
        req.dbx = refreshResult.dbx;
        req.accessToken = refreshResult.accessToken;
        req.currentAccountId = userId;

        // IMPORTANT: Return new token in response headers (matching server.js)
        res.set('X-New-Access-Token', refreshResult.accessToken);

        console.log(`✅ [AUTH MIDDLEWARE] Token refreshed successfully for user: ${userId}`);
        console.log(`🔄 [AUTH MIDDLEWARE] Updated session for user: ${userId}`, {
          newTokenLength: refreshResult.accessToken.length,
          lastRefresh: new Date().toISOString()
        });
        next();
        return;
      } catch (refreshError: unknown) {
        console.error(`❌ [AUTH MIDDLEWARE] Token refresh failed for user: ${userId}, Error:`, refreshError);
        
        // Enhanced error handling (based on server.js patterns)
        if (refreshError instanceof Error) {
          // Check for specific refresh token errors
          if (refreshError.message.includes('invalid_grant') ||
              refreshError.message.includes('refresh_token') ||
              refreshError.message.includes('expired') ||
              refreshError.message.includes('invalid_token')) {
            console.log(`🔄 [AUTH MIDDLEWARE] Refresh token expired for user: ${userId}, user needs to re-authenticate`);
            res.status(401).json({
              error: 'Refresh token expired',
              message: 'Please log in again',
              shouldReauth: true,
              reason: 'refresh_token_expired'
            });
            return;
          }
        }
        
        res.status(401).json({
          error: 'Authentication failed',
          message: refreshError instanceof Error ? refreshError.message : 'Token refresh failed',
          shouldReauth: true
        });
        return;
      }
    }
  } catch (error) {
    console.error(`❌ [AUTH MIDDLEWARE] Authentication failed:`, error);
    res.status(401).json({
      error: 'Authentication failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      shouldReauth: true
    });
  }
}



// Export aliases for backward compatibility
export const strictAuthMiddleware = ensureValidToken;
export const authMiddleware = ensureValidToken; 