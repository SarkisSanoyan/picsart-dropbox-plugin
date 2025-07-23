import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAppStore } from '../store'
import { authApi } from '../api/authApi'
import { 
  generateCodeVerifier, 
  generateCodeChallenge, 
  generateState, 
  storePKCEParams,
  retrievePKCEParams,
  clearPKCEParams,
  buildAuthorizationUrl 
} from '../utils/pkce'
import { DROPBOX_CLIENT_ID, DROPBOX_REDIRECT_URI } from '../constants'

export const useAuth = () => {
  const navigate = useNavigate()
  const oauthProcessedRef = useRef(false)
  
  const {
    isAuthenticated,
    userInfo,
    accessToken,
    isCheckingAuth,
    isLoggingIn,
    loginProgress,
    directFileId,
    setIsAuthenticated,
    setUserInfo,
    setAccessToken,
    setIsCheckingAuth,
    setIsLoggingIn,
    setLoginProgress,
    setStatus,
    setDirectFileId,
    setRecentlyReauthorized,
    setLastReauthorizationTime,
    clearAuth,
    clearAllUserData
  } = useAppStore()

  // === Initialization logic ===
  useEffect(() => {
    console.log('🚀 App initializing...')
    console.log('🔗 Current URL:', window.location.href)
    
    if (oauthProcessedRef.current) {
      console.log('⚠️ OAuth already processed, skipping duplicate initialization...')
      return
    }
    
    // Check for URL parameters 
    const urlParams = new URLSearchParams(window.location.search)
    console.log('📋 All URL parameters:', Object.fromEntries(urlParams.entries()))
    
    const fileId = urlParams.get('file_id') || 
                   urlParams.get('id') || 
                   urlParams.get('file') || 
                   urlParams.get('path') ||
                   urlParams.get('dropbox_file_id') ||
                   urlParams.get('link')
    
    const dropboxLink = urlParams.get('link') || urlParams.get('url') || urlParams.get('download_url')
    
    if (fileId || dropboxLink) {
      console.log('🔗 Direct file detected:', { fileId, dropboxLink })
      setDirectFileId(fileId || dropboxLink || 'unknown')
      
      // Clean URL parameters
      urlParams.delete('file_id')
      urlParams.delete('id')
      urlParams.delete('file')
      urlParams.delete('path')
      urlParams.delete('dropbox_file_id')
      urlParams.delete('link')
      urlParams.delete('url')
      urlParams.delete('download_url')
      const newUrl = window.location.pathname + (urlParams.toString() ? '?' + urlParams.toString() : '')
      window.history.replaceState({}, document.title, newUrl)
    }

    // Check for OAuth callback parameters
    const authCode = urlParams.get('code')
    const authState = urlParams.get('state')
    const authError = urlParams.get('error')
    const errorMessage = urlParams.get('message')

    if (authCode && authState && !oauthProcessedRef.current) {
      oauthProcessedRef.current = true
      handleOAuthCallback(authCode, authState)
    } else if (authError) {
      setStatus(`❌ Authentication failed: ${errorMessage || authError || 'Unknown error'}`)
      clearAuth()
      clearPKCEParams()
    } else {
      // Check existing stored credentials
      initializeFromStorage()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setDirectFileId, setStatus, clearAuth, setIsCheckingAuth])

  // Initialize from storage with better token validation
  const initializeFromStorage = async () => {
    const storedToken = localStorage.getItem('access_token')
    const storedUserId = localStorage.getItem('user_id')
    const storedUserInfo = localStorage.getItem('user_info')

    if (storedToken && storedUserId) {
      console.log('🔍 Found stored credentials, validating...')
      
      try {
        // Check if token is expired first
        if (authApi.isTokenExpiredOrExpiring()) {
          console.log('🔄 Stored token is expired/expiring, attempting refresh...')
          
          // ✅ FIX: Add timeout and retry logic for refresh
          let refreshResult: { accessToken: string; refreshToken?: string } | null = null
          let refreshAttempts = 0
          const maxAttempts = 3
          
          while (refreshAttempts < maxAttempts && !refreshResult) {
            refreshAttempts++
            console.log(`🔄 Refresh attempt ${refreshAttempts}/${maxAttempts}...`)
            
            try {
              // Add timeout to refresh call
              const refreshPromise = authApi.refreshToken()
              const timeoutPromise = new Promise<null>((_, reject) => 
                setTimeout(() => reject(new Error('Refresh timeout')), 10000)
              )
              
              const result = await Promise.race([refreshPromise, timeoutPromise])
              
              if (result && typeof result === 'object' && 'accessToken' in result) {
                refreshResult = result as { accessToken: string; refreshToken?: string }
                console.log('✅ Token refreshed successfully during initialization')
                break
              }
            } catch (refreshError) {
              console.log(`❌ Refresh attempt ${refreshAttempts} failed:`, refreshError)
              
              // If it's the last attempt and still failing, check if it's a network issue
              if (refreshAttempts === maxAttempts) {
                // Check if we can reach the server at all
                try {
                  const controller = new AbortController()
                  setTimeout(() => controller.abort(), 5000)
                  
                  const healthCheck = await fetch('/api/auth/status', { 
                    method: 'GET',
                    headers: { 'Authorization': `Bearer ${storedToken}` },
                    signal: controller.signal
                  })
                  
                  // If server is reachable but refresh failed, likely auth issue
                  if (healthCheck.ok) {
                    console.log('❌ Server reachable but refresh failed - likely auth issue')
                    break // Exit retry loop, will fall through to clearAuth
                  }
                } catch {
                  console.log('🌐 Server appears unreachable, keeping stored credentials for now')
                  
                  // Server is down - don't clear auth, just set limited state
                  if (storedUserInfo) {
                    const userInfo = JSON.parse(storedUserInfo)
                    setUserInfo(userInfo)
                    setIsAuthenticated(false) // Don't set authenticated until we can refresh
                    setStatus('⚠️ Connection issues - trying to restore session...')
                    setIsCheckingAuth(false)
                    return // Keep trying in background
                  }
                }
              } else {
                // Wait before retry
                await new Promise(resolve => setTimeout(resolve, 1000 * refreshAttempts))
              }
            }
          }
          
          if (refreshResult && refreshResult.accessToken && storedUserInfo) {
            const userInfo = JSON.parse(storedUserInfo)
            setAccessToken(refreshResult.accessToken)
            setUserInfo(userInfo)
            setIsAuthenticated(true)
            setStatus('✅ Authentication restored with refreshed token')
          } else {
            console.log('❌ All refresh attempts failed - clearing auth')
            clearAuth()
          }
        } else {
          // Token is still valid, just validate with server
          console.log('🔍 Token appears valid, checking with server...')
          
          try {
            const isValid = await authApi.validateToken(storedToken)
            
            if (isValid && storedUserInfo) {
              const userInfo = JSON.parse(storedUserInfo)
              setAccessToken(storedToken)
              setUserInfo(userInfo)
              setIsAuthenticated(true)
              setStatus('✅ Authentication restored from storage')
            } else {
              console.log('❌ Server validation failed - checking if server is reachable')
              
              // Check if it's a network issue vs auth issue
              try {
                const controller = new AbortController()
                setTimeout(() => controller.abort(), 3000)
                
                await fetch('/api/auth/status', { signal: controller.signal })
                console.log('🌐 Server is reachable, token likely invalid')
                clearAuth()
              } catch {
                console.log('🌐 Network issue detected, keeping stored credentials temporarily')
                
                if (storedUserInfo) {
                  const userInfo = JSON.parse(storedUserInfo)
                  setUserInfo(userInfo)
                  setIsAuthenticated(false)
                  setStatus('⚠️ Network issues - please check connection')
                }
              }
            }
          } catch (validationError) {
            console.log('❌ Token validation failed with error:', validationError)
            clearAuth()
          }
        }
      } catch (error) {
        console.error('❌ Error during initialization - checking if network related:', error)
        
        // ✅ FIX: Don't immediately clear auth for network errors
        if (error instanceof TypeError && error.message.includes('fetch')) {
          console.log('🌐 Network error detected during initialization - keeping credentials')
          if (storedUserInfo) {
            const userInfo = JSON.parse(storedUserInfo)
            setUserInfo(userInfo)
            setIsAuthenticated(false)
            setStatus('⚠️ Connection issues - please check your network')
          }
        } else {
          console.log('❌ Non-network error during initialization - clearing auth')
          clearAuth()
        }
      }
    } else {
      console.log('🔍 No stored credentials found')
    }
    
    setIsCheckingAuth(false)
  }

  const handleLogin = async () => {
    try {
      console.log('🔐 [LOGIN] Starting authentication process...')
      
      // Start loading state
      setIsLoggingIn(true)
      setLoginProgress('🔐 Preparing authentication...')
      
      // Preserve direct file ID for after OAuth
      if (directFileId) {
        console.log('🔗 Preserving direct file ID for after OAuth:', directFileId)
        localStorage.setItem('direct_file_id_oauth', directFileId)
        setLoginProgress('🔗 Preserving selected image...')
        await new Promise(resolve => setTimeout(resolve, 500)) // Show message briefly
      }
      
      // Generate PKCE parameters
      setLoginProgress('🔐 Generating security parameters...')
      const codeVerifier = generateCodeVerifier()
      const codeChallenge = await generateCodeChallenge(codeVerifier)
      const state = generateState()
      
      // Store PKCE parameters
      storePKCEParams(codeVerifier, state)
      
      // Build authorization URL
      setLoginProgress('🔗 Redirecting to Dropbox...')
      const authUrl = buildAuthorizationUrl(DROPBOX_CLIENT_ID, DROPBOX_REDIRECT_URI, codeChallenge, state)
      
      console.log('🔗 [LOGIN] Redirecting to:', authUrl)
      
      // Redirect user to Dropbox for authentication
      window.location.href = authUrl
      
    } catch (error) {
      console.error('❌ [LOGIN] Error starting authentication:', error)
      setLoginProgress('❌ Failed to start authentication')
      setStatus(`❌ Login failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      setIsLoggingIn(false)
    }
  }

  const handleOAuthCallback = async (code: string, state: string) => {
    try {
      console.log('🔄 Processing OAuth callback...')
      setLoginProgress('🔄 Processing authentication...')
      
      // Retrieve and validate PKCE parameters
      const pkceParams = retrievePKCEParams()
      if (!pkceParams) {
        throw new Error('PKCE parameters not found')
      }
      
      if (state !== pkceParams.state) {
        throw new Error('Invalid state parameter')
      }
      
      // Exchange code for tokens using PKCE
      setLoginProgress('🔄 Exchanging code for tokens...')
      const { user, accessToken, refreshToken } = await authApi.exchangeToken(code, state, pkceParams.codeVerifier)
      
      // Store tokens and user info with expiration tracking
      setLoginProgress('💾 Storing authentication data...')
      
      // Use the new method to store token with expiration (4 hours minus 5 minutes buffer)
      authApi.storeTokenWithExpiration(accessToken, 14400)
      localStorage.setItem('user_id', user.userId)
      localStorage.setItem('user_info', JSON.stringify(user))
      
      if (refreshToken) {
        localStorage.setItem('refresh_token', refreshToken)
      }
      
      setAccessToken(accessToken)
      setUserInfo(user)
      setIsAuthenticated(true)  // ← SET AUTHENTICATED STATE TRUE
      setLoginProgress('✅ Authentication successful!')
      setStatus('✅ Authentication successful')
      
      // Mark successful re-authorization to start grace period
      console.log('🛡️ [AUTH] Marking successful re-authorization, starting grace period')
      const now = Date.now()
      setRecentlyReauthorized(true)
      setLastReauthorizationTime(now)
      
      // Also store in localStorage for persistence across page reloads
      localStorage.setItem('recentlyReauthorized', 'true')
      localStorage.setItem('lastReauthorizationTime', now.toString())
      
      // Handle direct file flows
      setLoginProgress('🧭 Determining next steps...')
      const pendingFileId = localStorage.getItem('pending_file_id')
      const oauthDirectFileId = localStorage.getItem('direct_file_id_oauth')
      
      if (pendingFileId) {
        console.log('🔗 OAuth completed after account switch fix - loading pending file')
        setLoginProgress('🔗 Loading your selected image...')
        localStorage.removeItem('pending_file_id')
        
        // Set the direct file ID in the store for the processing page
        setDirectFileId(pendingFileId)
        
        navigate(`/process/${pendingFileId}`)
      } else if (oauthDirectFileId) {
        console.log('🔄 OAuth completed with direct file flow')
        setLoginProgress('🔗 Processing your selected image...')
        setDirectFileId(oauthDirectFileId)
        localStorage.removeItem('direct_file_id_oauth')
        navigate(`/process/${oauthDirectFileId}`)
      } else {
        console.log('✅ OAuth completed - normal flow')
        setLoginProgress('📋 Redirecting to image selection...')
        navigate('/select')
      }
      
      clearPKCEParams()
      
      // Clear URL parameters
      window.history.replaceState({}, document.title, window.location.pathname)
      
    } catch (error) {
      console.error('❌ OAuth callback failed:', error)
      setLoginProgress('❌ Authentication failed')
      setStatus(`❌ Authentication failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      clearAuth()
      clearPKCEParams()
      navigate('/login')
    } finally {
      setIsCheckingAuth(false)
      setIsLoggingIn(false)
      // Clear login progress after a delay to show final message
      setTimeout(() => {
        setLoginProgress('')
      }, 2000)
    }
  }

  const logout = () => {
    clearAllUserData()
    navigate('/login')
  }

  return {
    isAuthenticated,
    userInfo,
    accessToken,
    isCheckingAuth,
    isLoggingIn,
    loginProgress,
    handleLogin,
    logout,
    handleOAuthCallback
  }
}