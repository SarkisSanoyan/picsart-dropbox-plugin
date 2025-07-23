import mongoose from 'mongoose';

// Default MongoDB connection URL (can be overridden with environment variable)
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/picsart-dropbox-plugin';

// MongoDB connection options
const connectOptions = {
  serverSelectionTimeoutMS: 5000,
  socketTimeoutMS: 45000,
  maxPoolSize: 10, 
  heartbeatFrequencyMS: 10000, 
  bufferCommands: false
};

// Connect to MongoDB
async function connectToDB() {
  try {
    console.log('🔌 Connecting to MongoDB...');
    console.log('📍 MongoDB URI:', MONGODB_URI.replace(/\/\/.*@/, '//***:***@')); 
    
    await mongoose.connect(MONGODB_URI, connectOptions);
    
    console.log('✅ MongoDB connected successfully');
    console.log('📊 Database:', mongoose.connection.db?.databaseName);
    
    // Handle connection events
    mongoose.connection.on('error', (err: Error) => {
      console.error('❌ MongoDB connection error:', err);
    });
    
    mongoose.connection.on('disconnected', () => {
      console.warn('⚠️ MongoDB disconnected');
    });
    
    mongoose.connection.on('reconnected', () => {
      console.log('🔄 MongoDB reconnected');
    });
    
    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\n🔄 Shutting down gracefully...');
      await mongoose.connection.close();
      console.log('✅ MongoDB connection closed');
      process.exit(0);
    });
    
    return mongoose.connection;
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error);
    
    // Provide helpful error messages
    if (error instanceof Error && error.name === 'MongoServerSelectionError') {
      console.error('💡 Make sure MongoDB is running on your system');
      console.error('   - Install MongoDB: https://docs.mongodb.com/manual/installation/');
      console.error('   - Start MongoDB: brew services start mongodb-community (macOS)');
      console.error('   - Or use MongoDB Atlas: https://www.mongodb.com/cloud/atlas');
    }
    
    throw error;
  }
}

// Check if connected
function isConnected() {
  return mongoose.connection.readyState === 1;
}

// Get connection status
function getConnectionStatus() {
  const states: { [key: number]: string } = {
    0: 'disconnected',
    1: 'connected',
    2: 'connecting',
    3: 'disconnecting'
  };
  return states[mongoose.connection.readyState] || 'unknown';
}

export {
  connectToDB,
  isConnected,
  getConnectionStatus,
  mongoose
}; 