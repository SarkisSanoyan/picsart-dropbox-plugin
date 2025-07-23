import { Request, Response } from 'express';
import { DropboxService } from '../services/DropboxService';
import { validateBeforeOperation, logSecurityEvent } from '../utils/accountValidation';
import multer from 'multer';

const dropboxService = new DropboxService();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024,
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(null, false);
    }
  }
});

export class DropboxController {
  // List images with IDs
  async listImagesWithIds(req: Request, res: Response): Promise<void> {
    try {
      // CRITICAL SECURITY: Validate account before listing sensitive data
      const isValidated = await validateBeforeOperation(req, res, 'ListImages');
      if (!isValidated) {
        logSecurityEvent(
          'Blocked image listing due to account validation failure',
          'ListImages',
          { 
            userId: req.headers['x-user-id'],
            accountId: req.currentAccountId,
            path: req.path 
          },
          'CRITICAL'
        );
        return;
      }

      if (!req.dbx) {
        res.status(401).json({ error: 'Dropbox instance not available' });
        return;
      }

      console.log(`📁 Listing images for validated user: ${req.currentAccountId}`);
      const result = await dropboxService.listImagesWithIds(req.dbx);
      
      logSecurityEvent(
        'Successfully listed images for validated user',
        'ListImages',
        { 
          userId: req.currentAccountId,
          imageCount: result.images?.length || 0
        },
        'INFO'
      );
      
      res.json(result);
    } catch (error) {
      console.error('❌ Error listing images:', error);
      
      logSecurityEvent(
        'Failed to list images',
        'ListImages',
        { 
          userId: req.currentAccountId,
          error: (error as Error).message
        },
        'WARNING'
      );
      
      res.status(500).json({ 
        error: 'Failed to list images', 
        message: (error as Error).message 
      });
    }
  }

  // Get image thumbnail by path - unused in this project - for future security improvement
  async getImageThumbnail(req: Request, res: Response): Promise<void> {
    try {
      if (!req.dbx) {
        res.status(401).json({ error: 'Dropbox instance not available' });
        return;
      }

      const { path } = req.body;
      
      if (!path) {
        res.status(400).json({ error: 'Path is required' });
        return;
      }

      const thumbnailBuffer = await dropboxService.getImageThumbnail(req.dbx, path);
      
      res.set({
        'Content-Type': 'image/jpeg',
        'Content-Length': thumbnailBuffer.length.toString()
      });
      
      res.send(thumbnailBuffer);
    } catch (error) {
      console.error('❌ Error getting thumbnail:', error);
      res.status(500).json({ 
        error: 'Failed to get thumbnail', 
        message: (error as Error).message 
      });
    }
  }

  // Get image thumbnail by file ID
  async getImageThumbnailById(req: Request, res: Response): Promise<void> {
    try {
      if (!req.dbx) {
        res.status(401).json({ error: 'Dropbox instance not available' });
        return;
      }

      const { fileId } = req.body;
      
      if (!fileId) {
        res.status(400).json({ error: 'File ID is required' });
        return;
      }

      const thumbnailBuffer = await dropboxService.getImageThumbnailById(req.dbx, fileId);
      
      res.set({
        'Content-Type': 'image/jpeg',
        'Content-Length': thumbnailBuffer.length.toString()
      });
      
      res.send(thumbnailBuffer);
    } catch (error) {
      console.error('❌ Error getting thumbnail by ID:', error);
      res.status(500).json({ 
        error: 'Failed to get thumbnail', 
        message: (error as Error).message 
      });
    }
  }

  // Get image dimensions
  async getImageDimensions(req: Request, res: Response): Promise<void> {
    try {
      if (!req.dbx) {
        res.status(401).json({ error: 'Dropbox instance not available' });
        return;
      }

      const { path, fileId } = req.body;

      if (!path && !fileId) {
        res.status(400).json({ error: 'Missing path or fileId' });
        return;
      }

      const dimensions = await dropboxService.getImageDimensions(req.dbx, path, fileId);
      res.json(dimensions);
    } catch (error) {
      console.error('❌ Error getting image dimensions:', error);
      res.status(500).json({
        error: 'Failed to get image dimensions',
        message: (error as Error).message
      });
    }
  }

  // Upload image
  async uploadImage(req: Request, res: Response): Promise<void> {
    try {
      if (!req.dbx) {
        res.status(401).json({ error: 'Dropbox instance not available' });
        return;
      }

      if (!req.file) {
        res.status(400).json({ error: 'No file uploaded' });
        return;
      }

      const result = await dropboxService.uploadImage(
        req.dbx,
        req.file.buffer,
        req.file.originalname
      );

      res.json(result);
    } catch (error) {
      console.error('❌ Error uploading file:', error);
      res.status(500).json({
        error: 'File upload failed',
        message: (error as Error).message
      });
    }
  }

  // Get upload middleware
  static getUploadMiddleware() {
    return upload.single('file');
  }

  // Get file metadata by ID
  async getFileMetadataById(req: Request, res: Response): Promise<void> {
    try {
      if (!req.dbx) {
        res.status(401).json({ error: 'Dropbox instance not available' });
        return;
      }

      const { fileId } = req.body;
      
      if (!fileId) {
        res.status(400).json({ error: 'File ID is required' });
        return;
      }

      const fileMetadata = await dropboxService.getFileMetadataById(req.dbx, fileId);
      res.json(fileMetadata);
    } catch (error) {
      console.error('❌ Error getting file metadata by ID:', error);
      res.status(500).json({
        error: 'Failed to get file metadata',
        message: (error as Error).message
      });
    }
  }

  // Get temporary link for preview
  async getTemporaryLink(req: Request, res: Response): Promise<void> {
    try {
      if (!req.dbx) {
        res.status(401).json({ error: 'Dropbox instance not available' });
        return;
      }

      const { path } = req.body;
      
      if (!path) {
        res.status(400).json({ error: 'Path is required' });
        return;
      }

      const temporaryLink = await dropboxService.getTemporaryLink(req.dbx, path);
      res.json({ link: temporaryLink });
    } catch (error) {
      console.error('❌ Error getting temporary link:', error);
      res.status(500).json({
        error: 'Failed to get temporary link',
        message: (error as Error).message
      });
    }
  }
} 