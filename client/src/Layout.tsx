import React, { useEffect } from 'react'
import { Outlet, useLocation } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { useAccountValidation } from './hooks/useAccountValidation'
import { useAppStore } from './store'
import { initializeAccountSwitchDetection, destroyAccountSwitchDetection } from './utils/accountSwitchDetection'
import { triggerComprehensiveAccountCheck } from './utils/comprehensiveAccountCheck'

export const Layout: React.FC = () => {
  const location = useLocation()
  const { userInfo, logout } = useAuth()
  useAccountValidation() // Automatic account validation and mismatch detection
  const {
    status,
    showAccountSwitchBanner,
    showAccountMismatchBanner,
    accountMismatchInfo,
    fixingAccountSwitch,
    fixCountdown,
    isRefreshing,
    setShowAccountSwitchBanner,
    setShowAccountMismatchBanner,
    setAccountMismatchInfo,
    setImages,
    setSelectedImage,
    setSelectedImageThumbnail,
    setProcessingResult,
    setStatus,
    setRecentlyReauthorized,
    setLastReauthorizationTime,
    clearAllUserData,
    directFileId,
    selectedImage,
    setSavedIntent
  } = useAppStore()

  // Listen for account mismatch events from axios interceptor and other sources
  useEffect(() => {
    const handleAccountMismatch = (event: CustomEvent) => {
      console.log('🚨 [LAYOUT] Account mismatch event received:', event.detail)
      
      const { accountEmail, accountId, error, source } = event.detail
      
      // CRITICAL: Save user's original intent before clearing data
      const currentRoute = location.pathname
      const currentFileId = directFileId || (location.pathname.includes('/process/') ? location.pathname.split('/process/')[1] : null)
      const hasSelectedImage = selectedImage && selectedImage.id !== 'unknown'
      
      if (currentFileId || hasSelectedImage) {
        const fileIdToSave = currentFileId || selectedImage?.id
        console.log('💾 [LAYOUT] Saving original user intent for post-reauth restoration')
        console.log('💾 [LAYOUT] Context:', { currentRoute, fileIdToSave, hasSelectedImage, directFileId })
        
        setSavedIntent({
          route: currentRoute,
          fileId: fileIdToSave,
          action: 'processing'
        })
        
        // ALSO preserve in localStorage for the OAuth callback flow
        if (fileIdToSave) {
          localStorage.setItem('pending_file_id', fileIdToSave)
          console.log('💾 [LAYOUT] Also saved file ID to pending_file_id for OAuth callback:', fileIdToSave)
        }
        
        console.log('💾 [LAYOUT] Saved intent:', { route: currentRoute, fileId: fileIdToSave, action: 'processing' })
      } else {
        console.log('💾 [LAYOUT] No specific intent to save, user will go to selection')
        setSavedIntent({ action: 'selection' })
      }
      
      // CRITICAL: Clear previous user's data immediately to prevent confusion
      console.log('🧹 [LAYOUT] Clearing previous user data due to account mismatch')
      setImages([])
      setSelectedImage(null)
      setSelectedImageThumbnail(null)
      setProcessingResult(null)
      setStatus('🚨 Account mismatch detected - previous data cleared')
      
      // Update store with account mismatch info
      setAccountMismatchInfo({
        currentAccount: accountEmail || accountId || 'Unknown Account',
        storedAccount: userInfo?.email || 'unknown',
        error: error || 'Account mismatch detected'
      })
      
      // Force show the account mismatch banner
      console.log('🚨 [LAYOUT] FORCING account mismatch banner to show from source:', source)
      setShowAccountMismatchBanner(true)
    }

    const handleAccountSwitchDetected = (event: CustomEvent) => {
      console.log('🚨 [LAYOUT] Account switch detected event:', event.detail)
      
      const { source } = event.detail
      
      // CRITICAL: Clear previous user's data immediately to prevent confusion
      console.log('🧹 [LAYOUT] Clearing previous user data due to account switch')
      setImages([])
      setSelectedImage(null)
      setSelectedImageThumbnail(null)
      setProcessingResult(null)
      setStatus('🚨 Account switch detected - previous data cleared')
      
      // Show account switch banner  
      console.log('🚨 [LAYOUT] FORCING account switch banner to show from source:', source)
      setShowAccountSwitchBanner(true)
    }

    // Add event listeners for multiple events
    window.addEventListener('accountMismatch', handleAccountMismatch as EventListener)
    window.addEventListener('accountSwitchDetected', handleAccountSwitchDetected as EventListener)
    
    // Cleanup
    return () => {
      window.removeEventListener('accountMismatch', handleAccountMismatch as EventListener)
      window.removeEventListener('accountSwitchDetected', handleAccountSwitchDetected as EventListener)
    }
  }, [userInfo, setAccountMismatchInfo, setShowAccountMismatchBanner, setShowAccountSwitchBanner, setImages, setSelectedImage, setSelectedImageThumbnail, setProcessingResult, setStatus, directFileId, selectedImage, setSavedIntent, location.pathname])

  // Initialize account switch detection and comprehensive validation
  useEffect(() => {
    console.log('🔧 [LAYOUT] Initializing account switch detection...')
    initializeAccountSwitchDetection()
    
    // Run comprehensive account check when authenticated (STARTUP - only once)
    // Don't run if user is clearing state for navigation
    if (userInfo && userInfo.userId && !showAccountMismatchBanner && !showAccountSwitchBanner) {
      console.log('🔧 [LAYOUT] Scheduling STARTUP comprehensive account check...')
      setTimeout(() => {
        console.log('🔧 [LAYOUT] Running startup comprehensive account check...')
        triggerComprehensiveAccountCheck()
      }, 3000) // Reduced delay since we're only running once
    }
    
    // Listen for account switch events
    const handleAccountSwitchDetected = (event: CustomEvent) => {
      console.log('🚨 [LAYOUT] Account switch detected via event:', event.detail)
      const { source, errorCount } = event.detail
      
      console.log(`🚨 [LAYOUT] FORCING account switch banner from ${source} (errors: ${errorCount})`)
      setShowAccountSwitchBanner(true)
    }
    
    window.addEventListener('accountSwitchDetected', handleAccountSwitchDetected as EventListener)
    
    return () => {
      console.log('🔧 [LAYOUT] Cleaning up account switch detection...')
      window.removeEventListener('accountSwitchDetected', handleAccountSwitchDetected as EventListener)
      destroyAccountSwitchDetection()
    }
  }, [setShowAccountSwitchBanner, userInfo, showAccountMismatchBanner, showAccountSwitchBanner])

  // Enhanced fix account switch with proper cleanup
  const handleFixAccountSwitchWithCountdown = async () => {
    console.log('🔧 [FIX] Starting account switch fix...')
    
    // Mark that user is going through re-authorization process
    setRecentlyReauthorized(true)
    setLastReauthorizationTime(Date.now())
    
    // Clear ALL stored data to ensure fresh authentication
    localStorage.clear()
    sessionStorage.clear()
    
    // Clear Zustand store
    clearAllUserData()
    
    // Clear any cached Dropbox data
    if ('caches' in window) {
      const cacheNames = await caches.keys()
      await Promise.all(cacheNames.map(name => caches.delete(name)))
    }
    
    console.log('🔧 [FIX] All data cleared, forcing page reload for fresh auth...')
    setTimeout(() => {
      window.location.href = '/login'
    }, 1000)
  }

  // Enhanced fix account mismatch with thorough cleanup
  const handleFixAccountMismatch = async () => {
    console.log('🔧 [FIX] User clicked Fix button - performing thorough cleanup...')
    
    // Hide banner immediately
    setShowAccountMismatchBanner(false)
    setShowAccountSwitchBanner(false)
    
    // Mark that user is going through re-authorization process
    setRecentlyReauthorized(true)
    setLastReauthorizationTime(Date.now())
    
    // CRITICAL: Save reauthorization flags to localStorage so they survive page reload
    localStorage.setItem('recentlyReauthorized', 'true')
    localStorage.setItem('lastReauthorizationTime', Date.now().toString())
    
    // CRITICAL: Preserve the current file ID for OAuth callback if user has a selected image
    const currentFileId = directFileId || (location.pathname.includes('/process/') ? location.pathname.split('/process/')[1] : null)
    if (currentFileId || (selectedImage && selectedImage.id !== 'unknown')) {
      const fileIdToPreserve = currentFileId || selectedImage?.id
      console.log('🔗 [FIX] Preserving file ID for post-reauth redirect:', fileIdToPreserve)
      localStorage.setItem('pending_file_id', fileIdToPreserve!)
    }
    
    // Clear ALL authentication data but preserve savedIntent and pending_file_id
    console.log('🔧 [FIX] Clearing authentication data but preserving saved intent and file ID...')
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token') 
    localStorage.removeItem('user_id')
    localStorage.removeItem('user_info')
    localStorage.removeItem('token_expires_at')
    localStorage.removeItem('direct_file_id_oauth')
    localStorage.removeItem('selected_image_oauth')
    // DON'T remove pending_file_id - OAuth callback needs it
    
    // Clear session storage too
    sessionStorage.clear()
    
    // Clear only user data, NOT savedIntent or reauthorization flags or pending_file_id
    setImages([])
    setSelectedImage(null)
    setSelectedImageThumbnail(null)
    setProcessingResult(null)
    setStatus('')
    
    console.log('🔧 [FIX] Redirecting to fresh authentication with preserved intent...')
    setTimeout(() => {
      window.location.href = '/login'
    }, 500)
  }

  const getCurrentStep = (): string => {
    if (location.pathname.includes('select')) return 'selection'
    if (location.pathname.includes('process')) return 'processing'
    if (location.pathname.includes('results')) return 'results'
    return 'selection'
  }

  const currentStep = getCurrentStep()

  // Step Indicator Component - NON-CLICKABLE (disabled)
  interface StepIndicatorProps {
    label: string
    number: string
    isActive: boolean
  }

  const StepIndicator: React.FC<StepIndicatorProps> = ({ 
    label, 
    number, 
    isActive
  }) => (
    <div
      className={`flex flex-col items-center space-y-1 transition-all duration-300 cursor-default ${
        isActive 
          ? 'text-purple-600' 
          : 'text-gray-400'
      }`}
    >
      <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm font-bold transition-all duration-300 ${
        isActive 
          ? 'bg-purple-600 text-white border-purple-600 shadow-lg' 
          : 'bg-gray-100 text-gray-400 border-gray-300'
      }`}>
        {number}
      </div>
      <span className="text-xs font-medium hidden sm:block">{label}</span>
    </div>
  )

  // === CRITICAL: Account mismatch banner - FULL SCREEN TAKEOVER (Picsart Style) ===
  if (showAccountMismatchBanner) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-purple-800 flex items-center justify-center p-4 animate-fadeIn">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-lg w-full text-center transform animate-slideInUp border-4 border-purple-200">
          <div className="text-6xl mb-4 animate-pulse">🚨</div>
          <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600 mb-4 animate-fadeInUp">
            ⚠️ ACCOUNT MISMATCH DETECTED!
          </h1>
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-200 rounded-xl p-5 mb-6 animate-fadeInUp animation-delay-200">
            <p className="text-purple-800 text-sm leading-relaxed mb-4 font-medium">
              🎨 You've switched Dropbox accounts. This app is showing data from a different account.
            </p>
            <div className="bg-white rounded-lg p-4 border-2 border-pink-200 shadow-sm">
              <p className="text-xs text-purple-700 mb-2">
                <strong className="text-purple-800">🌐 Current browser:</strong> 
                <span className="text-pink-600 font-medium ml-1">
                  {accountMismatchInfo.currentAccount || 'Unknown Account'}
                </span>
              </p>
              <p className="text-xs text-purple-700">
                <strong className="text-purple-800">💾 App credentials:</strong> 
                <span className="text-pink-600 font-medium ml-1">
                  {accountMismatchInfo.storedAccount || 'Unknown Account'}
                </span>
              </p>
            </div>
          </div>
          <div className="space-y-3">
            <button
              onClick={handleFixAccountMismatch}
              className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-3 rounded-xl hover:from-purple-700 hover:to-pink-700 transition-all duration-300 transform hover:scale-105 hover:shadow-xl font-semibold shadow-lg w-full animate-fadeInUp animation-delay-400 border-2 border-purple-300"
            >
              <span className="flex items-center justify-center gap-2">
                <span>🔧</span>
                <span>Fix This Issue</span>
                <span className="animate-bounce">✨</span>
              </span>
            </button>
          </div>
          <p className="text-xs text-purple-300 mt-4 animate-fadeInUp animation-delay-600">
            🎨 This will clear your stored credentials and start fresh Picsart authentication
          </p>
        </div>
      </div>
    )
  }

  // === CRITICAL: Account switch banner (Picsart Style) ===
  if (showAccountSwitchBanner) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-600 to-purple-800 flex items-center justify-center p-4 animate-fadeIn">
        <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-md w-full text-center transform animate-slideInUp border-4 border-purple-200">
          <div className="text-6xl mb-4 animate-spin-slow">🔮</div>
          <h1 className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-600 to-pink-600 mb-4 animate-fadeInUp">
            🎨 Account Switch Detected!
          </h1>
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 border-2 border-purple-200 rounded-xl p-4 mb-6 animate-fadeInUp animation-delay-200">
            <p className="text-purple-800 text-sm leading-relaxed font-medium">
              You may have switched Dropbox accounts in your browser. The app is still trying to access files from your previous account.
            </p>
          </div>
          <button
            onClick={handleFixAccountSwitchWithCountdown}
            disabled={fixingAccountSwitch}
            className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-6 py-3 rounded-xl hover:from-purple-700 hover:to-pink-700 transition-all duration-300 transform hover:scale-105 hover:shadow-xl font-semibold shadow-lg disabled:opacity-50 w-full animate-fadeInUp animation-delay-400 border-2 border-purple-300"
          >
            {fixingAccountSwitch ? (
              <span className="flex items-center justify-center gap-2">
                <span className="animate-spin">✨</span>
                <span className="animate-pulse">Fixing in {fixCountdown}...</span>
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <span>🔧</span>
                <span>Fix This Issue</span>
                <span className="animate-bounce">✨</span>
              </span>
            )}
          </button>
          <p className="text-xs text-purple-500 mt-4 animate-fadeInUp animation-delay-600">
            🎨 This will clear your stored credentials and start fresh Picsart authentication
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-screen bg-gradient-to-br from-purple-50 to-pink-50 flex flex-col overflow-hidden">
      <div className="flex-1 flex flex-col max-w-7xl mx-auto w-full">
        <div className="bg-white shadow-lg flex-1 flex flex-col overflow-hidden">

          {/* === EXACT COPY: Header === */}
          <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-4 flex-shrink-0 animate-slideInDown">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <h1 className="text-lg sm:text-xl md:text-2xl font-bold mb-1 animate-fadeInUp">🎨 Picsart Dropbox Plugin</h1>
                <p className="text-purple-100 text-sm truncate animate-fadeInUp animation-delay-200">
                  Welcome{userInfo?.name ? `, ${userInfo.name}` : ''}! <br/> Transform your images with AI-powered tools (BG Remove & Upscale)
                </p>
              </div>
              <div className="flex space-x-2 ml-4">
                <button
                  onClick={() => window.open('https://www.dropbox.com/home', '_blank')}
                  className="bg-white/20 hover:bg-white/30 text-white px-3 py-2 rounded-lg transition-all duration-300 transform hover:scale-105 hover:shadow-lg text-sm font-medium hidden sm:block animate-fadeInUp animation-delay-300"
                >
                  📁 Dropbox
                </button>
                <button
                  onClick={logout}
                  className="bg-white/20 hover:bg-white/30 text-white px-3 py-2 rounded-lg transition-all duration-300 transform hover:scale-105 hover:shadow-lg text-sm font-medium animate-fadeInUp animation-delay-400"
                >
                  🚪 Logout
                </button>
              </div>
            </div>
          </div>
          
          {/* === STEP INDICATORS - NON-CLICKABLE === */}
          <div className="flex items-center justify-center space-x-2 md:space-x-4 mb-4 flex-shrink-0 p-4">
            <StepIndicator 
              label="Select" 
              number="1"
              isActive={currentStep === 'selection'}
            />
            <div className="w-4 md:w-8 h-px bg-gray-300"></div>
            <StepIndicator 
              label="Process" 
              number="2"
              isActive={currentStep === 'processing'}
            />
            <div className="w-4 md:w-8 h-px bg-gray-300"></div>
            <StepIndicator 
              label="Results" 
              number="3"
              isActive={currentStep === 'results'}
            />
          </div>
          
          {/* === Main Content === */}
          <div className="flex-1 overflow-y-auto">
            <Outlet />
          </div>
          
          {/* === EXACT COPY: Status Bar === */}
          <div className="mt-2 space-y-2 flex-shrink-0">
            {status && (
              <div className="p-3 bg-purple-50 border border-purple-200 rounded-lg text-center text-sm text-purple-700 mx-4">
                {status}
              </div>
            )}
          </div>
          
          {/* === EXACT COPY: Token refresh indicator === */}
          {isRefreshing && (
            <div className="mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-center flex-shrink-0 mx-4">
              <div className="flex items-center justify-center space-x-2 text-blue-700">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <span className="text-sm font-medium">🔄 Refreshing authentication...</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

