import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

interface AuthGuardProps {
  children: React.ReactNode
}

export const AuthGuard: React.FC<AuthGuardProps> = ({ children }) => {
  const { isAuthenticated, isCheckingAuth } = useAuth()
  const location = useLocation()

  if (isCheckingAuth) {
    return (
      <div className="h-screen bg-gradient-to-br from-purple-600 to-pink-600 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-2xl p-6 text-center">
          <div className="animate-spin text-4xl mb-4">🔄</div>
          <h1 className="text-xl font-bold text-gray-800 mb-2">Checking Authentication</h1>
          <p className="text-gray-600">Please wait...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  return <>{children}</>
}