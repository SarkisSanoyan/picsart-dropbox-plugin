import { Request, Response } from 'express';
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

export class AuthController {
  // OAuth callback endpoint (GET request from Dropbox) - PKCE Flow
  async callback(req: Request, res: Response): Promise<void> {
    try {
      const { code, state, error } = req.query; // ← AUTHORIZATION CODE ARRIVES HERE
      
      // Check for OAuth error
      if (error) {
        console.error('❌ OAuth error from Dropbox:', error);
        const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
        res.redirect(`${frontendUrl}?error=${encodeURIComponent(error as string)}`);
        return;
      }
      
      if (!code) {
        res.status(400).send('Authorization code is required');
        return;
      }

      if (!state) {
        res.status(400).send('State parameter is required');
        return;
      }

      console.log('🔄 Processing OAuth callback with PKCE - code:', code, 'state:', state);

      // Redirect to frontend with authorization code and state
      // Frontend will handle the PKCE token exchange
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const redirectUrl = `${frontendUrl}?code=${encodeURIComponent(code as string)}&state=${encodeURIComponent(state as string)}`;
      
      console.log('✅ Redirecting to frontend for PKCE token exchange');
      res.redirect(redirectUrl);  // ← FORWARDS CODE TO FRONTEND

    } catch (error) {
      console.error('❌ OAuth callback failed:', error);
      
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const errorMessage = error instanceof Error ? error.message : 'OAuth authentication failed';
      res.redirect(`${frontendUrl}?error=${encodeURIComponent(errorMessage)}`);
    }
  }

  // OAuth token exchange endpoint (POST request) - PKCE Flow
  async exchangeToken(req: Request, res: Response): Promise<void> {
    try {
      const { code, codeVerifier } = req.body;
      
      if (!code) {
        res.status(400).json({ error: 'Authorization code is required' });
        return;
      }

      if (!codeVerifier) {
        res.status(400).json({ error: 'Code verifier is required for PKCE' });
        return;
      }

      const CLIENT_ID = process.env.DROPBOX_CLIENT_ID;
      const CLIENT_SECRET = process.env.DROPBOX_CLIENT_SECRET;
      const REDIRECT_URI = process.env.DROPBOX_REDIRECT_URI;

      if (!CLIENT_ID || !CLIENT_SECRET || !REDIRECT_URI) {
        res.status(500).json({ error: 'Missing OAuth configuration' });
        return;
      }

      console.log('🔄 Exchanging authorization code for tokens with PKCE...');

      // Exchange code for access token using PKCE with direct fetch
      // The Dropbox SDK doesn't properly handle PKCE, so we'll use fetch directly
      const tokenResponse = await fetch('https://api.dropboxapi.com/oauth2/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          code: code as string,
          grant_type: 'authorization_code',
          client_id: CLIENT_ID,
          client_secret: CLIENT_SECRET,
          redirect_uri: REDIRECT_URI,
          code_verifier: codeVerifier,
        }).toString(),
      });

      if (!tokenResponse.ok) {
        const errorText = await tokenResponse.text();
        console.error('❌ Token exchange failed:', errorText);
        throw new Error(`Token exchange failed: ${errorText}`);
      }

      const tokenData = await tokenResponse.json() as any;
      const accessToken = tokenData.access_token;
      const refreshToken = tokenData.refresh_token;

      if (!accessToken) {
        res.status(400).json({ error: 'Failed to get access token' });
        return;
      }

      console.log('✅ Token exchange successful');

      // Get user info
      const dbx = new Dropbox({ accessToken, fetch });
      const userInfo = await dbx.usersGetCurrentAccount();

      const userId = userInfo.result.account_id;
      const email = userInfo.result.email;
      const name = userInfo.result.name.display_name;

      console.log('✅ Got user info:', { userId, email, name });

      // Store in database
      await userService.setUserSession(userId, {
        accessToken,
        refreshToken,
        expiresAt: new Date(Date.now() + 14400 * 1000), // 4 hours
        dropboxUserId: userId,
        userInfo: { email, name }
      });

      res.json({
        success: true,
        message: 'Authentication successful',
        accessToken,
        refreshToken,
        expiresAt: new Date(Date.now() + 14400 * 1000),
        user: {
          userId,
          email,
          name
        }
      });
    } catch (error) {
      console.error('❌ Token exchange failed:', error);
      
      // Enhanced error logging for PKCE debugging
      if (error && typeof error === 'object' && 'error' in error) {
        console.error('📋 Dropbox API Error Details:', (error as any).error);
      }
      
      res.status(500).json({
        error: 'Token exchange failed',
        message: (error as Error).message
      });
    }
  }

  // Auth status endpoint (based on server.js implementation)
  async getAuthStatus(req: Request, res: Response): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const userId = req.headers['x-user-id'] as string;

      if (!authHeader || !userId) {
        res.json({
          authenticated: false,
          method: 'OAuth Flow',
          message: 'Not authenticated. Please provide authorization header and user ID.',
          hasAccessToken: false,
          hasRefreshToken: false
        });
        return;
      }

      const accessToken = authHeader.replace('Bearer ', '');

      console.log(`🔍 [AUTH STATUS] Checking authentication status for user: ${userId}`);

      try {
        // Try to use the current token
        const dbx = new Dropbox({ accessToken, fetch });
        const userInfo = await dbx.usersGetCurrentAccount();
        const currentAccountId = userInfo.result.account_id;

        // Security check: validate account matches
        if (currentAccountId !== userId) {
          console.log(`🚨 [AUTH STATUS] Account mismatch detected for user: ${userId}`);
          res.json({
            authenticated: false,
            method: 'OAuth Flow',
            message: 'Account mismatch detected',
            hasAccessToken: true,
            accountMismatch: true,
            shouldReauth: true
          });
          return;
        }

        // Token is valid
        console.log(`✅ [AUTH STATUS] Token valid for user: ${userId}`);
        res.json({
          authenticated: true,
          method: 'OAuth Flow',
          message: 'Successfully authenticated and token is valid.',
          hasAccessToken: true,
          user: {
            email: userInfo.result.email,
            name: userInfo.result.name.display_name,
            account_id: userInfo.result.account_id
          }
        });
      } catch (tokenError) {
        // Token might be expired, try to refresh
        console.log(`🔄 [AUTH STATUS] Token expired for user: ${userId}, attempting refresh...`);

        const userSession = await userService.getUserSession(userId);
        if (!userSession?.refreshToken) {
          console.log(`❌ [AUTH STATUS] No refresh token available for user: ${userId}`);
          res.json({
            authenticated: false,
            method: 'OAuth Flow',
            message: 'Token expired and no refresh token available',
            hasAccessToken: true,
            hasRefreshToken: false,
            shouldReauth: true
          });
          return;
        }

        try {
          // Try to refresh
          const CLIENT_ID = process.env.DROPBOX_CLIENT_ID;
          const CLIENT_SECRET = process.env.DROPBOX_CLIENT_SECRET;

          if (!CLIENT_ID || !CLIENT_SECRET) {
            throw new Error('Missing OAuth configuration');
          }

          const auth = new DropboxAuth({
            clientId: CLIENT_ID,
            clientSecret: CLIENT_SECRET,
          });

          auth.setRefreshToken(userSession.refreshToken);
          await auth.refreshAccessToken();

          const newAccessToken = auth.getAccessToken();
          const newRefreshToken = auth.getRefreshToken();

          if (!newAccessToken) {
            throw new Error('Failed to get new access token');
          }

          // Update tokens
          await userService.updateTokens(userId, newAccessToken, newRefreshToken, 14400);

          // Get user info with new token
          const refreshedDbx = new Dropbox({ auth });
          const userInfo = await refreshedDbx.usersGetCurrentAccount();

          console.log(`✅ [AUTH STATUS] Token refreshed successfully for user: ${userId}`);

          // Set the new token in response headers BEFORE sending response
          res.set('X-New-Access-Token', newAccessToken);

          res.json({
            authenticated: true,
            method: 'OAuth Flow with Refresh',
            message: 'Token refreshed and working!',
            hasAccessToken: true,
            hasRefreshToken: true,
            tokenRefreshed: true,
            newAccessToken: newAccessToken,
            user: {
              email: userInfo.result.email,
              name: userInfo.result.name.display_name,
              account_id: userInfo.result.account_id
            }
          });

        } catch (refreshError) {
          console.error(`❌ [AUTH STATUS] Token refresh failed for user: ${userId}:`, refreshError);
          res.json({
            authenticated: false,
            method: 'OAuth Flow',
            message: 'Refresh token is invalid or expired. Please re-authenticate.',
            hasAccessToken: true,
            hasRefreshToken: true,
            shouldReauth: true,
            error: refreshError instanceof Error ? refreshError.message : 'Unknown error'
          });
        }
      }
    } catch (error) {
      console.error(`❌ [AUTH STATUS] Error checking authentication status:`, error);
      res.status(500).json({
        error: 'Failed to check authentication status',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Check authentication status
  async status(req: Request, res: Response): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const userIdHeader = req.headers['x-user-id'] as string;
      
      if (!authHeader) {
        res.json({ authenticated: false });
        return;
      }

      const accessToken = authHeader.replace('Bearer ', '');
      
      // First check if we have a stored session for this token/user
      if (userIdHeader) {
        try {
          const userSession = await userService.getUserSession(userIdHeader);
          if (userSession && userSession.accessToken === accessToken) {
            // Check if token is expired
            if (userSession.expiresAt && userSession.expiresAt > new Date()) {
              res.json({
                authenticated: true,
                user: {
                  email: userSession.userInfo?.email || '',
                  name: userSession.userInfo?.name || '',
                  account_id: userSession.dropboxUserId
                }
              });
              return;
            }
          }
        } catch (sessionError) {
          console.log('📋 Session check failed, trying Dropbox API...');
        }
      }

      // Fallback: simple token validation with Dropbox (only account info)
      try {
        const dbx = new Dropbox({ accessToken, fetch });
        const userInfo = await dbx.usersGetCurrentAccount();

        res.json({
          authenticated: true,
          user: {
            email: userInfo.result.email,
            name: userInfo.result.name.display_name,
            account_id: userInfo.result.account_id
          }
        });
      } catch (error) {
        console.log('📋 Dropbox API validation failed:', (error as Error).message);
        res.json({ authenticated: false, error: (error as Error).message });
      }
    } catch (error) {
      console.error('❌ Auth status check failed:', error);
      res.status(500).json({ error: 'Status check failed' });
    }
  }

  // Test token endpoint
  async testToken(req: Request, res: Response): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const userId = req.headers['x-user-id'] as string;

      if (!authHeader || !userId) {
        res.status(400).json({
          error: 'Missing authorization header or user ID',
          message: 'Please provide both Authorization header and X-User-ID header'
        });
        return;
      }

      const accessToken = authHeader.replace('Bearer ', '');

      // Try direct token first
      try {
        const dbx = new Dropbox({ accessToken, fetch });
        const userInfo = await dbx.usersGetCurrentAccount();
        const spaceUsage = await dbx.usersGetSpaceUsage();

        res.json({
          success: true,
          message: 'Token is working perfectly!',
          method: 'Direct Token',
          tokenValid: true,
          user: {
            email: userInfo.result.email,
            name: userInfo.result.name.display_name,
            account_id: userInfo.result.account_id
          },
          space: {
            used: spaceUsage.result.used,
            allocated: (spaceUsage.result.allocation as any)?.allocated || 0
          }
        });
      } catch (tokenError) {
        // Try to refresh token
        const userSession = await userService.getUserSession(userId);
        if (!userSession?.refreshToken) {
          res.status(401).json({
            success: false,
            error: 'Token expired and no refresh token available',
            message: 'Please re-authenticate'
          });
          return;
        }

        // Refresh token logic would go here
        res.status(401).json({
          success: false,
          error: 'Token refresh needed',
          message: 'Please re-authenticate'
        });
      }
    } catch (error) {
      console.error('❌ Token test failed:', error);
      res.status(500).json({
        success: false,
        error: 'Token test failed',
        message: (error as Error).message
      });
    }
  }

  // Manual token refresh endpoint
  async refreshToken(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.body;
      
      if (!userId) {
        res.status(400).json({ error: 'Missing userId' });
        return;
      }

      console.log(`🔄 [MANUAL REFRESH] Starting manual token refresh for user: ${userId}`);

      const userSession = await userService.getUserSession(userId);
      if (!userSession?.refreshToken) {
        console.log(`❌ [MANUAL REFRESH] No refresh token found for user: ${userId}`);
        res.status(404).json({ error: 'No refresh token found for user' });
        return;
      }

      console.log(`🔄 [MANUAL REFRESH] Found refresh token for user: ${userId}, refreshing...`);

      // Use the same refresh function as the middleware to ensure consistency
      const refreshResult = await refreshAccessTokenIfNeeded(userSession.refreshToken);

      // Update stored tokens 
      await userService.updateTokens(userId, refreshResult.accessToken, refreshResult.refreshToken, 14400);

      console.log(`✅ [MANUAL REFRESH] Token refreshed successfully for user: ${userId}`);
      console.log(`🔄 [MANUAL REFRESH] Updated session for user: ${userId}`, {
        newTokenLength: refreshResult.accessToken.length,
        lastRefresh: new Date().toISOString()
      });

      res.json({
        success: true,
        message: 'Token refreshed successfully',
        accessToken: refreshResult.accessToken,
        refreshToken: refreshResult.refreshToken,
        expiresIn: 14400,
        expiresAt: Date.now() + (14400 * 1000)
      });
    } catch (error) {
      console.error(`❌ [MANUAL REFRESH] Token refresh failed:`, error);
      
      // Enhanced error handling (based on server.js patterns)
      if (error instanceof Error) {
        // Check for specific refresh token errors
        if (error.message.includes('invalid_grant') ||
            error.message.includes('refresh_token') ||
            error.message.includes('expired') ||
            error.message.includes('invalid_token')) {
          console.log(`🔄 [MANUAL REFRESH] Refresh token expired, user needs to re-authenticate`);
          res.status(401).json({
            error: 'Refresh token expired',
            message: 'Please log in again',
            shouldReauth: true,
            reason: 'refresh_token_expired'
          });
          return;
        }
      }
      
      res.status(500).json({
        error: 'Token refresh failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  // Debug endpoints (matching server.js implementation)
  async debugSessions(_req: Request, res: Response): Promise<void> {
    try {
      const allUsers = await userService.findActiveSessions();
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
      res.status(500).json({ error: 'Failed to get sessions', message: (error as Error).message });
    }
  }

  // Test endpoint to demonstrate 4-hour token flow
  async testTokenFlow(req: Request, res: Response): Promise<void> {
    try {
      const authHeader = req.headers.authorization;
      const userId = req.headers['x-user-id'] as string;

      if (!authHeader || !userId) {
        res.status(400).json({
          error: 'Missing authorization header or user ID'
        });
        return;
      }

      const userSession = await userService.getUserSession(userId);

      if (!userSession) {
        res.status(404).json({
          error: 'User session not found',
          userId
        });
        return;
      }

      const now = new Date();
      const isExpired = userSession.expiresAt < now;
      const timeUntilExpiry = Math.round((userSession.expiresAt.getTime() - now.getTime()) / 1000 / 60);
      const timeUntilExpiryHours = Math.round(timeUntilExpiry / 60);

      res.json({
        success: true,
        message: '✅ 4-Hour Token Flow Test',
        tokenInfo: {
          currentTime: now.toISOString(),
          tokenExpiresAt: userSession.expiresAt.toISOString(),
          isExpired: isExpired,
          minutesUntilExpiry: timeUntilExpiry,
          hoursUntilExpiry: timeUntilExpiryHours,
          tokenAge: userSession.lastRefresh 
            ? Math.round((now.getTime() - userSession.lastRefresh.getTime()) / 1000 / 60)
            : Math.round((now.getTime() - userSession.createdAt!.getTime()) / 1000 / 60),
          hasRefreshToken: !!userSession.refreshToken,
          lastRefresh: userSession.lastRefresh?.toISOString() || 'Never'
        },
        flowStatus: {
          step1_Initial: '✅ Access token valid for 4 hours (14400 seconds)',
          step2_AfterExpiry: isExpired 
            ? '🔄 Token expired - middleware will auto-refresh on next request' 
            : `⏳ Token expires in ${timeUntilExpiryHours} hours (${timeUntilExpiry} minutes)`,
          step3_AutoRefresh: '🔄 Middleware detects expiration → Uses refresh token → Gets new 4-hour token',
          step4_Transparent: '✨ User never sees expiration - seamless experience',
          step5_Continuous: '🔄 Process repeats every 4 hours automatically'
        },
        nextSteps: isExpired 
          ? ['🔄 Make any API request to trigger automatic refresh', '✅ New 4-hour token will be issued'] 
          : [`⏰ Wait ${timeUntilExpiry} minutes for token to expire`, '🔄 Then make API request to see auto-refresh']
      });
    } catch (error) {
      res.status(500).json({
        error: 'Token flow test failed',
        message: (error as Error).message
      });
    }
  }

  async debugUserSession(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const user = await userService.findByUserId(userId);

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
      res.status(500).json({ error: 'Failed to get session', message: (error as Error).message });
    }
  }

  async debugSessionsLog(_req: Request, res: Response): Promise<void> {
    try {
      await userService.logUserSessions('Manual Session Log');

      const allUsers = await userService.findActiveSessions();
      res.json({
        success: true,
        message: 'Sessions logged to console',
        totalSessions: allUsers.length,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to log sessions', message: (error as Error).message });
    }
  }

  async debugSessionsClear(_req: Request, res: Response): Promise<void> {
    try {
      const allUsers = await userService.findActiveSessions();
      const sessionCount = allUsers.length;
      const deleteResult = await userService.cleanupExpiredSessions();

      console.log(`🧹 Cleared ${deleteResult.deletedCount} expired user sessions`);

      res.json({
        success: true,
        message: `Cleared ${deleteResult.deletedCount} expired sessions`,
        totalSessionsBefore: sessionCount,
        remainingSessions: await userService.findActiveSessions().then(users => users.length)
      });
    } catch (error) {
      res.status(500).json({ error: 'Failed to clear sessions', message: (error as Error).message });
    }
  }
} 