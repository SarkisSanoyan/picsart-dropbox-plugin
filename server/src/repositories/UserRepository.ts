import { IUser, UserModel } from "../models/User";

export class UserRepository {
  async findActiveSessions(): Promise<IUser[]> {
    return UserModel.findActiveSessions();
  }

  async cleanupExpiredSessions(): Promise<any> {
    return UserModel.cleanupExpiredSessions();
  }

  async findByUserId(userId: string): Promise<IUser | null> {
    try {
      console.log(`🔍 [DB] Looking for user: ${userId}`);
      const user = await UserModel.findOne({ userId });
      
      if (user) {
        console.log(`✅ [DB] Found user: ${userId}`);
        console.log(`🔍 [DB] User has refresh token: ${user.refreshToken ? 'YES' : 'NO'}`);
        console.log(`🔍 [DB] Token expires at: ${user.expiresAt}`);
        console.log(`🔍 [DB] Token expired: ${user.isTokenExpired() ? 'YES' : 'NO'}`);
        if (user.refreshToken) {
          console.log(`🔍 [DB] Refresh token preview: ${user.refreshToken.substring(0, 20)}...`);
        }
      } else {
        console.log(`❌ [DB] User not found: ${userId}`);
      }
      
      return user;
    } catch (error) {
      console.error(`❌ [DB] Error finding user ${userId}:`, error);
      throw error;
    }
  }

  async create(user: IUser): Promise<IUser> {
    return UserModel.create(user);
  }

  async update(id: string, user: IUser): Promise<IUser | null> {
    return UserModel.findByIdAndUpdate(id, user, { new: true });
  }

  async delete(id: string): Promise<IUser | null> {
    return UserModel.findByIdAndDelete(id);
  }
}