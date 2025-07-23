import React from 'react'
import { useAuth } from '../hooks/useAuth'
import { useAppStore } from '../store'

export const LoginPage: React.FC = () => {
  const { handleLogin, isLoggingIn, loginProgress } = useAuth()
  const { directFileId } = useAppStore()

  return (
    <div className="h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-purple-800 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full text-center">
        <h1 className="text-2xl font-bold text-gray-800 mb-2 animate-fadeInUp">🎨 Picsart Dropbox Plugin</h1>
        
        {/* EXACT COPY of your direct file indicator */}
        {directFileId ? (
          <div className="mb-4 animate-slideInLeft">
            <p className="text-gray-600 mb-2">Ready to process your selected image!</p>
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-3 border border-blue-200 animate-bounce-gentle">
              <div className="flex items-center justify-center space-x-2 text-blue-700">
                <span className="text-lg">🔗</span>
                <span className="text-sm font-medium">Image selected from Dropbox</span>
              </div>
              <p className="text-xs text-blue-600 mt-1">
                Connect with Dropbox to start processing
              </p>
            </div>
          </div>
        ) : (
          <p className="text-gray-600 mb-4 animate-fadeInUp animation-delay-200">Transform your images with AI-powered tools</p>
        )}
        
        {/* EXACT COPY of your feature list */}
        <div className="space-y-3 mb-6">
          <div className="flex items-center justify-center space-x-3 text-gray-700 animate-fadeInUp animation-delay-300">
            <span>🎨</span>
            <span className="text-sm">Remove backgrounds instantly</span>
          </div>
          <div className="flex items-center justify-center space-x-3 text-gray-700 animate-fadeInUp animation-delay-400">
            <span>🔍</span>
            <span className="text-sm">Upscale images up to 8x</span>
          </div>
          <div className="flex items-center justify-center space-x-3 text-gray-700 animate-fadeInUp animation-delay-500">
            <span>☁️</span>
            <span className="text-sm">Direct Dropbox integration</span>
          </div>
        </div>
        
        {/* Login Button with Loading Animation */}
        <button
          onClick={handleLogin}
          disabled={isLoggingIn}
          className={`w-full py-3 px-4 rounded-lg font-semibold transition-all duration-300 shadow-lg text-sm animate-fadeInUp animation-delay-600 ${
            isLoggingIn 
              ? 'bg-gradient-to-r from-purple-400 to-pink-400 cursor-not-allowed' 
              : 'bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 transform hover:scale-105 hover:shadow-xl'
          } text-white`}
        >
          {isLoggingIn ? (
            <span className="flex items-center justify-center gap-3">
              <div className="animate-spin text-lg">🔄</div>
              <span className="animate-pulse">Connecting...</span>
            </span>
          ) : (
            '🔐 Connect with Dropbox'
          )}
        </button>
        
        {/* Login Progress Display */}
        {isLoggingIn && loginProgress && (
          <div className="mt-4 p-3 bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg animate-slideInUp">
            <div className="flex items-center justify-center gap-2">
              <div className="animate-spin text-sm">⚡</div>
              <span className="text-purple-700 text-sm font-medium animate-pulse">
                {loginProgress}
              </span>
            </div>
            {/* Animated Progress Bar */}
            <div className="mt-2 w-full bg-purple-200 rounded-full h-1">
              <div className="bg-gradient-to-r from-purple-600 to-pink-600 h-1 rounded-full animate-pulse" style={{
                width: '100%',
                animation: 'progress 3s ease-in-out infinite'
              }}></div>
            </div>
          </div>
        )}
      {/*         
        {status && (
          <div className="mt-3 p-2 bg-purple-50 border border-purple-200 rounded-lg text-xs text-purple-700">
            {status}
          </div>
        )} */}
      </div>
    </div>
  )
}