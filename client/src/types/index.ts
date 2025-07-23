// Auth types
export interface User {
    userId: string
    email: string
    name: string
  }
  
  // Image types  
  export interface ImageFile {
    id: string
    name: string
    path_display: string
    path_lower: string
    size: number
    width?: number
    height?: number
  }
  
  export interface ProcessingOptions {
    removeBg: boolean
    upscale: boolean
    upscaleFactor: number
  }
  
  export interface ProcessingResult {
    success: boolean
    message: string
    results: {
      original?: string
      backgroundRemoved?: string
      upscaled?: string
    }
  }
  
  export interface UpscaleWarning {
    message: string
    type: 'size' | 'dimensions' | 'general'
  }
  
  // UI types
  export type Step = 'selection' | 'processing' | 'results'
  
  // Dropbox types
  export interface DropboxFileMetadata {
    '.tag': 'file'
    id: string
    name: string
    path_display: string
    path_lower: string
    size: number
    width?: number
    height?: number
  }