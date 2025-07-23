/* eslint-disable @typescript-eslint/no-explicit-any */
import { Dropbox } from 'dropbox'
import type { ImageFile, DropboxFileMetadata } from '../types'

export const dropboxApi = {
  async listImages(accessToken: string): Promise<ImageFile[]> {
    const dbx = new Dropbox({ accessToken })
    
    console.log('🔍 [LOAD IMAGES] Starting image load (server will handle token refresh if needed)...')
    
    const response = await dbx.filesListFolder({ path: '' })
    const imageFiles = response.result.entries
      .filter((file: any) => file['.tag'] === 'file' && /\.(jpg|jpeg|png|gif|bmp|webp)$/i.test(file.name))
      .map((file: any): ImageFile => ({
        id: file.id || file.path_lower,
        name: file.name,
        path_display: file.path_display || file.path_lower,
        path_lower: file.path_lower,
        size: file.size || 0,
        width: file.width,
        height: file.height
      }))
    
    console.log('✅ [LOAD IMAGES] Successfully loaded', imageFiles.length, 'images')
    return imageFiles
  },

  async getThumbnail(accessToken: string, fileId: string): Promise<string | null> {
    try {
      const dbx = new Dropbox({ accessToken })
      
      const response = await dbx.filesGetThumbnailV2({
        resource: { '.tag': 'path', path: fileId.startsWith('id:') ? fileId : `id:${fileId}` },
        format: { '.tag': 'jpeg' },
        size: { '.tag': 'w256h256' }
      })
      
      const result = response.result as { fileBlob?: Blob; fileBinary?: ArrayBuffer }
      let thumbnailBlob: Blob
      
      if (result.fileBlob) {
        thumbnailBlob = result.fileBlob
      } else if (result.fileBinary) {
        thumbnailBlob = new Blob([result.fileBinary], { type: 'image/jpeg' })
      } else {
        throw new Error('No fileBlob or fileBinary found in thumbnail response')
      }
      
      const thumbnailUrl = URL.createObjectURL(thumbnailBlob)
      console.log('✅ Thumbnail created successfully')
      return thumbnailUrl
    } catch (error) {
      console.error('❌ Error fetching thumbnail:', error)
      return null
    }
  },

  async getFileById(accessToken: string, fileId: string): Promise<ImageFile> {
    const dbx = new Dropbox({ accessToken })
    
    let formattedFileId = fileId
    if (!fileId.startsWith('id:')) {
      formattedFileId = 'id:' + fileId
    }
    
    const metadataResponse = await dbx.filesGetMetadata({ path: formattedFileId })
    const fileData = metadataResponse.result as DropboxFileMetadata
    
    if (fileData['.tag'] !== 'file') {
      throw new Error('Provided ID is not a file')
    }
    
    console.log('📄 File metadata loaded:', fileData.name)
    
    const imageFile: ImageFile = {
      id: fileData.id,
      name: fileData.name,
      path_display: fileData.path_display,
      path_lower: fileData.path_lower,
      size: fileData.size
    }
    
    // Load dimensions using client-side SDK
    try {
      const downloadResponse = await dbx.filesDownload({ path: formattedFileId })
      const result = downloadResponse.result as { fileBlob?: Blob; fileBinary?: ArrayBuffer }
      const fileBlob = result.fileBlob
      
      if (fileBlob) {
        const img = new Image()
        const objectUrl = URL.createObjectURL(fileBlob)
        
        await new Promise((resolve, reject) => {
          img.onload = () => {
            imageFile.width = img.width
            imageFile.height = img.height
            URL.revokeObjectURL(objectUrl)
            resolve(null)
          }
          img.onerror = reject
          img.src = objectUrl
        })
        
        console.log('📐 Image dimensions loaded:', imageFile.width, 'x', imageFile.height)
      }
    } catch (dimensionsError) {
      console.log('Could not get dimensions for direct file:', dimensionsError)
    }
    
    return imageFile
  },

  // Get temporary download link for processed images
  async getTemporaryLink(accessToken: string, filePath: string): Promise<string> {
    try {
      console.log('🔗 [DROPBOX] Getting temporary link for:', filePath)
      const dbx = new Dropbox({ accessToken })
      
      const response = await dbx.filesGetTemporaryLink({ path: filePath })
      const link = response.result.link
      
      console.log('✅ [DROPBOX] Temporary link created:', link)
      return link
    } catch (error) {
      console.error('❌ [DROPBOX] Error getting temporary link:', error)
      throw error
    }
  }
}