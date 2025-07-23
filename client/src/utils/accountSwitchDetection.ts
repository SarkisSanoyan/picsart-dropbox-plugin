// Account switch detection utility - detects cross-account 409 errors
let consecutiveErrors = 0
let originalFetch: typeof window.fetch | null = null

export const initializeAccountSwitchDetection = () => {
  console.log('🔧 [ACCOUNT SWITCH] Initializing account switch detection...')
  
  // Don't initialize twice
  if (originalFetch) {
    console.log('🔧 [ACCOUNT SWITCH] Already initialized, skipping...')
    return
  }

  // Store original fetch
  originalFetch = window.fetch
  
  // Override fetch to detect consecutive cross-account 409 errors
  window.fetch = function(...args) {
    return originalFetch!.apply(this, args).then(async response => {
      if (response.status === 409) {
        try {
          // Check if it's specifically a cross-account error
          const responseClone = response.clone()
          const data = await responseClone.json()
          
          if (data?.error?.error_summary?.includes('path/not_found')) {
            consecutiveErrors++
            console.log('🔍 [ACCOUNT SWITCH] Cross-account 409 error detected, count:', consecutiveErrors)
            
            if (consecutiveErrors >= 2) { // Increased threshold
              console.log('🚨 [ACCOUNT SWITCH] Multiple cross-account errors suggest account switch')
              
              // Trigger account switch banner
              window.dispatchEvent(new CustomEvent('accountSwitchDetected', {
                detail: {
                  source: 'fetch-interceptor',
                  errorCount: consecutiveErrors,
                  error: 'Multiple cross-account 409 errors detected'
                }
              }))
              
              // Reset counter to avoid spam
              consecutiveErrors = 0
            }
          } else {
            console.log('🔍 [ACCOUNT SWITCH] 409 error but not cross-account, ignoring for count')
          }
        } catch {
          console.log('🔍 [ACCOUNT SWITCH] Could not parse 409 error response')
        }
      } else if (response.ok) {
        consecutiveErrors = 0 // Reset on successful request
      }
      
      return response
    }).catch(error => {
      // Handle fetch errors that might indicate account issues
      console.log('🔍 [ACCOUNT SWITCH] Fetch error:', error)
      throw error
    })
  }
  
  console.log('🔍 [ACCOUNT SWITCH] Fetch interceptor initialized successfully')
}

export const resetAccountSwitchDetection = () => {
  console.log('🔧 [ACCOUNT SWITCH] Resetting account switch detection...')
  consecutiveErrors = 0
}

export const destroyAccountSwitchDetection = () => {
  console.log('🔧 [ACCOUNT SWITCH] Destroying account switch detection...')
  
  if (originalFetch) {
    window.fetch = originalFetch
    originalFetch = null
  }
  
  consecutiveErrors = 0
} 