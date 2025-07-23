import { useCallback } from 'react'
import { useAppStore } from '../store'
import { dropboxApi } from '../api/dropboxApi'
import type { ImageFile } from '../types'

export const useDropbox = () => {
  const {
    accessToken,
    images,
    thumbnailUrls,
    loading,
    setImages,
    setThumbnailUrl,
    setLoading,
    setStatus
  } = useAppStore()

  // === LoadImages function ===
  const loadImages = useCallback(async () => {
    try {
      setLoading(true)
      setStatus('🔄 Loading images...')
      
      if (!accessToken) {
        setStatus('❌ No access token found')
        setLoading(false)
        return
      }
      
      const imageFiles = await dropboxApi.listImages(accessToken)
      setImages(imageFiles)
      
      // Load thumbnails with improved performance - limit concurrent requests
      console.log('🖼️ [LOAD IMAGES] Fetching thumbnails for', imageFiles.length, 'images...')
      
      // Load thumbnails in batches to avoid overwhelming the API
      const batchSize = 5
      for (let i = 0; i < imageFiles.length; i += batchSize) {
        const batch = imageFiles.slice(i, i + batchSize)
        
        // Process batch in parallel
        const thumbnailPromises = batch.map(async (image) => {
          try {
            const thumbnailUrl = await dropboxApi.getThumbnail(accessToken, image.id)
            if (thumbnailUrl) {
              setThumbnailUrl(image.id, thumbnailUrl)
              console.log('✅ [LOAD IMAGES] Loaded thumbnail for:', image.name)
            }
          } catch (error) {
            console.error('❌ Error fetching thumbnail for', image.name, ':', error)
          }
        })
        
        // Wait for current batch to complete before starting next batch
        await Promise.allSettled(thumbnailPromises)
        
        // Small delay between batches to avoid rate limiting
        if (i + batchSize < imageFiles.length) {
          await new Promise(resolve => setTimeout(resolve, 100))
        }
      }
      
      setLoading(false)
      setStatus(`✅ Loaded ${imageFiles.length} images`)
      
    } catch (error) {
      console.error('❌ [LOAD IMAGES] Error loading images:', error)
      setStatus('❌ Failed to load images: ' + (error as Error).message)
      setLoading(false)
    }
  }, [accessToken, setImages, setThumbnailUrl, setLoading, setStatus])

  const fetchThumbnail = useCallback(async (image: ImageFile): Promise<string> => {
    console.log('🔄 fetchThumbnail called for:', image.name, image.id)
    
    if (!accessToken) {
      console.log('❌ No access token for thumbnail fetch')
      return ''
    }
    
    try {
      const thumbnailUrl = await dropboxApi.getThumbnail(accessToken, image.id)
      if (thumbnailUrl) {
        setThumbnailUrl(image.id, thumbnailUrl)
        console.log('✅ Thumbnail created successfully for:', image.name)
        return thumbnailUrl
      }
      return ''
    } catch (error) {
      console.error('❌ Error fetching thumbnail for', image.name, ':', error)
      return ''
    }
  }, [accessToken, setThumbnailUrl])

  return {
    images,
    thumbnailUrls,
    loading,
    loadImages,
    fetchThumbnail
  }
}