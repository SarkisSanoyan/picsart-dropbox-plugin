import React, { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store'

export const SmartRedirect: React.FC = () => {
  const navigate = useNavigate()
  const { 
    selectedImage, 
    directFileId, 
    currentStep,
    isAuthenticated,
    setCurrentStep,
    savedIntent,
    setSavedIntent,
    setDirectFileId,
    recentlyReauthorized
  } = useAppStore()

  useEffect(() => {
    if (!isAuthenticated) return

    console.log('🔍 [SMART REDIRECT] Current state:', {
      isAuthenticated,
      savedIntent,
      recentlyReauthorized,
      selectedImage: selectedImage?.id,
      directFileId,
      currentStep,
      currentPath: window.location.pathname
    })

    // Check if OAuth callback already handled the redirect (has pending_file_id or direct_file_id_oauth)
    const hasPendingFileId = localStorage.getItem('pending_file_id')
    const hasOAuthFileId = localStorage.getItem('direct_file_id_oauth')
    
    if (hasPendingFileId || hasOAuthFileId) {
      console.log('🔍 [SMART REDIRECT] OAuth callback will handle redirect, skipping SmartRedirect')
      return
    }

    // Check if we have saved intent from before reauthorization
    if (savedIntent && recentlyReauthorized) {
      console.log('🎯 [SMART REDIRECT] Found saved intent after reauthorization:', savedIntent)
      
      if (savedIntent.action === 'processing' && savedIntent.fileId) {
        console.log('🎯 [SMART REDIRECT] Restoring processing page with file:', savedIntent.fileId)
        
        // Restore the direct file ID
        setDirectFileId(savedIntent.fileId)
        setCurrentStep('processing')
        
        // Navigate to processing page with the original file
        if (savedIntent.route && savedIntent.route.includes('/process/')) {
          console.log('🎯 [SMART REDIRECT] Navigating to saved route:', savedIntent.route)
          navigate(savedIntent.route, { replace: true })
        } else {
          console.log('🎯 [SMART REDIRECT] Navigating to processing with file ID:', savedIntent.fileId)
          navigate(`/process/${savedIntent.fileId}`, { replace: true })
        }
        
        // Clear saved intent after using it
        console.log('🎯 [SMART REDIRECT] Clearing saved intent after successful restoration')
        setSavedIntent(null)
        return
      } else if (savedIntent.action === 'selection') {
        console.log('🎯 [SMART REDIRECT] Restoring selection page as originally intended')
        setCurrentStep('selection')
        navigate('/select', { replace: true })
        setSavedIntent(null)
        return
      }
    } else {
      console.log('🔍 [SMART REDIRECT] No saved intent or not recently reauthorized:', {
        hasSavedIntent: !!savedIntent,
        recentlyReauthorized,
        savedIntentDetails: savedIntent
      })
    }

    // Standard logic for when there's no saved intent
    const hasSelectedImage = selectedImage && selectedImage.id !== 'unknown'
    const hasDirectFile = directFileId

    console.log('🧭 [SMART REDIRECT] Determining initial route...', {
      hasSelectedImage,
      hasDirectFile,
      selectedImageName: selectedImage?.name,
      currentStep,
      savedIntent,
      recentlyReauthorized
    })

    if (hasSelectedImage || hasDirectFile) {
      console.log('🎯 [SMART REDIRECT] Image already selected, going to processing page')
      setCurrentStep('processing')
      navigate('/process', { replace: true })
    } else {
      console.log('📋 [SMART REDIRECT] No image selected, going to selection page')
      setCurrentStep('selection')
      navigate('/select', { replace: true })
    }
  }, [selectedImage, directFileId, isAuthenticated, navigate, setCurrentStep, currentStep, savedIntent, setSavedIntent, setDirectFileId, recentlyReauthorized])

  // Show loading while determining route
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-purple-100 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin text-4xl mb-4">🔄</div>
        <p className="text-gray-600">
          {savedIntent && recentlyReauthorized ? 'Restoring your session...' : 'Determining best page for you...'}
        </p>
      </div>
    </div>
  )
} 