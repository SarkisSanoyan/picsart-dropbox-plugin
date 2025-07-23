import React, { useEffect, useCallback, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { ImageGallery } from '../components/ImageGallery'
import { NewImageNotification } from '../components/NewImageNotification'
import { useDropbox } from '../hooks/useDropbox'
import { useImageProcessing } from '../hooks/useImageProcessing'
import { useFileUpload } from '../hooks/useFileUpload'
import { useAppStore } from '../store'

export const SelectionPage: React.FC = () => {
  const navigate = useNavigate()
  const { images, thumbnailUrls, loading, loadImages } = useDropbox()
  const { selectImage } = useImageProcessing()
  const { uploadProgress, handleFileUpload } = useFileUpload()
  const { 
    showUploadArea, 
    setShowUploadArea, 
    processingResult,
    showNewImageNotification,
    newImageCount,
    setShowNewImageNotification,
    selectedImage,
    directFileId,
    setCurrentStep
  } = useAppStore()

  // Track if we've loaded images at least once
  const hasLoadedRef = useRef(false)

  // Check if image is already selected and redirect to processing
  useEffect(() => {
    const hasSelectedImage = selectedImage && selectedImage.id !== 'unknown'
    const hasDirectFile = directFileId

    if (hasSelectedImage || hasDirectFile) {
      console.log('🎯 [SELECTION PAGE] Image already selected, redirecting to processing...')
      setCurrentStep('processing')
      navigate('/process', { replace: true })
    }
  }, [selectedImage, directFileId, navigate, setCurrentStep])

  // Always load fresh images when SelectionPage mounts
  useEffect(() => {
    console.log('🔄 [SELECTION PAGE] Selection page mounted, loading fresh images from Dropbox...')
    loadImages()
    hasLoadedRef.current = true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Empty dependency array to run only on mount

  // Auto-refresh when user returns from processing (when processingResult changes)
  useEffect(() => {
    if (processingResult && hasLoadedRef.current) {
      console.log('🔄 [SELECTION PAGE] Processing completed, refreshing image list in background...')
      // Small delay to let the processed images be uploaded to Dropbox
      const refreshTimer = setTimeout(() => {
        console.log('🔄 [SELECTION PAGE] Delayed refresh after processing...')
        loadImages()
      }, 3000) // 3 seconds for processed images to appear in Dropbox
      
      return () => clearTimeout(refreshTimer)
    }
  }, [processingResult, loadImages])

  // Fast refresh function for manual refresh
  const handleFastRefresh = useCallback(async () => {
    console.log('⚡ [SELECTION PAGE] Manual fast refresh triggered')
    await loadImages()
  }, [loadImages])

  // ✅ COMPLETED TODO: Real file upload handler
  const onFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      await handleFileUpload(file)
      // Reset input
      event.target.value = ''
    }
  }

  return (
    <>
      <NewImageNotification
        show={showNewImageNotification}
        count={newImageCount}
        onDismiss={() => setShowNewImageNotification(false)}
      />
      
      <div className="space-y-4 p-2 animate-fadeIn">
      {/* Upload Area */}
      <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-4 border border-purple-200 animate-slideInLeft">
        <h3 className="text-lg font-bold text-purple-800 mb-2 animate-fadeInUp">📤 Upload & Process Images</h3>
        <p className="text-sm text-purple-700 mb-3 animate-fadeInUp animation-delay-100">Upload images from your computer to process with AI:</p>
        
        {!showUploadArea ? (
          <button
            onClick={() => setShowUploadArea(true)}
            className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-4 py-2 rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all duration-300 transform hover:scale-105 hover:shadow-lg text-sm animate-fadeInUp animation-delay-200"
          >
            📁 Choose File
          </button>
        ) : (
          <div className="space-y-3">
            <input
              type="file"
              accept="image/*"
              onChange={onFileChange}
              className="block w-full text-sm text-gray-500
                file:mr-4 file:py-2 file:px-4
                file:rounded-lg file:border-0
                file:text-sm file:font-semibold
                file:bg-purple-50 file:text-purple-700
                hover:file:bg-purple-100"
            />
            {uploadProgress > 0 && (
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-gradient-to-r from-purple-600 to-pink-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
            )}
            <button
              onClick={() => setShowUploadArea(false)}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Image Gallery */}
      <ImageGallery
        images={images}
        thumbnailUrls={thumbnailUrls}
        loading={loading}
        onImageSelect={selectImage}
        onRefresh={handleFastRefresh}
      />
    </div>
    </>
  )
}