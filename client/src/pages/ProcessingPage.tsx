import React, { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useImageProcessing } from '../hooks/useImageProcessing'
import { useDirectFile } from '../hooks/useDirectFile'
import { useAppStore } from '../store'

export const ProcessingPage: React.FC = () => {
  const { fileId } = useParams<{ fileId?: string }>()
  const navigate = useNavigate()
  
  const {
    selectedImage,
    processingOptions,
    loading,
    processingProgress,
    processingStage,
    upscaleWarning,
    availableUpscaleFactors,
    processImage,
    updateProcessingOptions,
    handleUpscaleToggle
  } = useImageProcessing()
  
  const {
    directFileId,
    selectedImageThumbnail,
    setCurrentStep,
    setSelectedImage,
    setProcessingResult,
    setDirectFileId,
    setSelectedImageThumbnail
  } = useAppStore()

  // Initialize direct file loading
  useDirectFile()


  const handleProcessAnother = () => {
    console.log('🔄 [PROCESSING] User clicked Back to Selection - clearing ALL state and navigating')
    console.log('🔄 [PROCESSING] Current state before clearing:', {
      hasSelectedImage: !!selectedImage,
      directFileId,
      fileId,
      currentPath: window.location.pathname
    })
    
    // Clear ALL processing state including directFileId and thumbnail
    setSelectedImage(null)
    setProcessingResult(null)
    setDirectFileId(null)  // This is important!
    setSelectedImageThumbnail(null)  // Clear thumbnail to avoid showing old preview
    setCurrentStep('selection')
    
    console.log('🔄 [PROCESSING] State cleared, navigating to /select')
    
    // Navigate to selection page
    navigate('/select')
  }

  // Handle fileId from URL params
  useEffect(() => {
    if (fileId) {
      console.log('📋 Processing page loaded with fileId:', fileId)
      // Direct file loading is handled by useDirectFile hook
    }
  }, [fileId])

  if (!selectedImage && !fileId && !directFileId) {
    return (
      <div className="p-4 text-center">
        <p className="text-gray-600">No image selected. Please go back to selection.</p>
        <button
          onClick={() => {
            setCurrentStep('selection')
            navigate('/select')
          }}
          className="mt-4 bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors"
        >
          ← Back to Selection
        </button>
      </div>
    )
  }

  return (
    <div className={`${loading ? 'space-y-2' : 'space-y-4'} p-2 flex flex-col min-h-0`}>
      {/* Back to selection button - only show if not direct file flow */}
      {!directFileId && !fileId && (
        <div className="text-center flex-shrink-0">
          <button
            onClick={handleProcessAnother}
            className="bg-gray-500 text-white px-3 py-2 rounded-lg hover:bg-gray-600 transition-colors text-sm"
          >
            ← Back to Selection
          </button>
        </div>
      )}
      
      {/* Direct file indicator */}
      {(directFileId || fileId) && (
        <div className="text-center flex-shrink-0">
          <div className={`bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg ${loading ? 'p-2' : 'p-3'} border border-blue-200`}>
            <div className="flex items-center justify-center space-x-2 text-blue-700">
              <span className="text-lg">🔗</span>
              <span className="text-sm font-medium">Direct file from Dropbox</span>
            </div>
            {!loading && (
              <p className="text-xs text-blue-600 mt-1">
                This image was selected directly from Dropbox Choose API
              </p>
            )}
          </div>
        </div>
      )}
      
      {/* Selected Image Preview */}
      <div className={`bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg ${loading ? 'p-3' : 'p-4'} border border-purple-200 flex-shrink-0`}>
        <h3 className={`text-lg font-semibold text-purple-800 ${loading ? 'mb-2' : 'mb-3'}`}>📷 Selected Image</h3>
        {selectedImage && (
          <div className={`text-center ${loading ? 'space-y-2' : 'space-y-3'}`}>
            <div className={`group ${loading ? 'w-48 h-32' : 'w-60 h-40'} mx-auto rounded-lg flex items-center justify-center overflow-hidden border border-purple-200 transition-all duration-300 cursor-pointer hover:shadow-xl hover:scale-105 hover:-translate-y-1 hover:border-purple-400 relative`}>
              <div className="absolute inset-0 bg-gradient-to-r from-purple-600/5 to-pink-600/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-lg"></div>
              
              {selectedImageThumbnail ? (
                <img
                  src={selectedImageThumbnail}
                  alt={selectedImage.name}
                  className="max-w-full max-h-full object-contain rounded-lg transition-all duration-300 group-hover:scale-110 group-hover:brightness-110"
                />
              ) : (
                <div className="flex flex-col items-center justify-center text-gray-400 space-y-2">
                  <div className="animate-spin text-2xl">🔄</div>
                  <span className="text-sm">Loading preview...</span>
                </div>
              )}
              
              <div className="absolute inset-0 rounded-lg border-2 border-transparent group-hover:border-purple-400 transition-all duration-300"></div>
              <div className="absolute inset-0 rounded-lg shadow-inner opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
            </div>
            
            <div className="space-y-1">
              <p className="font-medium text-gray-700 text-sm">{selectedImage.name}</p>
              {selectedImage.width && selectedImage.height && (
                <p className="text-xs text-gray-500">{selectedImage.width} × {selectedImage.height} pixels</p>
              )}
              <p className="text-xs text-green-600">✅ Ready for processing</p>
            </div>
          </div>
        )}
      </div>

      {/* Processing Options */}
      <div className={`bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg ${loading ? 'p-3' : 'p-4'} border border-purple-200 flex-1 min-h-0 flex flex-col`}>
        <h3 className={`text-lg font-semibold text-purple-800 ${loading ? 'mb-2' : 'mb-3'}`}>⚙️ Processing Options</h3>
        
        <div className={`${loading ? 'space-y-2' : 'space-y-4'} flex-shrink-0`}>
          <label className="flex items-center space-x-3">
            <input
              type="checkbox"
              checked={processingOptions.removeBg}
              onChange={(e) => updateProcessingOptions({ removeBg: e.target.checked })}
              className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
              disabled={loading}
            />
            <span className="text-gray-700">🎨 Remove Background</span>
          </label>
          
          <label className="flex items-center space-x-3">
            <input
              type="checkbox"
              checked={processingOptions.upscale}
              onChange={(e) => handleUpscaleToggle(e.target.checked)}
              className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
              disabled={loading}
            />
            <span className="text-gray-700">🔍 Upscale Image</span>
          </label>
          
          {/* Upscale Warning */}
          {upscaleWarning && !loading && (
            <div className="ml-7 p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-start space-x-2">
                <span className="text-red-500 mt-0.5">⚠️</span>
                <div>
                  <p className="text-sm font-medium text-red-800">Upscaling Not Available</p>
                  <p className="text-xs text-red-600 mt-1">{upscaleWarning.message}</p>
                </div>
              </div>
            </div>
          )}
          
          {processingOptions.upscale && !loading && (
            <div className="ml-7 space-y-2">
              <label className="block text-sm text-gray-600">Upscale Factor:</label>
              <select
                value={processingOptions.upscaleFactor}
                onChange={(e) => updateProcessingOptions({ upscaleFactor: parseInt(e.target.value) })}
                disabled={availableUpscaleFactors.length === 0}
                className={`border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-purple-500 focus:border-purple-500 ${
                  availableUpscaleFactors.length === 0 ? 'bg-gray-100 cursor-not-allowed' : ''
                }`}
              >
                {availableUpscaleFactors.length === 0 ? (
                  <option value="2">❌ File too large for upscaling</option>
                ) : (
                  availableUpscaleFactors.map((factor, index) => (
                    <option key={factor} value={factor}>
                      {factor}x{index === 0 ? ' (Recommended)' : ''}
                    </option>
                  ))
                )}
              </select>
              
              {selectedImage && (
                <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded border">
                  {availableUpscaleFactors.length === 0 ? (
                    <>
                      ⚠️ Image dimensions ({selectedImage.width || 0}×{selectedImage.height || 0}) are too large for upscaling<br/>
                      📉 Try a smaller image or use background removal only
                    </>
                  ) : (
                    <>
                      ✅ {availableUpscaleFactors.length} safe option{availableUpscaleFactors.length > 1 ? 's' : ''} for {selectedImage.width || 0}×{selectedImage.height || 0} image<br/>
                      🛡️ Factors limited based on pixel dimensions (max 4800×4800 output)
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Processing Progress */}
        {loading && processingProgress > 0 && (
          <div className="mt-3 flex-shrink-0">
            <h4 className="text-base font-semibold text-purple-800 mb-3 animate-fadeInUp flex items-center gap-2">
              <span className="animate-spin text-lg">🎨</span>
              <span>AI Processing</span>
            </h4>
            
            <div className="mb-4 space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-gray-800 truncate animate-pulse">{processingStage}</span>
                <span className="text-sm font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent animate-pulse">
                  {processingProgress}%
                </span>
              </div>
              
              <div className="relative">
                <div className="w-full bg-gradient-to-r from-gray-100 to-gray-200 rounded-full h-3 shadow-inner overflow-hidden">
                  <div 
                    className="h-full rounded-full relative overflow-hidden transition-all duration-700 ease-out"
                    style={{ 
                      width: `${processingProgress}%`,
                      background: `linear-gradient(90deg, 
                        ${processingProgress < 25 ? '#8b5cf6, #a855f7' : 
                          processingProgress < 50 ? '#a855f7, #ec4899' : 
                          processingProgress < 75 ? '#ec4899, #f97316' : 
                          '#f97316, #10b981'})`,
                      boxShadow: `0 0 ${Math.min(processingProgress / 10, 8)}px rgba(139, 92, 246, 0.6)`
                    }}
                  >
                    <div 
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-30"
                      style={{ 
                        transform: 'translateX(-100%)',
                        animation: processingProgress > 0 ? 'shimmer 2s ease-in-out infinite' : 'none'
                      }}
                    />
                    
                    <div 
                      className="absolute inset-0 rounded-full opacity-50 animate-pulse"
                      style={{
                        background: `radial-gradient(ellipse at center, 
                          rgba(255, 255, 255, 0.4) 0%, 
                          transparent 70%)`
                      }}
                    />
                  </div>
                </div>
                
                {processingProgress > 5 && (
                  <div 
                    className="absolute top-0 h-3 w-1 bg-white rounded-full shadow-lg transform -translate-y-0.5 transition-all duration-700 ease-out animate-bounce-gentle"
                    style={{ 
                      left: `calc(${processingProgress}% - 2px)`,
                      boxShadow: '0 0 8px rgba(255, 255, 255, 0.8)'
                    }}
                  />
                )}
              </div>
            </div>
            
            {processingProgress === 100 && (
              <div className="mt-3 text-center animate-fadeInUp">
                <div className="inline-flex items-center gap-2 bg-gradient-to-r from-green-100 to-emerald-100 text-green-700 px-4 py-2 rounded-full border border-green-200 shadow-sm">
                  <span className="animate-bounce-gentle">🎉</span>
                  <span className="text-sm font-semibold">Processing Complete!</span>
                  <span className="animate-bounce-gentle">✨</span>
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* Process Button */}
        <div className={`${loading ? 'mt-3' : 'mt-4'} flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3 flex-shrink-0`}>
          <button
            onClick={processImage}
            disabled={loading || (!processingOptions.removeBg && !processingOptions.upscale)}
            className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 text-white px-4 py-2 rounded-lg hover:from-purple-700 hover:to-pink-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
          >
            {loading ? (
              <div className="flex items-center justify-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Processing... {processingProgress}%</span>
              </div>
            ) : (
              '✨ Process Image'
            )}
          </button>
        </div>
      </div>
    </div>
  )
}