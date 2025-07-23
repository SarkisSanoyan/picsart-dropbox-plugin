import axios from 'axios'
import { API_BASE_URL } from '../constants'
import { triggerOn409Error } from '../utils/immediateValidation'

// Type declaration for global store access
declare global {
  interface Window {
    useAppStore?: {
      getState: () => {
        setAccessToken: (token: string | null) => void
        clearAuth: () => void
      }
    }
  }
}

// Create axios instance with base configuration
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 300000,
  headers: {
    'Content-Type': 'application/json'
  }
})

// ✅ SIMPLIFIED: Request interceptor only adds auth headers (no refresh logic)
apiClient.interceptors.request.use(
  (config) => {
    // Get stored auth data
    const accessToken = localStorage.getItem('access_token')
    const userInfo = localStorage.getItem('user_info')
    
    // Add Authorization header if token exists
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`
    }
    
    // Add X-User-ID header if user info exists
    if (userInfo) {
      try {
        const user = JSON.parse(userInfo)
        if (user.userId) {
          config.headers['X-User-ID'] = user.userId
        }
      } catch (error) {
        console.warn('Failed to parse stored user info:', error)
      }
    }
    
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// ✅ SIMPLIFIED: Response interceptor only saves new tokens and handles account mismatch (no retry logic)
apiClient.interceptors.response.use(
  (response) => {
    // Save new tokens from server refresh
    const newToken = response.headers['x-new-access-token']
    if (newToken) {
      console.log('✅ Server refreshed token, updating storage')
      localStorage.setItem('access_token', newToken)
      
      // ✅ CRITICAL FIX: Update token expiration time
      // Server gives 4-hour tokens, subtract 5 minutes buffer
      const expirationTime = Date.now() + ((14400 - 300) * 1000) // 3:55 hours
      localStorage.setItem('token_expires_at', expirationTime.toString())
      
      console.log('🔄 Updated token expiration time:', new Date(expirationTime).toISOString())
      
      // Update the store if available
      if (window.useAppStore?.getState) {
        window.useAppStore.getState().setAccessToken(newToken)
      }
    }
    
    return response
  },
  (error) => {
    const status = error.response?.status
    const responseData = error.response?.data
    
    // ✅ KEPT: Account mismatch detection (important for security)
    const isAccountMismatch = (
      // 401 with shouldReauth flag
      (status === 401 && responseData?.shouldReauth) ||
      // 409 conflict - ALWAYS treat as account mismatch for cross-account access
      (status === 409) ||
      // 403 with account mismatch message
      (status === 403 && responseData?.error?.includes('mismatch')) ||
      // Any error with account mismatch in message
      (responseData?.error?.includes('Account mismatch')) ||
      (responseData?.message?.includes('mismatch')) ||
      // Dropbox specific errors
      (responseData?.error_summary?.includes('path/not_found')) ||
      (responseData?.error?.error_summary?.includes('path/not_found'))
    )
    
    if (isAccountMismatch) {
      console.log('🚨 [AXIOS INTERCEPTOR] Account mismatch detected (status:', status, '), forcing banner display')
      console.log('🚨 [AXIOS INTERCEPTOR] Response data:', responseData)
      console.log('🚨 [AXIOS INTERCEPTOR] This is likely cross-account access - triggering immediate banner')
      
      // Get account info from response if available
      const accountInfo = responseData || {}
      
      // Trigger BOTH events for maximum coverage
      window.dispatchEvent(new CustomEvent('accountMismatch', {
        detail: {
          accountEmail: accountInfo.accountEmail || 'Unknown account',
          accountName: accountInfo.accountName || 'Unknown name',
          accountId: accountInfo.accountId || 'Unknown ID',
          error: accountInfo.error || accountInfo.message || `Cross-account access detected (${status})`,
          statusCode: status,
          source: 'axios-interceptor'
        }
      }))
      
      // Also trigger account switch detection
      window.dispatchEvent(new CustomEvent('accountSwitchDetected', {
        detail: {
          source: 'axios-interceptor-409',
          statusCode: status,
          error: accountInfo.error || accountInfo.message || 'Account switch detected'
        }
      }))
      
      // Trigger immediate validation for 409 errors
      if (status === 409) {
        console.log('🚨 [AXIOS INTERCEPTOR] Triggering immediate account validation for 409 error')
        triggerOn409Error()
      }
    }
    
    // ✅ IMPROVED: Better error handling for refresh failures
    if (status === 401 && responseData?.shouldReauth) {
      console.log('🔄 [AXIOS INTERCEPTOR] Server-side refresh failed, clearing auth and redirecting to login')
      
      // Clear auth state
      if (window.useAppStore?.getState) {
        window.useAppStore.getState().clearAuth()
      }
      
      // Redirect to login after a short delay to allow state clearing
      setTimeout(() => {
        window.location.href = '/login'
      }, 100)
    }
    
    // ✅ SIMPLIFIED: No retry logic - just reject the error
    // Server-side middleware will handle token refresh automatically
    // If token is expired, user will get a clear 401 error
    return Promise.reject(error)
  }
)

export default apiClient 