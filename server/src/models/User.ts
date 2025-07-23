import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  userId: string;
  accessToken: string;
  refreshToken?: string;
  expiresAt: Date;
  dropboxUserId: string;
  userInfo: {
    email: string;
    name: string;
  };
  createdAt: Date;
  lastRefresh?: Date;
  
  // Instance methods
  isTokenExpired(): boolean;
  updateTokens(accessToken: string, refreshToken?: string, expiresIn?: number): Promise<IUser>;
}

export interface IUserModel extends mongoose.Model<IUser> {
  findActiveSessions(): Promise<IUser[]>;
  cleanupExpiredSessions(): Promise<any>;
}

const userSchema: Schema = new Schema({
  userId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  accessToken: {
    type: String,
    required: true
  },
  refreshToken: {
    type: String,
    required: false
  },
  expiresAt: {
    type: Date,
    required: true,
    index: true 
  },
  dropboxUserId: {
    type: String,
    required: true
  },
  userInfo: {
    email: {
      type: String,
      required: true
    },
    name: {
      type: String,
      required: true
    }
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  lastRefresh: {
    type: Date,
    default: null
  }
}, {
  timestamps: true // Automatically adds createdAt and updatedAt
});

// Index for efficient queries
userSchema.index({ userId: 1, expiresAt: 1 });

// Method to check if token is expired
userSchema.methods.isTokenExpired = function(): boolean {
  return this.expiresAt < new Date();
};

// Static method to find active sessions
userSchema.statics.findActiveSessions = function(): Promise<IUser[]> {
  return this.find({ expiresAt: { $gt: new Date() } });
};

// Static method to cleanup expired sessions
userSchema.statics.cleanupExpiredSessions = function(): Promise<any> {
  return this.deleteMany({ expiresAt: { $lt: new Date() } });
};

// Method to update tokens
userSchema.methods.updateTokens = function(accessToken: string, refreshToken?: string, expiresIn: number = 14400): Promise<IUser> {
  this.accessToken = accessToken;
  if (refreshToken) {
    this.refreshToken = refreshToken;
  }
  this.expiresAt = new Date(Date.now() + (expiresIn * 1000));
  this.lastRefresh = new Date();
  return this.save();
};

export const UserModel = mongoose.model<IUser, IUserModel>('User', userSchema);