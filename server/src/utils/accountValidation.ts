import { Request, Response } from 'express';
import { Dropbox } from 'dropbox';
import fetch from 'node-fetch';

export interface ServerValidationResult {
  isValid: boolean;
  accountId?: string;
  accountEmail?: string;
  accountName?: string;
  error?: string;
  shouldReauth?: boolean;
  blockExecution?: boolean;
}

export interface ValidationContext {
  accessToken: string;
  claimedUserId: string;
  requestPath: string;
  userAgent?: string;
}

// Simple boolean validation for middleware compatibility
export async function validateAccountTokenMatch(
  accessToken: string, 
  claimedUserId: string
): Promise<boolean> {
  try {
    console.log('🔍 [VALIDATE] Simple account validation check...');
    console.log('🔍 [VALIDATE] Claimed user ID:', claimedUserId);
    
    if (!accessToken || !claimedUserId) {
      console.log('🔒 [VALIDATE] Missing credentials');
      return false;
    }
    
    // Call Dropbox API to get current account info
    const dbx = new Dropbox({ accessToken, fetch });
    const currentAccount = await dbx.usersGetCurrentAccount();
    const currentAccountId = currentAccount.result.account_id;
    const currentAccountEmail = currentAccount.result.email;
    
    console.log('🔍 [VALIDATE] Token account:', currentAccountId, '(' + currentAccountEmail + ')');
    
    // Compare current account with claimed user ID
    if (currentAccountId !== claimedUserId) {
      console.log('🚨 [VALIDATE] Account mismatch detected!');
      console.log('🚨 [VALIDATE] Token belongs to:', currentAccountId, '(' + currentAccountEmail + ')');
      console.log('🚨 [VALIDATE] Request claims user:', claimedUserId);
      return false;
    }
    
    console.log('✅ [VALIDATE] Account validation passed');
    return true;
    
  } catch (error) {
    console.log('❌ [VALIDATE] Account validation failed:', (error as Error).message);
    return false;
  }
}

// CRITICAL SECURITY: Server-side account validation (detailed version)
export async function validateAccountTokenMatchDetailed(
  accessToken: string, 
  claimedUserId: string, 
  context: string = 'unknown'
): Promise<ServerValidationResult> {
  try {
    console.log(`🔍 [${context}] Server account validation initiated`);
    console.log(`🔍 [${context}] Claimed user ID: ${claimedUserId}`);
    
    if (!accessToken || !claimedUserId) {
      console.log(`🔒 [${context}] Missing credentials: token=${!!accessToken}, userId=${!!claimedUserId}`);
      return {
        isValid: false,
        error: 'Missing token or user ID',
        shouldReauth: true,
        blockExecution: true
      };
    }
    
    // Call Dropbox API to get current account info
    const dbx = new Dropbox({ accessToken, fetch });
    const currentAccount = await dbx.usersGetCurrentAccount();
    const currentAccountId = currentAccount.result.account_id;
    const currentAccountEmail = currentAccount.result.email;
    const currentAccountName = currentAccount.result.name.display_name;
    
    console.log(`🔍 [${context}] Current account details:`);
    console.log(`🔍 [${context}]   ID: ${currentAccountId}`);
    console.log(`🔍 [${context}]   Email: ${currentAccountEmail}`);
    console.log(`🔍 [${context}]   Name: ${currentAccountName}`);
    
    // Compare current account with claimed user ID
    if (currentAccountId !== claimedUserId) {
      console.log(`🚨 [${context}] SECURITY ALERT: Account mismatch detected!`);
      console.log(`🚨 [${context}] Token belongs to: ${currentAccountId} (${currentAccountEmail})`);
      console.log(`🚨 [${context}] Request claims user: ${claimedUserId}`);
      console.log(`🚨 [${context}] BLOCKING REQUEST - User has switched Dropbox accounts!`);
      
      return {
        isValid: false,
        error: 'Account mismatch detected',
        shouldReauth: true,
        blockExecution: true,
        accountId: currentAccountId,
        accountEmail: currentAccountEmail,
        accountName: currentAccountName
      };
    }
    
    console.log(`✅ [${context}] Account validation passed - user matches token`);
    console.log(`✅ [${context}] Confirmed user: ${currentAccountEmail}`);
    
    return {
      isValid: true,
      accountId: currentAccountId,
      accountEmail: currentAccountEmail,
      accountName: currentAccountName,
      blockExecution: false
    };
    
  } catch (error) {
    console.log(`❌ [${context}] Account validation failed: ${(error as Error).message}`);
    console.log(`❌ [${context}] Error details:`, error);
    
    // Token is invalid/expired
    return {
      isValid: false,
      error: (error as Error).message,
      shouldReauth: true,
      blockExecution: true
    };
  }
}

// Middleware-specific validation with immediate response
export async function validateAccountMiddleware(
  req: Request, 
  res: Response, 
  next: Function
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    const userId = req.headers['x-user-id'] as string;
    const requestPath = req.path;
    const userAgent = req.headers['user-agent'];
    
    if (!authHeader) {
      console.log('🔒 [MIDDLEWARE] No authorization header');
      res.status(401).json({ 
        error: 'No authorization header',
        shouldReauth: true,
        blockExecution: true
      });
      return;
    }
    
    if (!userId) {
      console.log('🔒 [MIDDLEWARE] No user ID header');
      res.status(401).json({ 
        error: 'No user ID header',
        shouldReauth: true,
        blockExecution: true
      });
      return;
    }
    
    const accessToken = authHeader.replace('Bearer ', '');
    const context = `MIDDLEWARE:${requestPath}`;
    
    console.log(`🔍 [${context}] Validating request from ${userAgent?.substring(0, 50)}...`);
    
    const validation = await validateAccountTokenMatchDetailed(accessToken, userId, context);
    
    if (!validation.isValid) {
      console.log(`🚨 [${context}] BLOCKING REQUEST - Validation failed: ${validation.error}`);
      
      res.status(validation.shouldReauth ? 401 : 403).json({
        error: validation.error || 'Account validation failed',
        shouldReauth: validation.shouldReauth,
        blockExecution: validation.blockExecution,
        message: validation.error === 'Account mismatch detected' 
          ? `Token belongs to ${validation.accountEmail} but request claims ${userId}`
          : 'Authentication validation failed'
      });
      return;
    }
    
    // Add validated account info to request
    req.currentAccountId = validation.accountId;
    // Note: accountEmail and accountName are available in validation object if needed
    
    console.log(`✅ [${context}] Request authorized for user: ${validation.accountEmail}`);
    next();
    
  } catch (error) {
    console.error('❌ [MIDDLEWARE] Account validation middleware failed:', error);
    res.status(500).json({
      error: 'Internal validation error',
      shouldReauth: true,
      blockExecution: true
    });
  }
}

// Pre-operation validation for sensitive endpoints
export async function validateBeforeOperation(
  req: Request, 
  res: Response, 
  operationName: string
): Promise<boolean> {
  try {
    const authHeader = req.headers.authorization;
    const userId = req.headers['x-user-id'] as string;
    
    if (!authHeader || !userId) {
      console.log(`🔒 [${operationName}] Missing credentials`);
      res.status(401).json({
        error: 'Missing authentication credentials',
        shouldReauth: true,
        blockExecution: true
      });
      return false;
    }
    
    const accessToken = authHeader.replace('Bearer ', '');
    const context = `OPERATION:${operationName}`;
    
    console.log(`🔒 [${context}] Validating account before operation...`);
    
    const validation = await validateAccountTokenMatchDetailed(accessToken, userId, context);
    
    if (!validation.isValid) {
      console.log(`🚨 [${context}] OPERATION BLOCKED - Validation failed: ${validation.error}`);
      
      res.status(validation.shouldReauth ? 401 : 403).json({
        error: validation.error || 'Account validation failed',
        shouldReauth: validation.shouldReauth,
        blockExecution: validation.blockExecution,
        operationBlocked: operationName
      });
      return false;
    }
    
    console.log(`✅ [${context}] Operation authorized for user: ${validation.accountEmail}`);
    return true;
    
  } catch (error) {
    console.error(`❌ [${operationName}] Operation validation failed:`, error);
    res.status(500).json({
      error: 'Internal validation error',
      shouldReauth: true,
      blockExecution: true,
      operationBlocked: operationName
    });
    return false;
  }
}

// Enhanced logging for security events
export function logSecurityEvent(
  event: string, 
  context: string, 
  details: any, 
  severity: 'INFO' | 'WARNING' | 'CRITICAL' = 'INFO'
): void {
  const timestamp = new Date().toISOString();
  const logPrefix = severity === 'CRITICAL' ? '🚨' : severity === 'WARNING' ? '⚠️' : '📋';
  
  console.log(`${logPrefix} [${severity}] [${timestamp}] [${context}] ${event}`);
  
  if (details && typeof details === 'object') {
    console.log(`${logPrefix} [${severity}] [${context}] Details:`, details);
  }
  
  // In a production environment, you might want to send critical events to a monitoring system
  if (severity === 'CRITICAL') {
    // TODO: Send to monitoring/alerting system
    console.log(`🚨 [SECURITY] Critical security event logged: ${event}`);
  }
}

// Validation result handler
export function handleValidationFailure(
  res: Response, 
  validation: ServerValidationResult, 
  context: string
): void {
  logSecurityEvent(
    `Account validation failed: ${validation.error}`,
    context,
    {
      error: validation.error,
      shouldReauth: validation.shouldReauth,
      blockExecution: validation.blockExecution
    },
    'WARNING'
  );
  
  res.status(validation.shouldReauth ? 401 : 403).json({
    error: validation.error || 'Account validation failed',
    shouldReauth: validation.shouldReauth,
    blockExecution: validation.blockExecution,
    context: context
  });
} 