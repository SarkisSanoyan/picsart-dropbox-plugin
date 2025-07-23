import express from 'express';
import cors from 'cors';
import userRoutes from './routes/userRoutes';
import authRoutes from './routes/authRoutes';
import dropboxRoutes from './routes/dropboxRoutes';
import imageProcessingRoutes from './routes/imageProcessingRoutes';
import { AuthController } from './controllers/AuthController';

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// 🛡️ SECURITY HEADERS MIDDLEWARE
// app.use((_req, res, next) => {
//   // Content Security Policy
//   res.setHeader('Content-Security-Policy', 
//     "default-src 'self'; " +  // Only load resources from same origin
//     "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +  // Allow inline scripts (needed for Vite)
//     "style-src 'self' 'unsafe-inline'; " +
//     "connect-src 'self' https://api.dropboxapi.com https://content.dropboxapi.com https://www.dropbox.com; " +  // Allow API calls to Dropbox
//     "img-src 'self' data: blob: https://api.dropboxapi.com; " + // Allow images, data URLs, blob URLs (thumbnails)
//     "font-src 'self'; " +
//     "object-src 'none'; " + // Block plugins/embeds
//     "base-uri 'self';"      // Prevent base tag hijacking
//   );
  
//   // Additional security headers
//   res.setHeader('X-Content-Type-Options', 'nosniff');
//   res.setHeader('X-Frame-Options', 'DENY');
//   res.setHeader('X-XSS-Protection', '1; mode=block');
//   res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
//   res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
//   next();
// });

// Request logging middleware
app.use((req, _, next) => {
  console.log(`📝 ${new Date().toISOString()} - ${req.method} ${req.url}`);
  if (Object.keys(req.query).length > 0) {
    console.log('📝 Query params:', req.query);
  }
  next();
});

// OAuth callback route (direct access)
const authController = new AuthController();
app.get('/auth', authController.callback.bind(authController));

// Routes
app.use('/api/users', userRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/dropbox', dropboxRoutes);
app.use('/api', imageProcessingRoutes);

// Root route - redirect to frontend
app.get('/', (_req, res) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  res.redirect(frontendUrl);
});

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

export default app;
