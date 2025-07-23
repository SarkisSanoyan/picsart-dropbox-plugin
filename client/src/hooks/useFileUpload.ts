import { useCallback } from 'react'
import { useAppStore } from '../store'
import { useImageProcessing } from './useImageProcessing'
import { imageProcessingApi } from '../api/imageProcessingApi'
import type { ImageFile } from '../types'

export const useFileUpload = () => {
  const {
    accessToken,
    images,
    uploadProgress,
    setImages,
    setLoading,
    setStatus,
    setUploadProgress,
    setShowUploadArea
  } = useAppStore()
  
  const { selectImage } = useImageProcessing()

  // ✅ COMPLETED TODO: Real file upload implementation
  const handleFileUpload = useCallback(async (file: File) => {
    console.log('🚀 [FILE UPLOAD] Starting file upload:', file.name)
    
    if (!file) {
      console.error('❌ [FILE UPLOAD] No file provided')
      setStatus('❌ No file selected')
      return
    }
    
    if (!accessToken) {
      console.error('❌ [FILE UPLOAD] No access token available')
      setStatus('❌ Please log in to upload files')
      return
    }
    
    console.log('✅ [FILE UPLOAD] File and auth validated, starting upload...')
    setLoading(true)
    setUploadProgress(0)
    setStatus('📤 Uploading file...')
    
    try {
      // ✅ REAL API CALL - Upload file
      console.log('📤 [FILE UPLOAD] Calling API to upload file...')
      const uploadResult = await imageProcessingApi.uploadFile(file, (progress) => {
        console.log(`📊 [FILE UPLOAD] Progress: ${progress}%`)
        setUploadProgress(progress)
        setStatus(`📤 Uploading... ${progress}%`)
      })
      
      console.log('✅ [FILE UPLOAD] Upload successful:', uploadResult)
      setStatus(`✅ Upload successful: ${uploadResult.fileName}`)
      
      // Create ImageFile object from upload result
      const newImage: ImageFile = {
        id: uploadResult.fileId,
        name: uploadResult.fileName,
        path_display: uploadResult.filePath,
        path_lower: uploadResult.filePath.toLowerCase(),
        size: uploadResult.fileSize
      }
      
      console.log('📝 [FILE UPLOAD] Created image object:', newImage)
      
      // Add to images list
      setImages([newImage, ...images])
      setShowUploadArea(false)
      
      // Auto-select the uploaded image
      console.log('🎯 [FILE UPLOAD] Auto-selecting uploaded image...')
      selectImage(newImage)
      
    } catch (error) {
      console.error('❌ [FILE UPLOAD] Upload failed:', error)
      
      // Enhanced error handling
      let errorMessage = 'Upload failed'
      if (error instanceof Error) {
        errorMessage = error.message
      } else if (typeof error === 'object' && error !== null && 'response' in error) {
        const apiError = error as { response?: { data?: { message?: string } } }
        errorMessage = apiError.response?.data?.message || 'Server error'
      }
      
      console.error('❌ [FILE UPLOAD] Error details:', errorMessage)
      setStatus('❌ Upload failed: ' + errorMessage)
    } finally {
      console.log('🏁 [FILE UPLOAD] Upload process completed, cleaning up...')
      setLoading(false)
      setUploadProgress(0)
    }
  }, [accessToken, images, setImages, setLoading, setStatus, setUploadProgress, setShowUploadArea, selectImage])

  return {
    uploadProgress,
    handleFileUpload
  }
}