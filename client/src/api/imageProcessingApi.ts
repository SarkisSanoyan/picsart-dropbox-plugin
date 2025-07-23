import type { ImageFile, ProcessingOptions, ProcessingResult } from '../types'
import { apiClient } from './axiosConfig'

export const imageProcessingApi = {
  async processImage(
    image: ImageFile,
    options: ProcessingOptions,
    onProgress?: (progress: number) => void
  ): Promise<ProcessingResult> {
    const response = await apiClient.post('/process-image', {
      dropboxPath: image.path_display,
      removeBg: options.removeBg,
      upscale: options.upscale,
      upscaleFactor: options.upscaleFactor
    }, {
      onUploadProgress: (progressEvent: { loaded: number; total?: number }) => {
        if (onProgress && progressEvent.total) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total)
          onProgress(progress)
        }
      },
      timeout: 300000
    })
    
    return response.data
  },

  async uploadFile(file: File, onProgress?: (progress: number) => void): Promise<{ fileName: string; filePath: string; fileId: string; fileSize: number }> {
    const formData = new FormData()
    formData.append('file', file)
    
    const response = await apiClient.post('/dropbox/upload-image', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      onUploadProgress: (progressEvent: { loaded: number; total?: number }) => {
        if (onProgress && progressEvent.total) {
          const progress = Math.round((progressEvent.loaded * 100) / progressEvent.total)
          onProgress(progress)
        }
      },
      timeout: 120000 // 2 minutes timeout for upload
    })
    
    return response.data
  },

  async getThumbnailByPath(path: string): Promise<Blob> {
    const response = await apiClient.post('/dropbox/get-image-thumbnail', {
      path: path
    }, {
      responseType: 'blob'
    })
    
    return response.data
  },

  async testPicsartAPI(): Promise<{ success: boolean; message: string; error?: string }> {
    try {
      const response = await apiClient.get('/test-picsart')
      return response.data
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      const responseError = (error as { response?: { data?: { message?: string } } })?.response?.data?.message
      return {
        success: false,
        message: 'Picsart API test failed',
        error: responseError || errorMessage
      }
    }
  },

  // Test function for debugging upload issues
  async testUploadConnection(): Promise<{ success: boolean; message: string; error?: string }> {
    try {
      console.log('🧪 [UPLOAD TEST] Testing upload endpoint connection...')
      
      // Create a small test file
      const testContent = 'test upload'
      const testFile = new Blob([testContent], { type: 'text/plain' })
      const file = new File([testFile], 'test.txt', { type: 'text/plain' })
      
      // Test the upload endpoint (this will likely fail due to file type, but will test the connection)
      try {
        await this.uploadFile(file)
        return { success: true, message: 'Upload endpoint is working' }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error'
        // If it's a file type error, that means the endpoint is working
        if (errorMessage.includes('image') || errorMessage.includes('type')) {
          return { success: true, message: 'Upload endpoint is working (file type validation working)' }
        }
        throw error
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error'
      const responseError = (error as { response?: { data?: { message?: string } } })?.response?.data?.message
      return {
        success: false,
        message: 'Upload endpoint test failed',
        error: responseError || errorMessage
      }
    }
  }
}

// Make it available globally for debugging
declare global {
  interface Window {
    testUpload: () => Promise<void>
    imageProcessingApi: typeof imageProcessingApi
  }
}

// Add global test function for console debugging
if (typeof window !== 'undefined') {
  window.imageProcessingApi = imageProcessingApi
  window.testUpload = async () => {
    console.log('🧪 Running upload test...')
    const result = await imageProcessingApi.testUploadConnection()
    console.log('🧪 Upload test result:', result)
  }
}