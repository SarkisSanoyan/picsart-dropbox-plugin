import type { User } from '../types'
import { apiClient } from './axiosConfig'

export const authApi = {
  async exchangeToken(code: string, state: string, codeVerifier: string): Promise<{ user: User; accessToken: string; refreshToken?: string }> {
    const response = await apiClient.post('/auth/exchange-token', {
      code,
      state,
      codeVerifier
    })
    
    if (!response.data.success) {
      throw new Error(response.data.message || 'Token exchange failed')
    }
    
    return {
      user: response.data.user,
      accessToken: response.data.accessToken,
      refreshToken: response.data.refreshToken
    }
  },

  async validateToken(token: string): Promise<boolean> {
    try {
      const response = await apiClient.get('/auth/status', {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 5000
      })
      return response.status === 200
    } catch {
      return false
    }
  },

  async refreshToken(): Promise<{ accessToken: string; refreshToken?: string } | null> {
    try {
      const refreshToken = localStorage.getItem('refresh_token')
      const userId = localStorage.getItem('user_id')
      
      if (!refreshToken || !userId) {
        console.log('❌ No refresh token or user ID available')
        return null
      }

      console.log('🔄 Attempting to refresh access token...')
      
      // ✅ FIX: Use fetch directly to avoid circular dependency with axios interceptors
      const response = await fetch('/api/auth/refresh-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId })
      })
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      const data = await response.json()
      
      if (data.success) {
        console.log('✅ Token refreshed successfully')
        
        // Server returns accessToken and refreshToken
        const newAccessToken = data.accessToken
        const newRefreshToken = data.refreshToken
        const expiresIn = data.expiresIn || 14400 // Default 4 hours in seconds
        
        // Calculate expiration time (subtract 5 minutes as buffer)
        const expirationTime = Date.now() + ((expiresIn - 300) * 1000)
        
        localStorage.setItem('access_token', newAccessToken)
        localStorage.setItem('token_expires_at', expirationTime.toString())
        
        if (newRefreshToken) {
          localStorage.setItem('refresh_token', newRefreshToken)
        }
        
        return {
          accessToken: newAccessToken,
          refreshToken: newRefreshToken
        }
      }
      
      console.log('❌ Token refresh failed:', data.message)
      return null
    } catch (error) {
      console.error('❌ Error refreshing token:', error)
      return null
    }
  },

  // Check if the current token is expired or about to expire (within 5 minutes)
  isTokenExpiredOrExpiring(): boolean {
    const tokenExpiresAt = localStorage.getItem('token_expires_at')
    if (!tokenExpiresAt) {
      return false // If no expiration time stored, assume it's valid
    }
    
    const expirationTime = parseInt(tokenExpiresAt, 10)
    const now = Date.now()
    const fiveMinutesFromNow = now + (5 * 60 * 1000) // 5 minutes buffer
    
    return expirationTime <= fiveMinutesFromNow
  },

  // Store token with expiration time
  storeTokenWithExpiration(accessToken: string, expiresIn: number = 14400): void {
    // Subtract 5 minutes as safety buffer
    const expirationTime = Date.now() + ((expiresIn - 300) * 1000)
    
    localStorage.setItem('access_token', accessToken)
    localStorage.setItem('token_expires_at', expirationTime.toString())
  }
}