import { Dropbox } from 'dropbox';

// Define proper types for Dropbox error objects
interface DropboxError {
  error?: {
    error_summary?: string;
    error?: string;
  };
  status?: number;
}

export interface ValidationResult {
  isValid: boolean;
  reason?: string;
  error?: string;
  shouldShowBanner?: boolean;
  shouldReauth?: boolean;
  sessionMismatch?: boolean;
  accountId?: string;
  accountEmail?: string;
  accountName?: string;
}

// CRITICAL SECURITY: Validate that stored tokens belong to current user
export async function validateCurrentAccount(): Promise<ValidationResult> {
  try {
    const accessToken = localStorage.getItem('access_token');
    const storedUserId = localStorage.getItem('user_id');
    const storedUserInfo = localStorage.getItem('user_info');
    
    if (!accessToken || !storedUserId) {
      console.log('🔒 Missing stored credentials');
      return { isValid: false, reason: 'Missing stored credentials', error: 'Missing stored credentials' };
    }
    
    console.log('🔍 Stored user info:', storedUserInfo);
    
    // Call Dropbox API to get current account info
    console.log('🔍 Checking current account against stored credentials...');
    const dbx = new Dropbox({ accessToken });
    const currentAccount = await dbx.usersGetCurrentAccount();
    const currentAccountId = currentAccount.result.account_id;
    const currentAccountEmail = currentAccount.result.email;
    const currentAccountName = currentAccount.result.name.display_name;
    
    console.log('🔍 Current account details:');
    console.log('   ID:', currentAccountId);
    console.log('   Email:', currentAccountEmail);  
    console.log('   Name:', currentAccountName);
    console.log('🔍 Stored user ID:', storedUserId);
    
    // Compare current account with stored user ID
    if (currentAccountId !== storedUserId) {
      console.log('🚨 SECURITY ALERT: Account mismatch detected!');
      console.log('🚨 Current Account:', currentAccountId, '(' + currentAccountEmail + ')');
      console.log('🚨 Stored Account:', storedUserId);
      console.log('🚨 User has switched Dropbox accounts!');
      return { 
        isValid: false, 
        reason: 'Account mismatch detected',
        error: 'Account mismatch detected',
        shouldShowBanner: true,
        shouldReauth: true,
        sessionMismatch: true,
        accountId: currentAccountId,
        accountEmail: currentAccountEmail,
        accountName: currentAccountName
      };
    }
    
    console.log('✅ Account validation passed - user matches stored credentials');
    console.log('✅ Confirmed user:', currentAccountEmail);        
    return { 
      isValid: true,
      accountId: currentAccountId,
      accountEmail: currentAccountEmail,
      accountName: currentAccountName
    };
    
  } catch (error) {
    console.log('❌ Account validation failed:', (error as Error).message);
    console.log('❌ Error details:', error);
    // If token is invalid/expired, validation fails
    return { 
      isValid: false, 
      reason: 'Token validation failed',
      error: (error as Error).message,
      shouldReauth: true
    };
  }
}

// CRITICAL: Test if token works with current browser session by making actual API calls
export async function validateSessionConsistency(): Promise<ValidationResult> {
  try {
    console.log('🔍 [SESSION TEST] Testing if stored token works with current browser session...');
    
    const accessToken = localStorage.getItem('access_token');
    const storedUserId = localStorage.getItem('user_id');
    
    if (!accessToken || !storedUserId) {
      return { isValid: false, reason: 'Missing credentials', error: 'Missing credentials' };
    }
    
    // First, validate the basic account info
    const basicValidation = await validateCurrentAccount();
    if (!basicValidation.isValid) {
      return basicValidation;
    }
    
    // Now test actual API functionality to detect session mismatches
    console.log('🔍 [SESSION TEST] Testing API calls to detect session mismatch...');
    
    const dbx = new Dropbox({ accessToken });
    
    // Test 1: Try to list files (this often fails when session is mismatched)
    try {
      console.log('🔍 [SESSION TEST] Testing file listing...');
      const listResult = await dbx.filesListFolder({ path: '', limit: 1 });
      console.log('✅ [SESSION TEST] File listing successful:', listResult.result.entries.length, 'files');
    } catch (listError) {
      console.log('❌ [SESSION TEST] File listing failed:', listError);
      
      // Check if this is a session-related error
      if (listError instanceof Error && listError.message.includes('401')) {
        console.log('🚨 [SESSION TEST] 401 error suggests session mismatch');
        return {
          isValid: false,
          reason: 'Session mismatch detected via API test',
          error: 'API access failed - session mismatch',
          shouldShowBanner: true,
          sessionMismatch: true,
          accountId: basicValidation.accountId,
          accountEmail: basicValidation.accountEmail,
          accountName: basicValidation.accountName
        };
      }
      
      // Other API errors also suggest session issues
      console.log('🚨 [SESSION TEST] API error suggests session mismatch');
      return {
        isValid: false,
        reason: 'API access failed',
        error: 'API calls failing - possible session mismatch',
        shouldShowBanner: true,
        sessionMismatch: true,
        accountId: basicValidation.accountId,
        accountEmail: basicValidation.accountEmail,
        accountName: basicValidation.accountName
      };
    }
    
    // Test 2: Try to get space usage (another common failure point)
    try {
      console.log('🔍 [SESSION TEST] Testing space usage...');
      const spaceResult = await dbx.usersGetSpaceUsage();
      console.log('✅ [SESSION TEST] Space usage successful:', spaceResult.result.used);
    } catch (spaceError) {
      console.log('❌ [SESSION TEST] Space usage failed:', spaceError);
      return {
        isValid: false,
        reason: 'Session mismatch detected via space usage test',
        error: 'Space usage API failed - session mismatch',
        shouldShowBanner: true,
        sessionMismatch: true,
        accountId: basicValidation.accountId,
        accountEmail: basicValidation.accountEmail,
        accountName: basicValidation.accountName
      };
    }
    
    console.log('✅ [SESSION TEST] All API tests passed - session appears consistent');
    return {
      isValid: true,
      accountId: basicValidation.accountId,
      accountEmail: basicValidation.accountEmail,
      accountName: basicValidation.accountName
    };
    
  } catch (error) {
    console.log('❌ [SESSION TEST] Session consistency test failed:', error);
    return {
      isValid: false,
      reason: 'Session test failed',
      error: (error as Error).message,
      shouldShowBanner: true,
      sessionMismatch: true
    };
  }
}

// Enhanced validation that detects browser session vs stored credentials mismatch
export async function validateAccountWithSessionCheck(): Promise<ValidationResult> {
  try {
    console.log('🔍 [ENHANCED] Advanced validation with session consistency check...');
    
    // First do session consistency test (this is the real test)
    const sessionValidation = await validateSessionConsistency();
    
    if (!sessionValidation.isValid) {
      console.log('❌ [ENHANCED] Session consistency failed:', sessionValidation.reason);
      return sessionValidation;
    }
    
    console.log('✅ [ENHANCED] Enhanced validation passed - account and session are consistent');
    return sessionValidation;
    
  } catch (error) {
    console.log('❌ [ENHANCED] Enhanced validation failed:', error);
    return {
      isValid: false,
      reason: 'Enhanced validation failed',
      error: (error as Error).message,
      shouldShowBanner: true,
      sessionMismatch: true
    };
  }
}

// Quick validation without API calls (for immediate UI decisions)
export function validateStoredCredentials(): ValidationResult {
  const accessToken = localStorage.getItem('access_token');
  const storedUserId = localStorage.getItem('user_id');
  const storedUserInfo = localStorage.getItem('user_info');
  
  if (!accessToken || !storedUserId) {
    return {
      isValid: false,
      error: 'Missing stored credentials',
      shouldReauth: true
    };
  }
  
  try {
    const userInfo = storedUserInfo ? JSON.parse(storedUserInfo) : null;
    return {
      isValid: true,
      accountId: storedUserId,
      accountEmail: userInfo?.email,
      accountName: userInfo?.name
    };
  } catch (error: unknown) {
    console.error('❌ Error parsing stored user info:', error);
    return {
      isValid: false,
      error: 'Invalid stored user info',
      shouldReauth: true
    };
  }
}

// Enhanced validation with detailed logging - NOW USES SESSION CHECK
export async function validateWithLogging(context: string): Promise<ValidationResult> {
  console.log(`🔍 [${context}] Account validation initiated from: ${context}`);
  
  // Use the enhanced validation that includes session checking
  const result = await validateAccountWithSessionCheck();
  
  if (!result.isValid) {
    console.log(`❌ [${context}] Account validation failed:`, result.error);
    if (result.shouldReauth) {
      console.log(`🔒 [${context}] requires re-authentication`);
    }
    if (result.sessionMismatch) {
      console.log(`🚨 [${context}] detected session mismatch - cross-account usage detected`);
    }
  } else {
    console.log(`✅ [${context}] Account validation passed for user: ${result.accountEmail}`);
  }
  
  return result;
}

// Pre-validate API call to ensure account consistency - NOW USES SESSION CHECK
export async function preValidateApiCall(): Promise<ValidationResult> {
  console.log('[VALIDATE] 🔍 Pre-validating API call with session check...');
  
  try {
    // Use the enhanced validation that includes session checking
    const validation = await validateAccountWithSessionCheck();
    
    if (!validation.isValid) {
      console.log('[VALIDATE] ❌ Pre-validation failed:', validation.reason);
      return validation;
    }
    
    console.log('[VALIDATE] ✅ Pre-validation passed with session check');
    return { isValid: true };
    
  } catch (error) {
    console.log('[VALIDATE] ❌ Pre-validation error:', error);
    return { isValid: false, reason: 'Pre-validation failed', error: 'Pre-validation failed' };
  }
}

// UI lockdown helper
export function shouldLockUI(): boolean {
  const validation = validateStoredCredentials();
  return !validation.isValid;
}

// Force re-authentication by clearing tokens
export function forceReauth(): void {
  console.log('[VALIDATE] 🔄 Forcing re-authentication...');
  
  // Clear all tokens
  localStorage.removeItem('access_token');
  localStorage.removeItem('refresh_token');
  localStorage.removeItem('user_id');
  localStorage.removeItem('user_info');
  localStorage.removeItem('token_expires_in');
  localStorage.removeItem('code_verifier');
  localStorage.removeItem('post_login_redirect');
  
  console.log('[VALIDATE] ✅ All tokens cleared');
  
  // Reload the page to start fresh
  window.location.reload();
}

// Fix account switch with countdown (based on server.js reference)
export function fixAccountSwitch(): Promise<void> {
  return new Promise((resolve) => {
    console.log('🔧 Fixing account switch...');
    
    let countdown = 3;
    
    // Start countdown
    const countdownInterval = setInterval(() => {
      console.log(`🔄 Fixing in ${countdown}...`);
      countdown--;
      
      if (countdown < 0) {
        clearInterval(countdownInterval);
        
        // Clear all tokens
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user_id');
        localStorage.removeItem('user_info');
        localStorage.removeItem('token_expires_in');
        localStorage.removeItem('code_verifier');
        localStorage.removeItem('post_login_redirect');
        
        console.log('✅ Tokens cleared after countdown');
        
        // Reload page after a short delay
        setTimeout(() => {
          window.location.reload();
          resolve();
        }, 1000);
      }
    }, 1000);
  });
}

// Detect potential account switch from API errors
export function detectAccountSwitchFromError(error: unknown): boolean {
  // Check for 409 errors (account mismatch / file not found in current account)
  if (error && typeof error === 'object' && 'response' in error) {
    const errorResponse = error as { response: { status: number; data?: { shouldReauth?: boolean; error_summary?: string } } };
    
    // 409 errors often indicate cross-account access (file not found in current account)
    if (errorResponse.response?.status === 409) {
      console.log('🚨 409 error suggests cross-account access - file not found in current account');
      return true;
    }
    
    // Check for 403 errors with shouldReauth flag
    if (errorResponse.response?.status === 403 && errorResponse.response?.data?.shouldReauth) {
      console.log('🚨 Server detected account mismatch');
      return true;
    }
    
    // Check for Dropbox-specific error patterns
    if (errorResponse.response?.data?.error_summary?.includes('path/not_found')) {
      console.log('🚨 Dropbox path/not_found error suggests cross-account access');
      return true;
    }
  }
  
  return false;
}

// Enhanced fetch wrapper that detects account switches
let consecutiveErrors = 0;
export function wrapFetchWithAccountDetection() {
  const originalFetch = window.fetch;
  
  window.fetch = function(...args) {
    return originalFetch.apply(this, args).then(response => {
      // Check for 409 errors (cross-account access)
      if (response.status === 409) {
        consecutiveErrors++;
        console.log('🔍 409 error detected, count:', consecutiveErrors);
        console.log('🚨 409 error indicates cross-account access - file not found in current account');
        
        // Trigger banner immediately for 409 errors
        window.dispatchEvent(new CustomEvent('accountSwitchDetected'));
      } else if (response.ok) {
        consecutiveErrors = 0; // Reset on successful request
      } else if (response.status >= 400) {
        // Check for other client errors that might indicate account issues
        consecutiveErrors++;
        console.log('🔍 Client error detected:', response.status, 'count:', consecutiveErrors);
        
        if (consecutiveErrors >= 2) {
          console.log('🚨 Multiple client errors suggest account switch');
          window.dispatchEvent(new CustomEvent('accountSwitchDetected'));
        }
      }
      
      return response;
    }).catch(error => {
      // Also catch network errors that might be account-related
      console.log('🔍 Network error detected:', error);
      if (detectAccountSwitchFromError(error)) {
        console.log('🚨 Network error suggests account switch');
        window.dispatchEvent(new CustomEvent('accountSwitchDetected'));
      }
      throw error;
    });
  };
}

// Initialize account switch detection
export function initializeAccountSwitchDetection() {
  wrapFetchWithAccountDetection();
  console.log('✅ Account switch detection initialized');
} 

// CRITICAL: Test actual file access to detect cross-account issues immediately
export async function validateFileAccess(fileId?: string): Promise<ValidationResult> {
  try {
    console.log('🔍 [FILE ACCESS] Testing actual file access to detect cross-account issues...');
    
    const accessToken = localStorage.getItem('access_token');
    const storedUserId = localStorage.getItem('user_id');
    
    if (!accessToken || !storedUserId) {
      return { isValid: false, reason: 'Missing credentials', error: 'Missing credentials' };
    }
    
    const dbx = new Dropbox({ accessToken });
    
    // Test 1: Basic account validation
    const basicValidation = await validateCurrentAccount();
    if (!basicValidation.isValid) {
      return basicValidation;
    }
    
    // Test 2: If we have a specific file ID, try to access it
    if (fileId && fileId !== 'unknown') {
      try {
        console.log('🔍 [FILE ACCESS] Testing access to specific file:', fileId);
        
        // Try to get file metadata
        const fileResult = await dbx.filesGetMetadata({ path: fileId as string });
        console.log('✅ [FILE ACCESS] File access successful:', fileResult.result.name);
        
        // Also try to get a download link (this often fails in cross-account scenarios)
        try {
          await dbx.filesGetTemporaryLink({ path: fileId as string });
          console.log('✅ [FILE ACCESS] Download link generation successful');
        } catch (linkError) {
          console.log('❌ [FILE ACCESS] Download link failed:', linkError);
          
          // Check if this is a cross-account error
          if (linkError && typeof linkError === 'object' && 'error' in linkError) {
            const error = linkError as DropboxError;
            if (error.error?.error_summary?.includes('path/not_found') || 
                error.status === 409 || 
                error.error?.error?.includes('not_found')) {
              console.log('🚨 [FILE ACCESS] File not found - cross-account access detected!');
              return {
                isValid: false,
                reason: 'File not accessible - cross-account detected',
                error: 'Selected file not found in current account - cross-account access',
                shouldShowBanner: true,
                sessionMismatch: true,
                accountId: basicValidation.accountId,
                accountEmail: basicValidation.accountEmail,
                accountName: basicValidation.accountName
              };
            }
          }
          
          // Other link errors might also suggest cross-account issues
          return {
            isValid: false,
            reason: 'File link generation failed',
            error: 'Cannot generate download link - possible cross-account access',
            shouldShowBanner: true,
            sessionMismatch: true,
            accountId: basicValidation.accountId,
            accountEmail: basicValidation.accountEmail,
            accountName: basicValidation.accountName
          };
        }
        
      } catch (fileError) {
        console.log('❌ [FILE ACCESS] File access failed:', fileError);
        
        // Check if this is a cross-account error
        if (fileError && typeof fileError === 'object' && 'error' in fileError) {
          const error = fileError as DropboxError;
          if (error.error?.error_summary?.includes('path/not_found') || 
              error.status === 409 || 
              error.error?.error?.includes('not_found')) {
            console.log('🚨 [FILE ACCESS] File not found - DEFINITELY cross-account access!');
            return {
              isValid: false,
              reason: 'File not found - cross-account access confirmed',
              error: 'Selected file not found in stored account - user switched accounts',
              shouldShowBanner: true,
              sessionMismatch: true,
              accountId: basicValidation.accountId,
              accountEmail: basicValidation.accountEmail,
              accountName: basicValidation.accountName
            };
          }
        }
        
        // Any file access error suggests issues
        return {
          isValid: false,
          reason: 'File access failed',
          error: 'Cannot access selected file - possible account mismatch',
          shouldShowBanner: true,
          sessionMismatch: true,
          accountId: basicValidation.accountId,
          accountEmail: basicValidation.accountEmail,
          accountName: basicValidation.accountName
        };
      }
    }
    
    // Test 3: Aggressive folder listing test (try to list recent files)
    try {
      console.log('🔍 [FILE ACCESS] Testing recent files access...');
      const recentResult = await dbx.filesListFolder({ path: '', limit: 5 });
      console.log('✅ [FILE ACCESS] Recent files access successful:', recentResult.result.entries.length, 'files');
      
      // If we got files, try to access one of them to verify session consistency
      if (recentResult.result.entries.length > 0) {
        const testFile = recentResult.result.entries[0];
        try {
          const filePath = testFile.path_lower || testFile.path_display;
          if (!filePath) {
            console.log('❌ [FILE ACCESS] Test file has no valid path');
            return {
              isValid: false,
              reason: 'Test file has no valid path',
              error: 'File structure error - no valid path',
              shouldShowBanner: true,
              sessionMismatch: true,
              accountId: basicValidation.accountId,
              accountEmail: basicValidation.accountEmail,
              accountName: basicValidation.accountName
            };
          }
          const testMetadata = await dbx.filesGetMetadata({ path: filePath });
          console.log('✅ [FILE ACCESS] Test file access successful:', testMetadata.result.name);
        } catch {
          console.log('❌ [FILE ACCESS] Test file access failed - session inconsistency detected');
          return {
            isValid: false,
            reason: 'Session inconsistency detected',
            error: 'Cannot access own files - session mismatch detected',
            shouldShowBanner: true,
            sessionMismatch: true,
            accountId: basicValidation.accountId,
            accountEmail: basicValidation.accountEmail,
            accountName: basicValidation.accountName
          };
        }
      }
      
    } catch (listError) {
      console.log('❌ [FILE ACCESS] Recent files access failed:', listError);
      return {
        isValid: false,
        reason: 'Recent files access failed',
        error: 'Cannot list recent files - possible session mismatch',
        shouldShowBanner: true,
        sessionMismatch: true,
        accountId: basicValidation.accountId,
        accountEmail: basicValidation.accountEmail,
        accountName: basicValidation.accountName
      };
    }
    
    console.log('✅ [FILE ACCESS] All file access tests passed - session is consistent');
    return {
      isValid: true,
      accountId: basicValidation.accountId,
      accountEmail: basicValidation.accountEmail,
      accountName: basicValidation.accountName
    };
    
  } catch (error) {
    console.log('❌ [FILE ACCESS] File access validation failed:', error);
    return {
      isValid: false,
      reason: 'File access validation failed',
      error: (error as Error).message,
      shouldShowBanner: true,
      sessionMismatch: true
    };
  }
}

// SUPER AGGRESSIVE validation for cross-account detection
export async function superAggressiveValidation(fileId?: string): Promise<ValidationResult> {
  try {
    console.log('🔍 [SUPER AGGRESSIVE] Running all validation tests...');
    
    // Test 1: Basic validation
    const basicResult = await validateCurrentAccount();
    if (!basicResult.isValid) {
      console.log('❌ [SUPER AGGRESSIVE] Basic validation failed');
      return basicResult;
    }
    
    // Test 2: Session consistency
    const sessionResult = await validateSessionConsistency();
    if (!sessionResult.isValid) {
      console.log('❌ [SUPER AGGRESSIVE] Session validation failed');
      return sessionResult;
    }
    
    // Test 3: File access validation (the real test)
    const fileResult = await validateFileAccess(fileId);
    if (!fileResult.isValid) {
      console.log('❌ [SUPER AGGRESSIVE] File access validation failed - CROSS-ACCOUNT DETECTED!');
      return fileResult;
    }
    
    console.log('✅ [SUPER AGGRESSIVE] ALL validation tests passed');
    return {
      isValid: true,
      accountId: basicResult.accountId,
      accountEmail: basicResult.accountEmail,
      accountName: basicResult.accountName
    };
    
  } catch (error) {
    console.log('❌ [SUPER AGGRESSIVE] Super aggressive validation failed:', error);
    return {
      isValid: false,
      reason: 'Super aggressive validation failed',
      error: (error as Error).message,
      shouldShowBanner: true,
      sessionMismatch: true
    };
  }
} 