import { useCallback, useEffect } from 'react'
import { Dropbox } from 'dropbox'
import { useAuth } from './useAuth'
import { useAppStore } from '../store'

interface AccountValidationResult {
  isValid: boolean
  currentAccount?: {
    accountId: string
    email: string
    name: string
  }
  storedAccount?: {
    userId: string
    email?: string
    name?: string
  }
  error?: string
}

export const useAccountValidation = () => {
  const { accessToken, userInfo } = useAuth()
  const { 
    setShowAccountMismatchBanner, 
    setAccountMismatchInfo,
    showAccountMismatchBanner,
    recentlyReauthorized,
    lastReauthorizationTime,
    setRecentlyReauthorized
  } = useAppStore()

  // Simple account validation - only called on startup
  const validateCurrentAccount = useCallback(async (): Promise<AccountValidationResult> => {
    try {
      if (!accessToken || !userInfo) {
        return {
          isValid: false,
          error: 'No authentication credentials'
        }
      }

      console.log('🔍 [ACCOUNT VALIDATION] Checking current Dropbox account...')
      console.log('🔍 [ACCOUNT VALIDATION] Stored user:', userInfo.userId, userInfo.email)

      // Get current account from Dropbox
      const dbx = new Dropbox({ accessToken })
      const currentAccount = await dbx.usersGetCurrentAccount()
      const currentAccountId = currentAccount.result.account_id
      const currentEmail = currentAccount.result.email
      const currentName = currentAccount.result.name.display_name

      console.log('🔍 [ACCOUNT VALIDATION] Current Dropbox account:', currentAccountId, currentEmail)

      // CRITICAL: Compare with stored user info
      if (currentAccountId !== userInfo.userId) {
        console.log('🚨 [ACCOUNT VALIDATION] Account ID mismatch!')
        console.log('🚨 [ACCOUNT VALIDATION] Current:', currentAccountId)
        console.log('🚨 [ACCOUNT VALIDATION] Stored:', userInfo.userId)
        
        return {
          isValid: false,
          currentAccount: {
            accountId: currentAccountId,
            email: currentEmail,
            name: currentName
          },
          storedAccount: {
            userId: userInfo.userId,
            email: userInfo.email,
            name: userInfo.name
          },
          error: 'Account ID mismatch detected'
        }
      }

      console.log('✅ [ACCOUNT VALIDATION] Account validation passed')
      return { isValid: true }

    } catch (error: unknown) {
      console.error('❌ [ACCOUNT VALIDATION] Validation failed:', error)
      
      const errorObj = error as { status?: number; error?: { error_summary?: string }; message?: string }
      return {
        isValid: false,
        error: errorObj?.message || 'Unknown validation error'
      }
    }
  }, [accessToken, userInfo])

  // Show account mismatch banner
  const showAccountMismatch = useCallback((result: AccountValidationResult) => {
    console.log('🚨 [ACCOUNT VALIDATION] Displaying account mismatch banner')
    
    setAccountMismatchInfo({
      currentAccount: result.currentAccount?.email || result.currentAccount?.accountId || 'Unknown',
      storedAccount: result.storedAccount?.email || result.storedAccount?.userId || 'Unknown',
      error: result.error || 'Account mismatch detected'
    })
    
    setShowAccountMismatchBanner(true)
  }, [setAccountMismatchInfo, setShowAccountMismatchBanner])

  // Enhanced validation before critical operations
  const validateBeforeOperation = useCallback(async (operationType: 'STARTUP' | 'ERROR_409' | 'USER_OPERATION' = 'USER_OPERATION'): Promise<boolean> => {
    try {
      console.log(`🔍 [ACCOUNT VALIDATION] Validating before ${operationType} operation...`)

      // Check grace period for USER_OPERATION only
      if (operationType === 'USER_OPERATION' && recentlyReauthorized && lastReauthorizationTime) {
        const GRACE_PERIOD = 5 * 60 * 1000 // 5 minutes
        const timeSinceReauth = Date.now() - lastReauthorizationTime
        
        if (timeSinceReauth < GRACE_PERIOD) {
          const remainingTime = Math.round((GRACE_PERIOD - timeSinceReauth) / 1000)
          console.log(`🛡️ [ACCOUNT VALIDATION] Grace period active for USER_OPERATION (${remainingTime}s remaining), allowing operation`)
          return true
        } else {
          console.log('🕒 [ACCOUNT VALIDATION] Grace period expired, clearing flags')
          setRecentlyReauthorized(false)
        }
      }

      // For STARTUP and ERROR_409, always validate regardless of grace period
      if (operationType === 'STARTUP' || operationType === 'ERROR_409') {
        console.log(`🚨 [ACCOUNT VALIDATION] ${operationType} validation - IGNORING grace period`)
      }

      const validation = await validateCurrentAccount()
      if (!validation.isValid) {
        console.log(`🚨 [ACCOUNT VALIDATION] ${operationType} validation failed - SHOWING BANNER`)
        showAccountMismatch(validation)
        return false
      }
      
      console.log(`✅ [ACCOUNT VALIDATION] ${operationType} validation passed`)
      return true
    } catch (error) {
      console.error(`❌ [ACCOUNT VALIDATION] ${operationType} validation error:`, error)
      return false
    }
  }, [validateCurrentAccount, showAccountMismatch, recentlyReauthorized, lastReauthorizationTime, setRecentlyReauthorized])

  // Startup-only validation effect
  useEffect(() => {
    if (!accessToken || !userInfo || showAccountMismatchBanner) {
      return
    }

    // Check if we're in grace period after recent re-authorization
    if (recentlyReauthorized && lastReauthorizationTime) {
      const GRACE_PERIOD = 5 * 60 * 1000 // 5 minutes
      const timeSinceReauth = Date.now() - lastReauthorizationTime
      
      if (timeSinceReauth < GRACE_PERIOD) {
        console.log(`🛡️ [ACCOUNT VALIDATION] Grace period active (${Math.round(timeSinceReauth / 1000)}s since reauth), skipping startup validation`)
        
        const remainingGraceTime = GRACE_PERIOD - timeSinceReauth
        const graceTimer = setTimeout(() => {
          console.log('🕒 [ACCOUNT VALIDATION] Grace period expired')
          setRecentlyReauthorized(false)
        }, remainingGraceTime)
        
        return () => clearTimeout(graceTimer)
      }
    }

    console.log('🔍 [ACCOUNT VALIDATION] Running STARTUP validation only...')
    
    // Single startup validation
    const runStartupValidation = async () => {
      try {
        console.log('🔍 [ACCOUNT VALIDATION] Running startup account validation...')
        const validation = await validateCurrentAccount()
        if (!validation.isValid) {
          console.log('🚨 [ACCOUNT VALIDATION] STARTUP validation failed - SHOWING BANNER')
          showAccountMismatch(validation)
        } else {
          console.log('✅ [ACCOUNT VALIDATION] STARTUP validation passed')
        }
      } catch (error) {
        console.error('❌ [ACCOUNT VALIDATION] Startup validation failed:', error)
      }
    }

    // Run startup validation after a short delay
    const startupTimer = setTimeout(() => {
      runStartupValidation()
    }, 2000) // Wait 2 seconds after component mount

    return () => clearTimeout(startupTimer)
  }, [accessToken, userInfo, validateCurrentAccount, showAccountMismatch, showAccountMismatchBanner, recentlyReauthorized, lastReauthorizationTime, setRecentlyReauthorized])

  return {
    validateCurrentAccount,
    validateBeforeOperation,
    showAccountMismatch
  }
} 