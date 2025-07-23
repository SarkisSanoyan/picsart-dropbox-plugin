import { UserRepository } from '../repositories/UserRepository';
import { IUser } from '../models/User';

const userRepo = new UserRepository();

export interface SessionData {
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
  dropboxUserId: string;
  userInfo: {
    email: string;
    name: string;
  };
  lastRefresh?: Date;
}

export class UserService {
  async findActiveSessions(): Promise<IUser[]> {
    return userRepo.findActiveSessions();
  }

  async cleanupExpiredSessions(): Promise<any> {
    return userRepo.cleanupExpiredSessions();
  }

  async findByUserId(userId: string): Promise<IUser | null> {
    return userRepo.findByUserId(userId);
  }

  async create(user: IUser): Promise<IUser> {
    return userRepo.create(user);
  }

  async update(id: string, user: IUser): Promise<IUser | null> {
    return userRepo.update(id, user);
  }

  async delete(id: string): Promise<IUser | null> {
    return userRepo.delete(id);
  }

  // Session management methods
  async getUserSession(userId: string): Promise<IUser | null> {
    try {
      const user = await this.findByUserId(userId);
      if (!user) {
        return null;
      }

      // Return user even if access token is expired - the middleware needs the refresh token
      // The expiration check should be done by the caller when needed
      return user;
    } catch (error) {
      console.error('❌ Error getting user session:', error);
      return null;
    }
  }

  // Separate method to check if user session is valid (access token not expired)
  async isUserSessionValid(userId: string): Promise<boolean> {
    try {
      const user = await this.findByUserId(userId);
      if (!user) {
        return false;
      }

      return !user.isTokenExpired();
    } catch (error) {
      console.error('❌ Error checking user session validity:', error);
      return false;
    }
  }

  async updateTokens(userId: string, accessToken: string, refreshToken?: string, expiresIn: number = 14400): Promise<IUser> {
    try {
      const user = await this.findByUserId(userId);
      if (!user) {
        throw new Error(`User ${userId} not found`);
      }

      console.log(`🔄 [USER SERVICE] Updating tokens for user: ${userId}`);
      console.log(`🔄 [USER SERVICE] Token details:`, {
        newTokenLength: accessToken.length,
        hasRefreshToken: !!refreshToken,
        expiresIn: expiresIn,
        expiresAt: new Date(Date.now() + (expiresIn * 1000)).toISOString()
      });

      await user.updateTokens(accessToken, refreshToken, expiresIn);
      console.log(`✅ [USER SERVICE] Tokens updated successfully for user: ${userId}`);
      return user;
    } catch (error) {
      console.error(`❌ [USER SERVICE] Error updating user tokens for ${userId}:`, error);
      throw error;
    }
  }

  async setUserSession(userId: string, sessionData: SessionData): Promise<IUser> {
    try {
      console.log(`🔄 [USER SERVICE] Setting user session for: ${userId}`);
      console.log(`🔄 [USER SERVICE] Session data:`, {
        hasAccessToken: !!sessionData.accessToken,
        hasRefreshToken: !!sessionData.refreshToken,
        expiresAt: sessionData.expiresAt,
        userEmail: sessionData.userInfo?.email,
        userName: sessionData.userInfo?.name
      });

      // Check if user already exists
      const existingUser = await this.findByUserId(userId);
      
      if (existingUser) {
        // Update existing user session
        existingUser.accessToken = sessionData.accessToken;
        existingUser.refreshToken = sessionData.refreshToken;
        existingUser.expiresAt = new Date(sessionData.expiresAt);
        existingUser.dropboxUserId = sessionData.dropboxUserId;
        existingUser.userInfo = sessionData.userInfo;
        existingUser.lastRefresh = sessionData.lastRefresh ? new Date(sessionData.lastRefresh) : new Date();
        
        const updatedUser = await existingUser.save();
        console.log(`✅ [USER SERVICE] Updated existing user session for ${userId}`);
        console.log(`🔄 [USER SERVICE] Session updated:`, {
          email: updatedUser.userInfo?.email,
          lastRefresh: updatedUser.lastRefresh?.toISOString()
        });
        return updatedUser;
      } else {
        // Create new user session
        const newUser = await userRepo.create({
          userId,
          accessToken: sessionData.accessToken,
          refreshToken: sessionData.refreshToken,
          expiresAt: new Date(sessionData.expiresAt),
          dropboxUserId: sessionData.dropboxUserId,
          userInfo: sessionData.userInfo,
          lastRefresh: sessionData.lastRefresh ? new Date(sessionData.lastRefresh) : null
        } as IUser);
        
        console.log(`✅ [USER SERVICE] Created new user session for ${userId}`);
        console.log(`🔄 [USER SERVICE] New session created:`, {
          email: newUser.userInfo?.email,
          createdAt: newUser.createdAt?.toISOString()
        });
        return newUser;
      }
    } catch (error) {
      console.error(`❌ [USER SERVICE] Error setting user session for ${userId}:`, error);
      throw error;
    }
  }

  // Helper function to log user sessions from MongoDB
  async logUserSessions(title: string = 'Current User Sessions'): Promise<void> {
    console.log('\n' + '='.repeat(50));
    console.log(`📊 ${title}`);
    console.log('='.repeat(50));

    try {
      const allUsers = await this.findActiveSessions();

      if (allUsers.length === 0) {
        console.log('🔍 No active user sessions');
        console.log('='.repeat(50) + '\n');
        return;
      }

      console.log(`📈 Total Sessions: ${allUsers.length}`);
      console.log(`🕐 Current Time: ${new Date().toISOString()}`);
      console.log('─'.repeat(50));

      let activeCount = 0;
      let expiredCount = 0;
      const now = new Date();

      for (const user of allUsers) {
        const isExpired = user.expiresAt < now;
        const timeUntilExpiry = Math.round((user.expiresAt.getTime() - now.getTime()) / 1000 / 60);

        if (isExpired) {
          expiredCount++;
        } else {
          activeCount++;
        }

        console.log(`\n👤 User ID: ${user.userId}`);
        console.log(`   📧 Email: ${user.userInfo?.email || 'N/A'}`);
        console.log(`   👤 Name: ${user.userInfo?.name || 'N/A'}`);
        console.log(`   🔑 Access Token: ${user.accessToken ? user.accessToken.substring(0, 15) + '...' : 'None'}`);
        console.log(`   🔄 Refresh Token: ${user.refreshToken ? user.refreshToken.substring(0, 15) + '...' : 'None'}`);
        console.log(`   📅 Created: ${user.createdAt ? user.createdAt.toISOString() : 'Unknown'}`);
        console.log(`   🔄 Last Refresh: ${user.lastRefresh ? user.lastRefresh.toISOString() : 'Never'}`);
        console.log(`   ⏰ Expires: ${user.expiresAt ? user.expiresAt.toISOString() : 'Unknown'}`);
        console.log(`   ⏱️  Time Until Expiry: ${timeUntilExpiry} minutes`);
        console.log(`   ✅ Status: ${isExpired ? '🔴 EXPIRED' : '🟢 ACTIVE'}`);
      }

      console.log('\n' + '─'.repeat(50));
      console.log(`📊 Summary: ${activeCount} active, ${expiredCount} expired`);
      console.log('='.repeat(50) + '\n');
    } catch (error) {
      console.error('❌ Error logging user sessions:', error);
      console.log('='.repeat(50) + '\n');
    }
  }

  // Enhanced session management with cleanup
  async performSessionMaintenance(): Promise<void> {
    try {
      console.log('🧹 [SESSION MAINTENANCE] Starting session cleanup...');
      
      const allUsers = await this.findActiveSessions();
      const userCount = allUsers.length;
      if (userCount === 0) {
        console.log('📭 [SESSION MAINTENANCE] No sessions to maintain');
        return;
      }

      await this.logUserSessions('Session Maintenance Check');

      // Clean up expired sessions
      const cleanupResult = await this.cleanupExpiredSessions();
      if (cleanupResult.deletedCount > 0) {
        console.log(`🧹 [SESSION MAINTENANCE] Cleaned up ${cleanupResult.deletedCount} expired sessions`);
      } else {
        console.log('✨ [SESSION MAINTENANCE] No expired sessions to clean up');
      }

      console.log('✅ [SESSION MAINTENANCE] Session maintenance completed');
    } catch (error) {
      console.error('❌ [SESSION MAINTENANCE] Error in session maintenance:', error);
    }
  }
}
