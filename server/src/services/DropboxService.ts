import { Dropbox } from 'dropbox';
import sharp from 'sharp';

export interface DropboxFile {
  id: string;
  name: string;
  path_display: string;
  path_lower: string;
  size: number;
}

export interface ImageDimensions {
  width: number;
  height: number;
  format: string;
  size: number;
  source: string;
}

export class DropboxService {
  async listImagesWithIds(dbx: Dropbox): Promise<{ images: DropboxFile[] }> {
    try {
      console.log('📋 Attempting to list images from Dropbox root directory...');
      
      // Try to list files in the root directory
      const response = await dbx.filesListFolder({ path: '', recursive: false });
      const allFiles = response.result.entries;
      
      console.log(`📁 Found ${allFiles.length} total entries in Dropbox root`);
      
      // Log all files for debugging
      allFiles.forEach((entry: any) => {
        console.log(`📄 ${entry['.tag']}: ${entry.name} ${entry['.tag'] === 'file' ? `(${entry.size} bytes)` : ''}`);
      });

      // Filter for files only (not folders)
      const files = allFiles.filter((entry: any) => entry['.tag'] === 'file');
      console.log(`📄 Found ${files.length} files (excluding folders)`);

      // Filter for image files only
      const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.tiff', '.tif'];
      const imageFiles: DropboxFile[] = files
        .filter((file: any) => {
          const lowercaseName = file.name.toLowerCase();
          const isImage = imageExtensions.some(ext => lowercaseName.endsWith(ext));
          console.log(`🖼️ ${file.name}: ${isImage ? 'IS IMAGE' : 'NOT IMAGE'}`);
          return isImage;
        })
        .map((file: any) => ({
          id: file.id,
          name: file.name,
          path_display: file.path_display,
          path_lower: file.path_lower,
          size: file.size
        }));

      console.log(`✅ Found ${imageFiles.length} image files in Dropbox root`);
      console.log('📋 Image files:', imageFiles.map(f => f.name));
      
      return { images: imageFiles };
    } catch (error: any) {
      console.error('❌ Error listing images:', error);
      console.error('❌ Error details:', {
        message: error.message,
        status: error.status,
        error_summary: error.error?.error_summary,
        error_tag: error.error?.error?.['.tag']
      });
      
      // If we don't have permission, fall back gracefully
      if (error.error && error.error.error_summary && error.error.error_summary.includes('insufficient_permissions')) {
        console.log('ℹ️  No files.metadata.read permission - users must upload files');
        return { images: [] };
      }
      
      // For other errors, still return empty array but log the issue
      console.log('ℹ️  Cannot list files, returning empty array. Users can still upload.');
      return { images: [] };
    }
  }

  async getImageThumbnail(dbx: Dropbox, path: string): Promise<Buffer> {
    try {
      console.log('🖼️ Getting thumbnail for:', path);
      
      const response = await dbx.filesGetThumbnailV2({
        resource: { '.tag': 'path', path },
        format: 'jpeg' as any,
        size: 'w256h256' as any
      });

      // Fix: Support both fileBlob (Blob) and fileBinary (Buffer/string) from Dropbox SDK
      const result = response.result as any;
      let buffer: Buffer;

      if (result.fileBlob && typeof result.fileBlob.arrayBuffer === 'function') {
        // fileBlob is a Blob (browser or node-fetch)
        const arrayBuffer = await result.fileBlob.arrayBuffer();
        buffer = Buffer.from(arrayBuffer);
      } else if (result.fileBinary) {
        // fileBinary is a Buffer or string (older SDKs)
        buffer = Buffer.from(result.fileBinary);
      } else {
        throw new Error('No fileBlob or fileBinary found in Dropbox thumbnail response');
      }

      return buffer;
    } catch (error) {
      console.error('❌ Error getting thumbnail:', error);
      throw error;
    }
  }

  async getImageThumbnailById(dbx: Dropbox, fileId: string): Promise<Buffer> {
    try {
      console.log('🖼️ Getting thumbnail for file ID:', fileId);
      
      let fileIdToUse = fileId;
      if (!fileId.startsWith('id:')) {
        fileIdToUse = 'id:' + fileId;
      }

      const response = await dbx.filesGetThumbnailV2({
        resource: { '.tag': 'path', path: fileIdToUse },
        format: 'jpeg' as any,
        size: 'w256h256' as any
      });

      // Fix: Support both fileBlob and fileBinary
      const result = response.result as any;
      if (result.fileBlob && typeof result.fileBlob.arrayBuffer === 'function') {
        const arrayBuffer = await result.fileBlob.arrayBuffer();
        return Buffer.from(arrayBuffer);
      } else if (result.fileBinary) {
        return Buffer.from(result.fileBinary);
      } else {
        throw new Error('No fileBlob or fileBinary found in Dropbox response');
      }
    } catch (error) {
      console.error('❌ Error getting thumbnail by ID:', error);
      throw error;
    }
  }

  async getImageDimensions(dbx: Dropbox, path?: string, fileId?: string): Promise<ImageDimensions> {
    try {
      if (!path && !fileId) {
        throw new Error('Missing path or fileId');
      }

      let filePath = path;

      // If fileId is provided but no path, we can't get metadata without permission
      if (fileId && !path) {
        throw new Error('Path is required when files.metadata.read permission is not available');
      }

      if (!filePath) {
        throw new Error('Could not determine file path');
      }

      // Try to get thumbnail first (faster and safer)
      try {
        const thumbnailResponse = await dbx.filesGetThumbnailV2({
          resource: { '.tag': 'path', path: filePath },
          format: 'jpeg' as any,
          size: 'w2048h1536' as any
        });

        // Fix: Support both fileBlob and fileBinary for thumbnails
        const thumbnailResult = thumbnailResponse.result as any;
        let thumbnailBuffer: Buffer;
        if (thumbnailResult.fileBlob && typeof thumbnailResult.fileBlob.arrayBuffer === 'function') {
          const arrayBuffer = await thumbnailResult.fileBlob.arrayBuffer();
          thumbnailBuffer = Buffer.from(arrayBuffer);
        } else if (thumbnailResult.fileBinary) {
          thumbnailBuffer = Buffer.from(thumbnailResult.fileBinary);
        } else {
          throw new Error('No fileBlob or fileBinary found in thumbnail response');
        }
        const metadata = await sharp(thumbnailBuffer).metadata();

        let actualWidth = metadata.width || 0;
        let actualHeight = metadata.height || 0;

        // If the thumbnail is at max size, try to get the original
        if (metadata.width && metadata.height && (metadata.width >= 2048 || metadata.height >= 1536)) {
          const downloadResponse = await dbx.filesDownload({ path: filePath });
          // Fix: Support both fileBlob and fileBinary for downloads
          const downloadResult = downloadResponse.result as any;
          let fileBuffer: Buffer;
          if (downloadResult.fileBlob && typeof downloadResult.fileBlob.arrayBuffer === 'function') {
            const arrayBuffer = await downloadResult.fileBlob.arrayBuffer();
            fileBuffer = Buffer.from(arrayBuffer);
          } else if (downloadResult.fileBinary) {
            fileBuffer = Buffer.from(downloadResult.fileBinary);
          } else {
            throw new Error('No fileBlob or fileBinary found in download response');
          }

          const originalMetadata = await sharp(fileBuffer).metadata();
          actualWidth = originalMetadata.width || 0;
          actualHeight = originalMetadata.height || 0;
        }

        return {
          width: actualWidth,
          height: actualHeight,
          format: metadata.format || 'unknown',
          size: thumbnailBuffer.length,
          source: 'thumbnail'
        };

      } catch (thumbnailError) {
        // Fallback: Download the original file
        const downloadResponse = await dbx.filesDownload({ path: filePath });
        // Fix: Support both fileBlob and fileBinary for fallback download
        const downloadResult = downloadResponse.result as any;
        let fileBuffer: Buffer;
        if (downloadResult.fileBlob && typeof downloadResult.fileBlob.arrayBuffer === 'function') {
          const arrayBuffer = await downloadResult.fileBlob.arrayBuffer();
          fileBuffer = Buffer.from(arrayBuffer);
        } else if (downloadResult.fileBinary) {
          fileBuffer = Buffer.from(downloadResult.fileBinary);
        } else {
          throw new Error('No fileBlob or fileBinary found in fallback download response');
        }

        const metadata = await sharp(fileBuffer).metadata();

        return {
          width: metadata.width || 0,
          height: metadata.height || 0,
          format: metadata.format || 'unknown',
          size: fileBuffer.length,
          source: 'original'
        };
      }
    } catch (error) {
      console.error('❌ Error getting image dimensions:', error);
      throw error;
    }
  }

  async getFileMetadataById(dbx: Dropbox, fileId: string): Promise<DropboxFile> {
    try {
      console.log('📁 Getting file metadata for ID:', fileId);
      
      // Ensure fileId has the proper format
      let formattedFileId = fileId;
      if (!fileId.startsWith('id:')) {
        formattedFileId = 'id:' + fileId;
      }

      const metadata = await dbx.filesGetMetadata({ path: formattedFileId });
      const file = metadata.result as any;

      if (file['.tag'] !== 'file') {
        throw new Error('Provided ID is not a file');
      }

      return {
        id: file.id,
        name: file.name,
        path_display: file.path_display,
        path_lower: file.path_lower,
        size: file.size
      };
    } catch (error) {
      console.error('❌ Error getting file metadata by ID:', error);
      throw error;
    }
  }

  async getTemporaryLink(dbx: Dropbox, path: string): Promise<string> {
    try {
      console.log('🔗 Getting temporary link for:', path);
      
      const response = await dbx.filesGetTemporaryLink({ path });
      return response.result.link;
    } catch (error) {
      console.error('❌ Error getting temporary link:', error);
      throw error;
    }
  }

  async uploadImage(dbx: Dropbox, fileBuffer: Buffer, originalName: string): Promise<{
    success: boolean;
    message: string;
    fileName: string;
    filePath: string;
    fileId: string;
    fileSize: number;
  }> {
    try {
      // Generate a unique filename
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const extension = originalName.substring(originalName.lastIndexOf('.'));
      const baseName = originalName.substring(0, originalName.lastIndexOf('.'));
      const fileName = `${baseName}_${timestamp}${extension}`;
      const filePath = `/${fileName}`;

      console.log('📤 Uploading file to Dropbox:', fileName);

      // Upload to Dropbox
      const uploadResponse = await dbx.filesUpload({
        path: filePath,
        contents: fileBuffer,
        mode: { '.tag': 'add' },
        autorename: true,
      });

      console.log('✅ File uploaded successfully:', uploadResponse.result.path_display);

      return {
        success: true,
        message: 'File uploaded successfully',
        fileName: fileName,
        filePath: uploadResponse.result.path_display || filePath,
        fileId: uploadResponse.result.id,
        fileSize: fileBuffer.length
      };
    } catch (error) {
      console.error('❌ Error uploading file:', error);
      throw error;
    }
  }

  async downloadImage(dbx: Dropbox, path: string): Promise<Buffer> {
    try {
      console.log('📥 Downloading image from Dropbox:', path);
      
      const downloadResponse = await dbx.filesDownload({ path });
      // Fix: Support both fileBlob and fileBinary
      const result = downloadResponse.result as any;
      if (result.fileBlob && typeof result.fileBlob.arrayBuffer === 'function') {
        const arrayBuffer = await result.fileBlob.arrayBuffer();
        return Buffer.from(arrayBuffer);
      } else if (result.fileBinary) {
        return Buffer.from(result.fileBinary);
      } else {
        throw new Error('No fileBlob or fileBinary found in download response');
      }
    } catch (error) {
      console.error('❌ Error downloading image:', error);
      throw error;
    }
  }

  async uploadProcessedImage(dbx: Dropbox, imageBuffer: Buffer, originalPath: string, suffix: string): Promise<string> {
    try {
      // Generate new filename based on original
      const pathParts = originalPath.split('/');
      const originalFileName = pathParts[pathParts.length - 1];
      const nameWithoutExt = originalFileName.substring(0, originalFileName.lastIndexOf('.'));
      const extension = originalFileName.substring(originalFileName.lastIndexOf('.'));
      
      const newFileName = `${nameWithoutExt}_${suffix}${extension}`;
      const newPath = originalPath.replace(originalFileName, newFileName);

      console.log('📤 Uploading processed image to Dropbox:', newPath);

      await dbx.filesUpload({
        path: newPath,
        contents: imageBuffer,
        mode: { '.tag': 'add' },
        autorename: true,
      });

      console.log('✅ Processed image uploaded successfully:', newPath);
      return newPath;
    } catch (error) {
      console.error('❌ Error uploading processed image:', error);
      throw error;
    }
  }
} 