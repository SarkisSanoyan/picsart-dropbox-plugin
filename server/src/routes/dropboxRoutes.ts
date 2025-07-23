import express from 'express';
import { DropboxController } from '../controllers/DropboxController';
import { strictAuthMiddleware } from '../middleware/auth';

const router = express.Router();
const dropboxController = new DropboxController();

// List images with IDs - unused in this project - for future security improvement
router.get('/list-images-with-ids', strictAuthMiddleware, dropboxController.listImagesWithIds.bind(dropboxController));

// Get image thumbnail by path - unused in this project - for future security improvement
router.post('/get-image-thumbnail', strictAuthMiddleware, dropboxController.getImageThumbnail.bind(dropboxController));

// Get image thumbnail by file ID - unused in this project - for future security improvement
router.post('/get-image-thumbnail-by-id', strictAuthMiddleware, dropboxController.getImageThumbnailById.bind(dropboxController));

// Get image dimensions - CRITICAL: Use strict auth
router.post('/get-image-dimensions', strictAuthMiddleware, dropboxController.getImageDimensions.bind(dropboxController));

// Get file metadata by ID - CRITICAL: Use strict auth to prevent cross-account file access
router.post('/get-file-metadata-by-id', strictAuthMiddleware, dropboxController.getFileMetadataById.bind(dropboxController));

// Get temporary link for preview - CRITICAL: Use strict auth
router.post('/get-temporary-link', strictAuthMiddleware, dropboxController.getTemporaryLink.bind(dropboxController));

// Upload image - CRITICAL: Use strict auth
router.post('/upload-image', strictAuthMiddleware, DropboxController.getUploadMiddleware(), dropboxController.uploadImage.bind(dropboxController));

export default router; 