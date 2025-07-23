import { Request, Response } from 'express';
import { PicsartService } from '../services/PicsartService';
import { DropboxService } from '../services/DropboxService';
import { validateBeforeOperation } from '../utils/accountValidation';

const picsartService = new PicsartService();
const dropboxService = new DropboxService();

export class ImageProcessingController {
  // Main image processing endpoint
  async processImage(req: Request, res: Response): Promise<void> {
    try {
      // CRITICAL SECURITY: Validate account before processing sensitive operations
      const isValidated = await validateBeforeOperation(req, res, 'ImageProcessing');
      if (!isValidated) {
        // validateBeforeOperation already sent the response
        return;
      }

      if (!req.dbx) {
        res.status(401).json({ error: 'Dropbox instance not available' });
        return;
      }

      const { dropboxPath, removeBg, upscale, upscaleFactor } = req.body;

      if (!dropboxPath) {
        res.status(400).json({ error: 'Dropbox path is required' });
        return;
      }

      if (!removeBg && !upscale) {
        res.status(400).json({ error: 'At least one processing option must be selected' });
        return;
      }

      console.log('🎯 Processing request:', { dropboxPath, removeBg, upscale, upscaleFactor });

      // Download the original image
      const originalBuffer = await dropboxService.downloadImage(req.dbx, dropboxPath);
      console.log('📥 Original image downloaded, size:', originalBuffer.length, 'bytes');

      const results: any = {};

      // Don't upload original - only processed versions will be saved
      let processedBuffer = originalBuffer;

      // Step 1: Remove background if requested
      if (removeBg) {
        console.log('🎨 Starting background removal...');
        try {
          const bgRemovedBuffer = await picsartService.removeBg(processedBuffer);
          console.log('✅ Background removed successfully');

          // Upload background-removed image
          const bgRemovedPath = await dropboxService.uploadProcessedImage(
            req.dbx,
            bgRemovedBuffer,
            dropboxPath,
            'bg_removed'
          );
          results.backgroundRemoved = bgRemovedPath;
          processedBuffer = bgRemovedBuffer;
        } catch (error) {
          console.error('❌ Background removal failed:', error);
          res.status(500).json({
            error: 'Background removal failed',
            message: (error as Error).message
          });
          return;
        }
      }

      // Step 2: Upscale if requested
      if (upscale) {
        console.log(`🔍 Starting upscaling with factor ${upscaleFactor}x...`);
        try {
          const upscaledBuffer = await picsartService.upscale(processedBuffer, upscaleFactor || 2);
          console.log('✅ Upscaling completed successfully');

          // Upload upscaled image
          const upscaledPath = await dropboxService.uploadProcessedImage(
            req.dbx,
            upscaledBuffer,
            dropboxPath,
            `upscaled_${upscaleFactor}x`
          );
          results.upscaled = upscaledPath;
        } catch (error) {
          console.error('❌ Upscaling failed:', error);
          res.status(500).json({
            error: 'Upscaling failed',
            message: (error as Error).message
          });
          return;
        }
      }

      console.log('🎉 Processing completed successfully');
      res.json({
        success: true,
        message: 'Image processing completed successfully',
        results: results
      });

    } catch (error) {
      console.error('❌ Image processing failed:', error);
      res.status(500).json({
        error: 'Image processing failed',
        message: (error as Error).message
      });
    }
  }

  // Test endpoint
  async test(_req: Request, res: Response): Promise<void> {
    res.json({
      message: 'Server is running correctly!',
      timestamp: new Date().toISOString(),
      port: process.env.PORT || 5000,
      redirectUri: process.env.DROPBOX_REDIRECT_URI
    });
  }

  // Test Picsart API connection
  async testPicsart(_req: Request, res: Response): Promise<void> {
    try {
      console.log('🧪 Testing Picsart API connection...');
      
      const hasApiKey = !!process.env.PICSART_API_KEY;
      console.log('🔑 Has PICSART_API_KEY:', hasApiKey);
      
      if (!hasApiKey) {
        res.status(500).json({
          success: false,
          error: 'PICSART_API_KEY not set',
          message: 'Please add PICSART_API_KEY to your environment variables',
          help: 'Get your API key from: https://picsart.io/api/'
        });
        return;
      }

      // Test API connection
      const testResult = await picsartService.testConnection();
      
      if (testResult) {
        res.json({
          success: true,
          message: 'Picsart API connection successful!',
          apiKey: process.env.PICSART_API_KEY?.substring(0, 8) + '...',
          timestamp: new Date().toISOString()
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Picsart API test failed',
          message: 'Check server logs for details'
        });
      }
    } catch (error) {
      console.error('❌ Picsart API test failed:', error);
      res.status(500).json({
        success: false,
        error: 'Picsart API test failed',
        message: (error as Error).message,
        help: 'Check your PICSART_API_KEY and network connection'
      });
    }
  }
} 