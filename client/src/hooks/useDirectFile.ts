import { useEffect, useCallback } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { useAppStore } from '../store'
// Account validation removed - 409 errors trigger banner directly via events
import { dropboxApi } from '../api/dropboxApi'

export const useDirectFile = () => {
  const { fileId } = useParams<{ fileId?: string }>()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  
  const {
    accessToken,
    isAuthenticated,
    directFileId,
    setDirectFileId,
    setSelectedImage,
    setSelectedImageThumbnail,
    setCurrentStep,
    setStatus,
    setLoading
  } = useAppStore()

  useEffect(() => {
    // Check for direct file ID from URL params
    const urlFileId = fileId || 
                      searchParams.get('file_id') || 
                      searchParams.get('id') || 
                      searchParams.get('dropbox_file_id')

    if (urlFileId && urlFileId !== directFileId) {
      setDirectFileId(urlFileId)
      
      // Clean up URL parameters
      if (searchParams.has('file_id') || searchParams.has('id')) {
        const newSearchParams = new URLSearchParams(searchParams)
        newSearchParams.delete('file_id')
        newSearchParams.delete('id')
        newSearchParams.delete('dropbox_file_id')
        
        const newUrl = window.location.pathname + 
          (newSearchParams.toString() ? '?' + newSearchParams.toString() : '')
        window.history.replaceState({}, '', newUrl)
      }
    }
  }, [fileId, searchParams, directFileId, setDirectFileId])

   
  useEffect(() => {
    // Load file when authenticated and we have a direct file ID
    if (isAuthenticated && accessToken && (directFileId || fileId)) {
      const idToLoad = fileId || directFileId
      if (idToLoad) {
        loadDirectFile(idToLoad)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, accessToken, directFileId, fileId])

  // Real loadFileById implementation
  const loadDirectFile = useCallback(async (id: string) => {
    if (!accessToken) {
      console.warn('No access token available for loading direct file')
      return
    }

    try {
      setLoading(true)
      setStatus('🔄 Loading your selected image...')
      
      console.log('🔄 Loading direct file:', id)
      
      // Get file by ID
      const imageFile = await dropboxApi.getFileById(accessToken, id)
      
      setSelectedImage(imageFile)
      setCurrentStep('processing')
      
      // Load thumbnail
      try {
        const thumbnailUrl = await dropboxApi.getThumbnail(accessToken, imageFile.id)
        if (thumbnailUrl) {
          setSelectedImageThumbnail(thumbnailUrl)
        }
      } catch (thumbnailError) {
        console.error('❌ Error loading thumbnail:', thumbnailError)
        setStatus(`⚠️ Loaded: ${imageFile.name} (preview unavailable)`)
      }
      
      setStatus(`✅ Loaded: ${imageFile.name}`)
      
      // Navigate to processing page if not already there
      if (window.location.pathname !== '/process') {
        navigate('/process')
      }
      
    } catch (error) {
      console.error('❌ Error loading direct file:', error)
      
      // Check if this is a cross-account access error (409)
      if (error && typeof error === 'object' && 'status' in error) {
        const dropboxError = error as { status?: number; error?: { error_summary?: string } }
        if (dropboxError.status === 409 || (dropboxError.error?.error_summary?.includes('path/not_found'))) {
          console.log('🚨 [DIRECT FILE] 409 error detected - FORCING account mismatch banner')
          
          // CRITICAL: 409 errors ALWAYS indicate cross-account access - trigger banner immediately
          window.dispatchEvent(new CustomEvent('accountMismatch', {
            detail: {
              accountEmail: 'Cross-account file access detected',
              accountId: 'file-409-error',
              error: 'This file link was created for a different Dropbox account. You may have switched accounts in your browser.',
              source: 'direct-file-409',
              confirmed: true
            }
          }))
          
          console.log('🚨 [DIRECT FILE] Account mismatch banner should now be visible!')
          return
        }
      }
      
      setStatus('❌ Error loading selected file: ' + (error as Error).message)
      navigate('/select')
    } finally {
      setLoading(false)
    }
  }, [accessToken, setLoading, setStatus, setSelectedImage, setSelectedImageThumbnail, setCurrentStep, navigate])

  return { loadDirectFile }
}