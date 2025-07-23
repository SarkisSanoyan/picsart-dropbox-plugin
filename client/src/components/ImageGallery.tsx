import React from 'react'
import type { ImageFile } from '../types'

interface ImageGalleryProps {
  images: ImageFile[]
  thumbnailUrls: Record<string, string>
  loading?: boolean
  onImageSelect: (image: ImageFile) => void
  onRefresh: () => void
}

export const ImageGallery: React.FC<ImageGalleryProps> = ({
  images,
  thumbnailUrls,
  loading = false,
  onImageSelect,
  onRefresh
}) => {
  return (
    <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-4 border border-purple-200">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-semibold text-purple-800">📁 Browse Your Dropbox</h3>
        <button
          onClick={onRefresh}
          disabled={loading}
          className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-3 py-2 rounded-lg hover:from-purple-700 hover:to-pink-700 transition-all duration-300 transform hover:scale-105 hover:shadow-lg disabled:opacity-50 text-sm animate-fadeInUp animation-delay-300"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="animate-spin">🔄</span>
              <span className="animate-pulse">Loading...</span>
            </span>
          ) : (
            <span className="flex items-center gap-1">
              <span>⚡</span>
              <span>Load</span>
            </span>
          )}
        </button>
      </div>
      
      {/* Image grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2 sm:gap-3">
        {(images || []).map((image, index) => (
          <div
            key={image.id}
            onClick={() => onImageSelect(image)}
            className="group p-1 sm:p-2 cursor-pointer hover:shadow-xl transition-all duration-300 transform hover:scale-105 hover:-translate-y-1 bg-white border border-purple-200 rounded-lg hover:border-purple-400 hover:bg-gradient-to-br hover:from-purple-50 hover:to-pink-50 animate-fadeInUp relative overflow-hidden"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-purple-600/10 to-pink-600/10 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-lg"></div>
            
            <div 
              className="relative mb-1 sm:mb-2 flex items-center justify-center overflow-hidden rounded transition-all duration-300 group-hover:shadow-inner" 
              style={{ width: '100%', height: '80px', maxWidth: '150px', margin: '0 auto' }}
            >
              {thumbnailUrls[image.id] ? (
                <img
                  src={thumbnailUrls[image.id]}
                  alt={image.name}
                  className="max-w-full max-h-full object-contain transition-all duration-300 group-hover:scale-110 group-hover:brightness-110"
                  style={{ maxWidth: '100%', maxHeight: '100%' }}
                />
              ) : (
                <div className="image-loading rounded transition-all duration-300 group-hover:scale-110" style={{ width: '100%', height: '100%' }}>
                  <span className="text-gray-400 text-sm animate-pulse group-hover:text-purple-400">🖼️</span>
                </div>
              )}
            </div>
            <p className="relative text-xs sm:text-xs font-medium text-gray-700 truncate text-center transition-all duration-300 group-hover:text-purple-600 group-hover:font-semibold leading-tight">{image.name}</p>
            
            {/* Animated border effect */}
            <div className="absolute inset-0 rounded-lg border-2 border-transparent group-hover:border-purple-400 transition-all duration-300"></div>
          </div>
        ))}
      </div>
      
      {/* Empty state */}
      {(images || []).length === 0 && !loading && (
        <div className="text-center py-6 animate-fadeIn">
          <div className="animate-bounce-gentle text-6xl mb-4">📁</div>
          <p className="text-purple-600 mb-2 animate-fadeInUp">
            📁 No images found in your Dropbox root folder
          </p>
          <p className="text-sm text-purple-500 animate-fadeInUp animation-delay-200">
            Click "Load" to browse your files, or upload new images above
          </p>
        </div>
      )}
    </div>
  )
}