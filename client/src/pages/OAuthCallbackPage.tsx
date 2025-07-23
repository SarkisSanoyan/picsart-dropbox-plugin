import React, { useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export const OAuthCallbackPage: React.FC = () => {
  const [searchParams] = useSearchParams()
  const { handleOAuthCallback, isLoggingIn, loginProgress } = useAuth()

  useEffect(() => {
    const code = searchParams.get('code') // ← EXTRACT AUTHORIZATION CODE
    const state = searchParams.get('state') // ← EXTRACT STATE PARAMETER
    const error = searchParams.get('error') // ← EXTRACT ERROR MESSAGE

    if (error) {
      console.error('OAuth error:', error)
      // Handle error - redirect to login
      window.location.href = '/login'
      return
    }

    if (code && state) {
      handleOAuthCallback(code, state)
    } else {
      // No valid parameters, redirect to login
      window.location.href = '/login'
    }
  }, [searchParams, handleOAuthCallback])

  return (
    <div className="h-screen bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center">
        {/* Main Loading Animation */}
        <div className="mb-6">
          <div className="animate-spin text-5xl mb-4">🔄</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2 animate-fadeInUp">
            Processing Authentication
          </h1>
          <p className="text-gray-600 animate-fadeInUp animation-delay-200">
            Please wait while we complete your login...
          </p>
        </div>
        
        {/* Enhanced Progress Display */}
        {isLoggingIn && loginProgress && (
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 border border-purple-200 rounded-lg p-4 animate-slideInUp">
            <div className="flex items-center justify-center gap-3 mb-3">
              <div className="animate-spin text-xl">⚡</div>
              <span className="text-purple-700 font-medium animate-pulse">
                {loginProgress}
              </span>
            </div>
            
            {/* Multi-stage Progress Bar */}
            <div className="space-y-2">
              <div className="w-full bg-purple-200 rounded-full h-2">
                <div className="bg-gradient-to-r from-purple-600 to-pink-600 h-2 rounded-full animate-pulse" 
                     style={{
                       width: '100%',
                       animation: 'progressWave 1s ease-in-out infinite'
                     }}>
                </div>
              </div>
              <div className="flex justify-between text-xs text-purple-600">
                <span>🔐 Securing</span>
                <span>🔄 Processing</span>
                <span>✅ Completing</span>
              </div>
            </div>
          </div>
        )}
        
        {/* Fallback progress when no specific progress */}
        {!loginProgress && (
          <div className="bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-200 rounded-lg p-4 animate-bounce-gentle">
            <div className="flex items-center justify-center gap-2 text-blue-700">
              <span className="animate-pulse text-lg">🌟</span>
              <span className="text-sm font-medium">Finalizing your access...</span>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}