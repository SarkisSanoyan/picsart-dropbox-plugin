import { useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store'
import { useAccountValidation } from './useAccountValidation'
import { dropboxApi } from '../api/dropboxApi'
import { imageProcessingApi } from '../api/imageProcessingApi'
import { calculateSafeUpscaleFactors, generateUpscaleWarning } from '../utils/upscale'
import type { ImageFile, UpscaleWarning } from '../types'

export const useImageProcessing = () => {
  const navigate = useNavigate()
  const { validateBeforeOperation } = useAccountValidation()
  const {
    accessToken,
    images,
    selectedImage,
    processingOptions,
    processingResult,
    processingProgress,
    processingStage,
    loading,
    upscaleWarning,
    availableUpscaleFactors,
    setImages,
    setSelectedImage,
    setCurrentStep,
    updateProcessingOptions,
    setProcessingResult,
    setLoading,
    setStatus,
    setUpscaleWarning,
    setAvailableUpscaleFactors,
    setProcessingProgress,
    setProcessingStage,
    setSelectedImageThumbnail,
    setThumbnailUrl,
    setShowNewImageNotification,
    setNewImageCount
  } = useAppStore()

  // Full selectImage with dimension loading
  const selectImage = useCallback(async (image: ImageFile) => {
    try {
      console.log('🔍 [SELECT IMAGE] Starting image selection...')
      
      // CRITICAL: Clear previous thumbnail immediately to avoid showing old preview
      console.log('🧹 [SELECT IMAGE] Clearing previous thumbnail...')
      setSelectedImageThumbnail(null)
      
      // CRITICAL: Validate account before selecting image (USER_OPERATION - respects grace period)
      console.log('🔍 [SELECT IMAGE] Validating account before image selection...')
      const isAccountValid = await validateBeforeOperation('USER_OPERATION')
      if (!isAccountValid) {
        console.log('🚨 [SELECT IMAGE] Account validation failed, blocking image selection')
        setStatus('🚨 Account verification required. Please check the warning banner above.')
        return
      }
      console.log('✅ [SELECT IMAGE] Account validation passed, proceeding with selection')
      
      // Create a copy to potentially update with dimensions
      const imageWithDimensions = { ...image }
      
      // Add dimension loading logic
      if (!image.width || !image.height) {
        console.log('📐 [SELECT IMAGE] Image dimensions missing, attempting to load...')
        setStatus('📐 Loading image dimensions...')
        
        try {
          if (accessToken) {
            // Get file metadata with dimensions using Dropbox API
            const fileWithDimensions = await dropboxApi.getFileById(accessToken, image.id)
            imageWithDimensions.width = fileWithDimensions.width
            imageWithDimensions.height = fileWithDimensions.height
            console.log('📐 [SELECT IMAGE] Image dimensions loaded:', imageWithDimensions.width, 'x', imageWithDimensions.height)
          }
        } catch (dimensionsError) {
          console.log('❌ [SELECT IMAGE] Could not get dimensions:', dimensionsError)
          setStatus('⚠️ Could not load image dimensions - upscaling may be limited')
        }
      }
      
      setSelectedImage(imageWithDimensions)
      setCurrentStep('processing')
      setProcessingResult(null)
      
      // Load thumbnail for preview
      if (accessToken) {
        try {
          console.log('🖼️ [SELECT IMAGE] Loading thumbnail for new image...')
          setStatus('🖼️ Loading image preview...')
          const thumbnailUrl = await dropboxApi.getThumbnail(accessToken, imageWithDimensions.id)
          if (thumbnailUrl) {
            console.log('✅ [SELECT IMAGE] Thumbnail loaded successfully')
            setSelectedImageThumbnail(thumbnailUrl)
          } else {
            console.log('⚠️ [SELECT IMAGE] No thumbnail available for this image')
          }
        } catch (thumbnailError) {
          console.error('❌ Error loading thumbnail:', thumbnailError)
          console.log('⚠️ [SELECT IMAGE] Thumbnail failed to load, will show placeholder')
        }
      }
      
      // Update upscale factors
      const imageData = {
        size: imageWithDimensions.size,
        width: imageWithDimensions.width,
        height: imageWithDimensions.height,
        name: imageWithDimensions.name,
        path: imageWithDimensions.path_display
      }
      
      const safeFactors = calculateSafeUpscaleFactors(imageData)
      setAvailableUpscaleFactors(safeFactors)
      
      if (safeFactors.length === 0) {
        const warning = generateUpscaleWarning(imageData)
        setUpscaleWarning(warning as UpscaleWarning)
        setTimeout(() => setUpscaleWarning(null), 5000)
      } else {
        setUpscaleWarning(null)
      }
      
      setStatus(`✅ Selected: ${imageWithDimensions.name}${imageWithDimensions.width && imageWithDimensions.height ? ` (${imageWithDimensions.width}×${imageWithDimensions.height})` : ''}`)
      
      navigate('/process')
      
    } catch (error) {
      console.error('❌ [SELECT IMAGE] Error selecting image:', error)
      setStatus('❌ Failed to select image: ' + (error as Error).message)
    }
  }, [accessToken, validateBeforeOperation, setSelectedImage, setCurrentStep, setProcessingResult, setStatus, setAvailableUpscaleFactors, setUpscaleWarning, setSelectedImageThumbnail, navigate])

  // Real processImage implementation
  const processImage = useCallback(async () => {
    if (!selectedImage || !accessToken) return
    
    // Validate processing options
    if (!processingOptions.removeBg && !processingOptions.upscale) {
      setStatus('❌ Please select at least one processing option (Remove Background or Upscale).')
      return
    }

    // CRITICAL: Validate account before processing (USER_OPERATION - respects grace period)
    console.log('🔍 [IMAGE PROCESSING] Validating account before processing...')
    const isAccountValid = await validateBeforeOperation('USER_OPERATION')
    if (!isAccountValid) {
      console.log('🚨 [IMAGE PROCESSING] Account validation failed, blocking image processing')
      setStatus('🚨 Account verification required. Please check the warning banner above.')
      return
    }
    console.log('✅ [IMAGE PROCESSING] Account validation passed, proceeding with processing')
    
    setLoading(true)
    setProcessingProgress(0)
    setStatus('🎨 Processing image...')
    
    // Simulate processing progress stages
    const updateProgress = (stage: string, progress: number) => {
      setProcessingStage(stage)
      setProcessingProgress(progress)
      setStatus(`🎨 ${stage}... ${progress}%`)
    }
    
    try {
      updateProgress('Preparing image', 10)
      await new Promise(resolve => setTimeout(resolve, 500))
      
      updateProgress('Uploading to processing server', 25)
      await new Promise(resolve => setTimeout(resolve, 500))
      
      updateProgress('Processing with AI', 50)
      
      // Process image with actual API
      const result = await imageProcessingApi.processImage(
        selectedImage,
        processingOptions,
        (progress) => {
          // Update progress during API call
          const adjustedProgress = 50 + (progress * 0.4) // Scale to 50-90%
          updateProgress('Processing with AI', Math.round(adjustedProgress))
        }
      )
      
      updateProgress('Finalizing results', 90)
      await new Promise(resolve => setTimeout(resolve, 500))
      
      updateProgress('Complete', 100)
      
      console.log('✅ [IMAGE PROCESSING] Processing completed, result:', result)    // ← PROCESSING COMPLETED
      
      // Load thumbnails for processed images
      if (result.results) {
        console.log('🖼️ [IMAGE PROCESSING] Loading thumbnails for processed images...')
        
        const thumbnailPromises = []
        
        // Load thumbnail for background removed image
        if (result.results.backgroundRemoved) {
          console.log('🎨 [IMAGE PROCESSING] Loading thumbnail for background removed image:', result.results.backgroundRemoved)
          const bgRemovedPromise = imageProcessingApi.getThumbnailByPath(result.results.backgroundRemoved)
            .then(blob => {
              const thumbnailUrl = URL.createObjectURL(blob)
              console.log('✅ [IMAGE PROCESSING] Background removed thumbnail loaded:', thumbnailUrl)
              setThumbnailUrl(result.results.backgroundRemoved!, thumbnailUrl)
            })
            .catch(error => {
              console.error('❌ [IMAGE PROCESSING] Failed to load background removed thumbnail:', error)
            })
          thumbnailPromises.push(bgRemovedPromise)
        }
        
        // Load thumbnail for upscaled image
        if (result.results.upscaled) {
          console.log('🔍 [IMAGE PROCESSING] Loading thumbnail for upscaled image:', result.results.upscaled)
          const upscaledPromise = imageProcessingApi.getThumbnailByPath(result.results.upscaled)
            .then(blob => {
              const thumbnailUrl = URL.createObjectURL(blob)
              console.log('✅ [IMAGE PROCESSING] Upscaled thumbnail loaded:', thumbnailUrl)
              setThumbnailUrl(result.results.upscaled!, thumbnailUrl)
            })
            .catch(error => {
              console.error('❌ [IMAGE PROCESSING] Failed to load upscaled thumbnail:', error)
            })
          thumbnailPromises.push(upscaledPromise)
        }
        
        // Wait for all thumbnails to load (or fail)
        try {
          await Promise.allSettled(thumbnailPromises)
          console.log('🏁 [IMAGE PROCESSING] All result thumbnails processed')
        } catch (error) {
          console.error('⚠️ [IMAGE PROCESSING] Some thumbnails failed to load:', error)
        }
      }
      
      // Add processed images to the images list immediately
      if (result.results) {
        console.log('📝 [IMAGE PROCESSING] Adding processed images to gallery...')
        const newImages: ImageFile[] = []
        
        // Add background removed image to gallery
        if (result.results.backgroundRemoved) {
          const bgRemovedImage: ImageFile = {
            id: result.results.backgroundRemoved,
            name: `${selectedImage.name.replace(/\.[^/.]+$/, '')}_bg_removed.png`,
            path_display: result.results.backgroundRemoved,
            path_lower: result.results.backgroundRemoved.toLowerCase(),
            size: 0, // Size unknown, will be updated on next refresh
            width: selectedImage.width,
            height: selectedImage.height
          }
          newImages.push(bgRemovedImage)
          console.log('🎨 [IMAGE PROCESSING] Added background removed image to gallery:', bgRemovedImage.name)
        }
        
        // Add upscaled image to gallery  
        if (result.results.upscaled) {
          const upscaledImage: ImageFile = {
            id: result.results.upscaled,
            name: `${selectedImage.name.replace(/\.[^/.]+$/, '')}_upscaled.jpg`,
            path_display: result.results.upscaled,
            path_lower: result.results.upscaled.toLowerCase(),
            size: 0, // Size unknown, will be updated on next refresh
            width: selectedImage.width ? selectedImage.width * (processingOptions.upscaleFactor || 2) : undefined,
            height: selectedImage.height ? selectedImage.height * (processingOptions.upscaleFactor || 2) : undefined
          }
          newImages.push(upscaledImage)
          console.log('🔍 [IMAGE PROCESSING] Added upscaled image to gallery:', upscaledImage.name)
        }
        
        // Add new images to the beginning of the list
        if (newImages.length > 0) {
          setImages([...newImages, ...images])
          console.log('✅ [IMAGE PROCESSING] Added', newImages.length, 'processed images to gallery')
          
          // Show notification
          setNewImageCount(newImages.length)
          setShowNewImageNotification(true)
        }
      }
      
      setProcessingResult(result)
      setCurrentStep('results')
      setStatus('✅ Processing completed successfully!')
      navigate('/results')
      
    } catch (error) {
      console.error('Error processing image:', error)
      setStatus('❌ Processing failed: ' + (error as Error).message)
      setProcessingProgress(0)
      setProcessingStage('')
    } finally {
      setLoading(false)
      setTimeout(() => {
        setProcessingProgress(0)
        setProcessingStage('')
      }, 1000)
    }
  }, [selectedImage, accessToken, images, processingOptions, validateBeforeOperation, setImages, setLoading, setProcessingProgress, setStatus, setProcessingStage, setProcessingResult, setCurrentStep, navigate, setThumbnailUrl, setShowNewImageNotification, setNewImageCount])

  const handleUpscaleToggle = useCallback((enabled: boolean) => {
    if (enabled) {
      if (!selectedImage || !selectedImage.size) {
        const warning = generateUpscaleWarning({ size: 0 })
        setUpscaleWarning(warning as UpscaleWarning)
        setTimeout(() => setUpscaleWarning(null), 5000)
        return
      }
      
      const imageData = {
        size: selectedImage.size,
        width: selectedImage.width,
        height: selectedImage.height,
        name: selectedImage.name,
        path: selectedImage.path_display
      }
      
      const safeFactors = calculateSafeUpscaleFactors(imageData)
      
      if (safeFactors.length === 0) {
        const warning = generateUpscaleWarning(imageData)
        setUpscaleWarning(warning as UpscaleWarning)
        setTimeout(() => setUpscaleWarning(null), 5000)
        return
      } else {
        setUpscaleWarning(null)
        setAvailableUpscaleFactors(safeFactors)
        updateProcessingOptions({ 
          upscale: true,
          upscaleFactor: safeFactors[0]
        })
        return
      }
    } else {
      setUpscaleWarning(null)
    }
    
    updateProcessingOptions({ upscale: enabled })
  }, [selectedImage, setUpscaleWarning, setAvailableUpscaleFactors, updateProcessingOptions])

  return {
    selectedImage,
    processingOptions,
    processingResult,
    processingProgress,
    processingStage,
    loading,
    upscaleWarning,
    availableUpscaleFactors,
    selectImage,
    processImage,
    updateProcessingOptions,
    handleUpscaleToggle
  }
}