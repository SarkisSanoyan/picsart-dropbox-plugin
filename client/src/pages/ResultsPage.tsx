import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useImageProcessing } from '../hooks/useImageProcessing'
import { useAppStore } from '../store'

export const ResultsPage: React.FC = () => {
  const navigate = useNavigate()
  const { processingResult } = useImageProcessing()
  const { 
    selectedImageThumbnail, 
    thumbnailUrls,
    setCurrentStep,
    setSelectedImage,
    setDirectFileId,
    setProcessingResult,
    setSelectedImageThumbnail 
  } = useAppStore()

  if (!processingResult) {
    return (
      <div className="p-4 text-center">
        <p className="text-gray-600">No results to display. Please process an image first.</p>
        <button
          onClick={() => navigate('/select')}
          className="mt-4 bg-purple-600 text-white px-4 py-2 rounded-lg"
        >
          ← Back to Selection
        </button>
      </div>
    )
  }

  const handleProcessAnother = () => {
    console.log('🔄 [RESULTS] Processing another image - clearing current state and going to selection')
    
    // Clear current processing state and thumbnail
    setSelectedImage(null)
    setProcessingResult(null)
    setSelectedImageThumbnail(null) 
    setCurrentStep('selection')
    setDirectFileId(null)
    // Navigate to selection page
    navigate('/select')
  }

  return (
    <div className="space-y-3 sm:space-y-4 p-1 sm:p-2">
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-2 sm:p-3 md:p-6 border border-green-200">
        <h3 className="text-base sm:text-lg font-semibold text-green-800 mb-3 sm:mb-4 md:mb-6 text-center">🎉 Processing Complete!</h3>
        {processingResult && (
          <div className="flex items-center justify-center py-2 sm:py-4 md:py-8">
            <div className="w-full max-w-sm sm:max-w-3xl md:max-w-5xl px-1 sm:px-0">
              <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-4 md:gap-6 lg:gap-8">
                
                {/* Original image preview */}
                {selectedImageThumbnail && (
                  <div className="group bg-white rounded-lg p-2 sm:p-3 md:p-5 border border-purple-200 w-full max-w-40 sm:max-w-64 md:w-72 flex-shrink-0 shadow-md hover:shadow-2xl transition-all duration-300 transform hover:scale-105 hover:-translate-y-2 cursor-pointer relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-purple-600/10 to-pink-600/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-lg"></div>
                    
                    <h4 className="relative font-medium text-purple-800 mb-2 sm:mb-3 md:mb-4 text-xs sm:text-sm text-center transition-all duration-300 group-hover:text-purple-900 group-hover:font-semibold">📷 Original</h4>
                    <div className="relative w-full rounded-lg mb-2 sm:mb-3 md:mb-4 flex items-center justify-center overflow-hidden transition-all duration-300 h-16 sm:h-20 md:h-24 lg:h-28">
                      <img
                        src={selectedImageThumbnail}
                        alt="Original"
                        className="max-w-full max-h-full object-contain rounded-lg transition-all duration-300 group-hover:scale-110 group-hover:brightness-110"
                      />
                    </div>
                    <p className="relative text-xs text-gray-600 text-center transition-all duration-300 group-hover:text-purple-600 group-hover:font-medium">Original image</p>
                    
                    <div className="absolute inset-0 rounded-lg border-2 border-transparent group-hover:border-purple-400 transition-all duration-300"></div>
                  </div>
                )}
                
                {/* Background removed result */}
                {processingResult.results.backgroundRemoved && (
                  <div className="group bg-white rounded-lg p-2 sm:p-3 md:p-5 border border-purple-200 w-full max-w-40 sm:max-w-64 md:w-72 flex-shrink-0 shadow-md hover:shadow-2xl transition-all duration-300 transform hover:scale-105 hover:-translate-y-2 cursor-pointer relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-green-600/10 to-emerald-600/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-lg"></div>
                    
                    <h4 className="relative font-medium text-purple-800 mb-2 sm:mb-3 md:mb-4 text-xs sm:text-sm text-center transition-all duration-300 group-hover:text-green-800 group-hover:font-semibold">🎨 Background Removed</h4>
                    <div className="relative w-full rounded-lg mb-2 sm:mb-3 md:mb-4 flex items-center justify-center overflow-hidden transition-all duration-300 h-16 sm:h-20 md:h-24 lg:h-28">
                      {thumbnailUrls[processingResult.results.backgroundRemoved] ? (
                        <img
                          src={thumbnailUrls[processingResult.results.backgroundRemoved]}
                          alt="Background Removed"
                          className="max-w-full max-h-full object-contain rounded-lg transition-all duration-300 group-hover:scale-110 group-hover:brightness-110"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-center">
                          <span className="text-gray-400 transition-all duration-300 group-hover:text-green-400 group-hover:scale-110 animate-pulse text-2xl">🎨</span>
                          <span className="text-xs text-gray-500 mt-1">Loading preview...</span>
                        </div>
                      )}
                    </div>
                    <p className="relative text-xs text-gray-600 text-center transition-all duration-300 group-hover:text-green-600 group-hover:font-medium overflow-hidden" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: '1.2' }}>
                      {processingResult.results.backgroundRemoved}
                    </p>
                    
                    <div className="absolute inset-0 rounded-lg border-2 border-transparent group-hover:border-green-400 transition-all duration-300"></div>
                  </div>
                )}
                
                {/* Upscaled result */}
                {processingResult.results.upscaled && (
                  <div className="group bg-white rounded-lg p-2 sm:p-3 md:p-5 border border-purple-200 w-full max-w-40 sm:max-w-64 md:w-72 flex-shrink-0 shadow-md hover:shadow-2xl transition-all duration-300 transform hover:scale-105 hover:-translate-y-2 cursor-pointer relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-600/10 to-cyan-600/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-lg"></div>
                    
                    <h4 className="relative font-medium text-purple-800 mb-2 sm:mb-3 md:mb-4 text-xs sm:text-sm text-center transition-all duration-300 group-hover:text-blue-800 group-hover:font-semibold">🔍 Upscaled</h4>
                    <div className="relative w-full rounded-lg mb-2 sm:mb-3 md:mb-4 flex items-center justify-center overflow-hidden transition-all duration-300 h-16 sm:h-20 md:h-24 lg:h-28">
                      {thumbnailUrls[processingResult.results.upscaled] ? (
                        <img
                          src={thumbnailUrls[processingResult.results.upscaled]}
                          alt="Upscaled"
                          className="max-w-full max-h-full object-contain rounded-lg transition-all duration-300 group-hover:scale-110 group-hover:brightness-110"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-center">
                          <span className="text-gray-400 transition-all duration-300 group-hover:text-blue-400 group-hover:scale-110 animate-pulse text-2xl">🔍</span>
                          <span className="text-xs text-gray-500 mt-1">Loading preview...</span>
                        </div>
                      )}
                    </div>
                    <p className="relative text-xs text-gray-600 text-center transition-all duration-300 group-hover:text-blue-600 group-hover:font-medium overflow-hidden" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', lineHeight: '1.2' }}>
                      {processingResult.results.upscaled}
                    </p>
                    
                    <div className="absolute inset-0 rounded-lg border-2 border-transparent group-hover:border-blue-400 transition-all duration-300"></div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        
        <div className="mt-4 sm:mt-6 md:mt-8 flex justify-center px-2 sm:px-0">
          <button
            onClick={handleProcessAnother}
            className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-3 sm:px-4 md:px-6 py-2 sm:py-2 md:py-3 rounded-lg hover:from-purple-700 hover:to-pink-700 transition-colors text-xs sm:text-sm font-medium shadow-md hover:shadow-lg w-full sm:w-auto max-w-xs sm:max-w-none"
          >
            🔄 Process Another Image
          </button>
        </div>
      </div>
    </div>
  )
}

