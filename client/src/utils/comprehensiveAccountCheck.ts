import { Dropbox } from 'dropbox'

// Comprehensive account validation - checks EVERYWHERE for account_id mismatches
export const performComprehensiveAccountCheck = async (): Promise<{
  isValid: boolean
  issues: string[]
  currentAccount?: {
    id: string
    email: string
    name: string
  }
  storedAccount?: {
    id: string
    email: string
  }
}> => {
  const issues: string[] = []
  
  try {
    console.log('🔍 [COMPREHENSIVE CHECK] Starting thorough account validation...')
    
    // 1. Check stored credentials
    const accessToken = localStorage.getItem('access_token')
    const storedUserId = localStorage.getItem('user_id')
    const storedUserInfo = localStorage.getItem('user_info')
    
    if (!accessToken) {
      issues.push('Missing access token')
    }
    
    if (!storedUserId) {
      issues.push('Missing stored user ID')
    }
    
    if (!storedUserInfo) {
      issues.push('Missing stored user info')
    }
    
    if (issues.length > 0) {
      console.log('❌ [COMPREHENSIVE CHECK] Missing credentials:', issues)
      return { isValid: false, issues }
    }
    
    // 2. Parse stored user info
    let storedUserEmail = 'unknown'
    try {
      const parsed = JSON.parse(storedUserInfo!)
      storedUserEmail = parsed.email || 'unknown'
    } catch {
      issues.push('Could not parse stored user info')
    }

    console.log('🔍 [COMPREHENSIVE CHECK] Stored credentials found')
    console.log('🔍 [COMPREHENSIVE CHECK] User ID:', storedUserId)
    console.log('🔍 [COMPREHENSIVE CHECK] Email:', storedUserEmail)

    // 3. Get current account info
    console.log('🔍 [COMPREHENSIVE CHECK] Getting current account info...')
    
    const dbx = new Dropbox({ accessToken: accessToken! })
    let currentAccount
    try {
      const accountInfo = await dbx.usersGetCurrentAccount()
      currentAccount = {
        id: accountInfo.result.account_id,
        email: accountInfo.result.email,
        name: accountInfo.result.name.display_name
      }
      
      console.log('✅ [COMPREHENSIVE CHECK] Current account:', currentAccount.id, currentAccount.email)
    } catch (error: unknown) {
      const errorObj = error as { error?: { error_summary?: string }; message?: string }
      console.log('❌ [COMPREHENSIVE CHECK] Failed to get current account:', errorObj?.error?.error_summary || errorObj?.message)
      issues.push(`Account info fetch failed: ${errorObj?.error?.error_summary || errorObj?.message}`)
      return { isValid: false, issues }
    }

    // 4. Compare stored vs current
    console.log('🔍 [COMPREHENSIVE CHECK] Comparing accounts...')
    console.log('🔍 [COMPREHENSIVE CHECK] Stored ID:', storedUserId)
    console.log('🔍 [COMPREHENSIVE CHECK] Current ID:', currentAccount.id)
    
    if (currentAccount.id !== storedUserId) {
      console.log('❌ [COMPREHENSIVE CHECK] Account ID mismatch!')
      issues.push('Account ID mismatch detected')
      
      return {
        isValid: false,
        issues,
        currentAccount,
        storedAccount: {
          id: storedUserId!,
          email: storedUserEmail
        }
      }
    }

    // 5. All validations passed
    console.log('✅ [COMPREHENSIVE CHECK] All validations passed - account is valid')
    
    return {
      isValid: true,
      issues: [],
      currentAccount,
      storedAccount: {
        id: storedUserId!,
        email: storedUserEmail
      }
    }

  } catch (error: unknown) {
    console.error('❌ [COMPREHENSIVE CHECK] Comprehensive check failed:', error)
    issues.push(`Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    
    return { isValid: false, issues }
  }
}

// Trigger comprehensive check and handle results - only on startup
export const triggerComprehensiveAccountCheck = async () => {
  console.log('🔍 [COMPREHENSIVE CHECK] Running startup comprehensive check...')
  
  const result = await performComprehensiveAccountCheck()
  
  if (!result.isValid) {
    console.log('🚨 [COMPREHENSIVE CHECK] Account validation FAILED!')
    console.log('🚨 [COMPREHENSIVE CHECK] Issues found:', result.issues)
    
    // Trigger account mismatch event
    window.dispatchEvent(new CustomEvent('accountMismatch', {
      detail: {
        accountEmail: result.currentAccount?.email || 'Unknown',
        accountId: result.currentAccount?.id || 'Unknown',
        accountName: result.currentAccount?.name || 'Unknown',
        storedEmail: result.storedAccount?.email || 'Unknown',
        storedId: result.storedAccount?.id || 'Unknown',
        error: result.issues.join('; '),
        source: 'comprehensive-check',
        confirmed: true
      }
    }))
    
    return false
  }
  
  console.log('✅ [COMPREHENSIVE CHECK] Account validation passed')
  return true
} 