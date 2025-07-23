export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'
export const DROPBOX_CLIENT_ID = import.meta.env.VITE_DROPBOX_CLIENT_ID || ''
export const DROPBOX_REDIRECT_URI = import.meta.env.VITE_DROPBOX_REDIRECT_URI || 'https://dc506a4d934e.ngrok-free.app/auth'

export const STEPS = {
  SELECTION: 'selection',
  PROCESSING: 'processing',
  RESULTS: 'results'
} as const

export const DEFAULT_PROCESSING_OPTIONS = {
  removeBg: false,
  upscale: false,
  upscaleFactor: 2
}

export const UPSCALE_FACTORS = [2, 4, 6, 8]