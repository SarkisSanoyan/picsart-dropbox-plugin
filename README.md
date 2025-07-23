# Picsart Dropbox Plugin

A full-stack application that integrates Picsart's AI-powered image processing APIs with Dropbox for seamless image management and enhancement.

## Features

- 🎨 **Background Removal**: Remove backgrounds from images using Picsart's AI
- 🔍 **Image Upscaling**: Enhance image resolution up to 8x using AI
- ☁️ **Dropbox Integration**: Direct integration with your Dropbox account
- 📤 **File Upload**: Upload new images directly to Dropbox
- 🔐 **OAuth 2.0 Security**: Secure authentication with PKCE
- 📱 **Responsive UI**: Modern React interface with Tailwind CSS

## Architecture

This project follows a clean, organized full-stack architecture:

```
├── client/          # React frontend (Vite + TypeScript)
├── server/          # Express.js backend (TypeScript)
│   ├── src/
│   │   ├── controllers/     # API endpoint handlers
│   │   ├── services/        # Business logic
│   │   ├── models/          # Database models
│   │   ├── routes/          # API routes
│   │   ├── middleware/      # Authentication middleware
│   │   └── config/          # Database configuration
└── package.json     # Root package for scripts
```

## Prerequisites

- Node.js 18+ and npm
- MongoDB (local or Atlas)
- Dropbox Developer Account
- Picsart Developer Account

## Setup Instructions

### 1. Clone and Install Dependencies

```bash
git clone <your-repo>
cd fullstack-picsart-dropbox-plugin
npm install
```

### 2. Database Setup

**Option A: Local MongoDB**
```bash
# Install MongoDB
brew install mongodb-community  # macOS
# or follow: https://docs.mongodb.com/manual/installation/

# Start MongoDB
brew services start mongodb-community
```

**Option B: MongoDB Atlas**
1. Create account at https://cloud.mongodb.com
2. Create a cluster and get connection string

### 3. Dropbox App Setup

1. Go to https://www.dropbox.com/developers/apps
2. Create a new app with these settings:
   - API: Dropbox API
   - Type: Full Dropbox
   - Name: Your app name
3. In app settings:
   - Add redirect URI: `http://localhost:3000/auth`
   - Note your Client ID and Client Secret

### 4. Picsart API Setup

1. Go to https://picsart.com/api
2. Sign up for developer account
3. Get your API key from dashboard

### 5. Environment Configuration

Create `server/.env` file:
```env
# MongoDB
MONGODB_URI=mongodb://localhost:27017/picsart-dropbox-plugin

# Dropbox OAuth
DROPBOX_CLIENT_ID=your_dropbox_client_id
DROPBOX_CLIENT_SECRET=your_dropbox_client_secret
DROPBOX_REDIRECT_URI=http://localhost:3000/auth

# Picsart API
PICSART_API_KEY=your_picsart_api_key

# Server
PORT=5000
NODE_ENV=development
```

Create `client/.env` file:
```env
VITE_DROPBOX_CLIENT_ID=your_dropbox_client_id
VITE_DROPBOX_REDIRECT_URI=http://localhost:3000/auth
```

### 6. Install Dependencies

```bash
# Install server dependencies
cd server && npm install

# Install client dependencies  
cd ../client && npm install
```

## Running the Application

### Development Mode

Start both frontend and backend:
```bash
npm run dev
```

This runs:
- Backend server on http://localhost:5000
- Frontend client on http://localhost:3000

### Individual Services

```bash
# Backend only
npm run server

# Frontend only
npm run client
```

## API Endpoints

### Authentication
- `POST /api/auth/exchange-token` - OAuth token exchange
- `GET /api/auth/status` - Check authentication status
- `GET /api/auth/test-token` - Test token validity
- `POST /api/auth/refresh-token` - Refresh access token

### Dropbox Operations
- `GET /api/dropbox/list-images-with-ids` - List user's images
- `POST /api/dropbox/get-image-thumbnail` - Get image thumbnail
- `POST /api/dropbox/get-image-dimensions` - Get image dimensions
- `POST /api/dropbox/upload-image` - Upload new image

### Image Processing
- `POST /api/process-image` - Process image (remove BG/upscale)

### User Management
- `GET /api/users/session` - Get user session
- `GET /api/users/debug/sessions` - Debug all sessions

## Usage Flow

1. **Authentication**: User clicks "Connect with Dropbox"
2. **PKCE Setup**: Frontend generates code verifier and challenge
3. **OAuth Authorization**: User redirected to Dropbox with PKCE parameters
4. **Authorization Code**: Dropbox redirects back with authorization code
5. **Token Exchange**: Frontend exchanges code for access/refresh tokens using PKCE
6. **Image Selection**: Choose from existing Dropbox images or upload new ones
7. **Processing Options**: Select background removal and/or upscaling
8. **AI Processing**: Picsart APIs process the image
9. **Results**: Processed images are saved back to Dropbox

## Security Features

- **PKCE OAuth 2.0**: Secure authorization flow with Proof Key for Code Exchange
- **Token Management**: Automatic token refresh with refresh tokens
- **Account Validation**: Prevents cross-account access attacks
- **Session Isolation**: Each user gets separate database records
- **State Parameter**: Prevents CSRF attacks during OAuth flow
- **Code Verifier**: Prevents authorization code interception attacks

## Error Handling

The application includes comprehensive error handling:
- Token expiration and refresh
- API rate limiting
- File size validation
- Network connectivity issues
- Cross-account access prevention

## Troubleshooting

### MongoDB Connection Issues
```bash
# Check if MongoDB is running
brew services list | grep mongo

# Restart MongoDB
brew services restart mongodb-community
```

### Token Issues
- Clear browser localStorage and re-authenticate
- Check Dropbox app redirect URI matches exactly
- Verify environment variables are set correctly

### Processing Failures
- Ensure Picsart API key is valid
- Check image file size (max 50MB)
- Verify internet connectivity

## Development

### Project Structure
- **Controllers**: Handle HTTP requests and responses
- **Services**: Contain business logic (Dropbox, Picsart operations)
- **Models**: Define database schemas
- **Middleware**: Handle authentication and validation
- **Routes**: Define API endpoints

### Adding New Features
1. Create service in `server/src/services/`
2. Add controller in `server/src/controllers/`
3. Define routes in `server/src/routes/`
4. Update frontend components as needed

## Contributing

1. Fork the repository
2. Create feature branch
3. Implement changes following the existing architecture
4. Test thoroughly
5. Submit pull request

## License

MIT License - see LICENSE file for details 