import { Dropbox } from 'dropbox'

// Immediate account validation when cross-account errors detected
export const triggerImmediateAccountValidation = async (ignoreGracePeriod: boolean = false) => {
  try {
    // For 409 errors and startup validation, always run regardless of grace period
    if (!ignoreGracePeriod) {
      // Check if we're in grace period after re-authorization
      const lastReauthTime = localStorage.getItem('lastReauthorizationTime')
      const recentlyReauthorized = localStorage.getItem('recentlyReauthorized')
      
      if (recentlyReauthorized === 'true' && lastReauthTime) {
        const GRACE_PERIOD = 5 * 60 * 1000 // 5 minutes
        const timeSinceReauth = Date.now() - parseInt(lastReauthTime)
        
        if (timeSinceReauth < GRACE_PERIOD) {
          console.log(`🛡️ [IMMEDIATE VALIDATION] Grace period active (${Math.round(timeSinceReauth / 1000)}s since reauth), skipping immediate validation`)
          return true
        } else {
          // Clear grace period flags from localStorage
          localStorage.removeItem('recentlyReauthorized')
          localStorage.removeItem('lastReauthorizationTime')
        }
      }
    } else {
      console.log('🚨 [IMMEDIATE VALIDATION] IGNORING grace period - running validation for 409/startup')
    }
    
    const accessToken = localStorage.getItem('access_token')
    const storedUserId = localStorage.getItem('user_id')
    const storedUserInfo = localStorage.getItem('user_info')
    
    if (!accessToken || !storedUserId) {
      console.log('🚨 [IMMEDIATE VALIDATION] Missing credentials - forcing re-auth')
      window.dispatchEvent(new CustomEvent('accountMismatch', {
        detail: {
          accountEmail: 'Missing credentials',
          accountId: 'unknown',
          error: 'Missing authentication credentials',
          source: 'immediate-validation'
        }
      }))
      return
    }

    console.log('🔍 [IMMEDIATE VALIDATION] Running emergency account check...')
    
    // Get current account from Dropbox
    const dbx = new Dropbox({ accessToken })
    const currentAccount = await dbx.usersGetCurrentAccount()
    const currentAccountId = currentAccount.result.account_id
    const currentEmail = currentAccount.result.email
    
    console.log('🔍 [IMMEDIATE VALIDATION] Current account:', currentAccountId, currentEmail)
    console.log('🔍 [IMMEDIATE VALIDATION] Stored user ID:', storedUserId)
    
    // Parse stored user info for comparison
    let storedEmail = 'unknown'
    try {
      const parsedUserInfo = JSON.parse(storedUserInfo || '{}')
      storedEmail = parsedUserInfo.email || 'unknown'
    } catch {
      console.log('🔍 [IMMEDIATE VALIDATION] Could not parse stored user info')
    }
    
    if (currentAccountId !== storedUserId) {
      console.log('🚨 [IMMEDIATE VALIDATION] ACCOUNT MISMATCH DETECTED!')
      console.log('🚨 [IMMEDIATE VALIDATION] Current:', currentAccountId, currentEmail)
      console.log('🚨 [IMMEDIATE VALIDATION] Stored:', storedUserId, storedEmail)
      
      // Trigger account mismatch event
      window.dispatchEvent(new CustomEvent('accountMismatch', {
        detail: {
          accountEmail: currentEmail,
          accountId: currentAccountId,
          accountName: currentAccount.result.name.display_name,
          storedEmail: storedEmail,
          storedId: storedUserId,
          error: 'Account mismatch detected during immediate validation',
          source: 'immediate-validation',
          confirmed: true
        }
      }))
      
      return false
    }
    
    console.log('✅ [IMMEDIATE VALIDATION] Account validation passed')
    return true
    
  } catch (error: unknown) {
    console.error('❌ [IMMEDIATE VALIDATION] Validation failed:', error)
    
    const errorObj = error as { status?: number; error?: { error_summary?: string }; message?: string }
    
    // For errors, trigger account mismatch
    window.dispatchEvent(new CustomEvent('accountMismatch', {
      detail: {
        accountEmail: 'Validation failed',
        accountId: 'unknown',
        error: errorObj?.message || 'Immediate validation failed',
        source: 'immediate-validation-error'
      }
    }))
    
    return false
  }
}

// Trigger validation on 409 errors - ALWAYS IMMEDIATE (ignores grace period)
export const triggerOn409Error = async () => {
  console.log('🚨 [409 VALIDATION] Cross-account 409 error detected - running immediate validation')
  return await triggerImmediateAccountValidation(true) // Always ignore grace period for 409s
}

// Trigger validation on app startup - ALWAYS IMMEDIATE (ignores grace period)
export const triggerOnStartup = async () => {
  console.log('🔍 [STARTUP VALIDATION] App startup - running immediate validation')
  return await triggerImmediateAccountValidation(true) // Always ignore grace period for startup
} 