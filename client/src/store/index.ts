/* eslint-disable @typescript-eslint/no-explicit-any */
import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import type { User, ImageFile, ProcessingOptions, ProcessingResult, UpscaleWarning, Step } from '../types'

interface AppStore {
  isAuthenticated: boolean
  userInfo: User | null
  accessToken: string | null
  isCheckingAuth: boolean
  isRefreshing: boolean
  isLoggingIn: boolean
  loginProgress: string
  recentlyReauthorized: boolean
  lastReauthorizationTime: number
  
  // === IMAGE STATE ===
  images: ImageFile[]
  selectedImage: ImageFile | null
  thumbnailUrls: Record<string, string>
  selectedImageThumbnail: string | null
  
  // === PROCESSING STATE ===
  processingOptions: ProcessingOptions
  processingResult: ProcessingResult | null
  upscaleWarning: UpscaleWarning | null
  availableUpscaleFactors: number[]
  
  // === UI STATE ===
  currentStep: Step
  loading: boolean
  status: string
  uploadProgress: number
  processingProgress: number
  processingStage: string
  showUploadArea: boolean
  directFileId: string | null
  showAccountSwitchBanner: boolean
  showAccountMismatchBanner: boolean
  accountMismatchInfo: {
    currentAccount?: string
    storedAccount?: string
  }
  fixingAccountSwitch: boolean
  fixCountdown: number
  showNewImageNotification: boolean
  newImageCount: number
  
  // === REAUTHORIZATION INTENT PRESERVATION ===
  savedIntent: {
    route?: string
    fileId?: string
    action?: 'processing' | 'selection'
  } | null
  
  // === ACTIONS ===
  setIsAuthenticated: (auth: boolean) => void
  setUserInfo: (user: User | null) => void
  setAccessToken: (token: string | null) => void
  setIsCheckingAuth: (checking: boolean) => void
  setIsLoggingIn: (logging: boolean) => void
  setLoginProgress: (progress: string) => void
  setRecentlyReauthorized: (recent: boolean) => void
  setLastReauthorizationTime: (time: number) => void
  setImages: (images: ImageFile[]) => void
  setSelectedImage: (image: ImageFile | null) => void
  setThumbnailUrl: (id: string, url: string) => void
  setSelectedImageThumbnail: (url: string | null) => void
  updateProcessingOptions: (options: Partial<ProcessingOptions>) => void
  setProcessingResult: (result: ProcessingResult | null) => void
  setCurrentStep: (step: Step) => void
  setLoading: (loading: boolean) => void
  setStatus: (status: string) => void
  setDirectFileId: (id: string | null) => void
  setShowAccountSwitchBanner: (show: boolean) => void
  setShowAccountMismatchBanner: (show: boolean) => void
  setAccountMismatchInfo: (info: { currentAccount?: string; storedAccount?: string; error?: string }) => void
  setUpscaleWarning: (warning: UpscaleWarning | null) => void
  setAvailableUpscaleFactors: (factors: number[]) => void
  setProcessingProgress: (progress: number) => void
  setProcessingStage: (stage: string) => void
  setShowUploadArea: (show: boolean) => void
  setUploadProgress: (progress: number) => void
  setShowNewImageNotification: (show: boolean) => void
  setNewImageCount: (count: number) => void
  setSavedIntent: (intent: { route?: string; fileId?: string; action?: 'processing' | 'selection' } | null) => void
  
  // === COMPLEX ACTIONS ===
  clearAuth: () => void
  clearAllUserData: () => void
}

export const useAppStore = create<AppStore>()(
  devtools(
    (set) => ({
      // === INITIAL STATE ===
      isAuthenticated: false,
      userInfo: null,
      accessToken: null,
      isCheckingAuth: true,
      isRefreshing: false,
      isLoggingIn: false,
      loginProgress: '',
      recentlyReauthorized: false,
      lastReauthorizationTime: 0,
      
      // === IMAGE STATE ===
      images: [],
      selectedImage: null,
      thumbnailUrls: {},
      selectedImageThumbnail: null,
      
      // === PROCESSING STATE ===
      processingOptions: {
        outputFormat: 'cutout',
        backgroundBlur: 0,
        scaleMode: 'fit',
        autoCenter: false,
        strokeSize: 0,
        strokeColor: 'FFFFFF',
        strokeOpacity: 100,
        shadowMode: 'disabled',
        shadowOpacity: 20,
        shadowBlur: 50,
        format: 'PNG'
      },
      processingResult: null,
      upscaleWarning: null,
      availableUpscaleFactors: [2, 4, 6, 8],
      
      // === UI STATE ===
      currentStep: 'selection',
      loading: false,
      status: '',
      uploadProgress: 0,
      processingProgress: 0,
      processingStage: '',
      showUploadArea: false,
      directFileId: null,
      showAccountSwitchBanner: false,
      showAccountMismatchBanner: false,
      accountMismatchInfo: {},
      fixingAccountSwitch: false,
      fixCountdown: 0,
      showNewImageNotification: false,
      newImageCount: 0,
      savedIntent: null,
      
      // === ACTIONS ===
      setIsAuthenticated: (isAuthenticated) => set({ isAuthenticated }),
      setUserInfo: (userInfo) => set({ userInfo }),
      setAccessToken: (accessToken) => set({ accessToken }),
      setIsCheckingAuth: (isCheckingAuth) => set({ isCheckingAuth }),
      setIsLoggingIn: (isLoggingIn) => set({ isLoggingIn }),
      setLoginProgress: (loginProgress) => set({ loginProgress }),
      setRecentlyReauthorized: (recentlyReauthorized) => set({ recentlyReauthorized }),
      setLastReauthorizationTime: (lastReauthorizationTime) => set({ lastReauthorizationTime }),
      setImages: (images) => set({ images }),
      setSelectedImage: (selectedImage) => set({ selectedImage }),
      setThumbnailUrl: (id, url) => set((state) => ({
        thumbnailUrls: { ...state.thumbnailUrls, [id]: url }
      })),
      setSelectedImageThumbnail: (selectedImageThumbnail) => set({ selectedImageThumbnail }),
      updateProcessingOptions: (options) => set((state) => ({
        processingOptions: { ...state.processingOptions, ...options }
      })),
      setProcessingResult: (processingResult) => set({ processingResult }),
      setCurrentStep: (currentStep) => set({ currentStep }),
      setLoading: (loading) => set({ loading }),
      setStatus: (status) => set({ status }),
      setDirectFileId: (directFileId) => set({ directFileId }),
      setShowAccountSwitchBanner: (showAccountSwitchBanner) => set({ showAccountSwitchBanner }),
      setShowAccountMismatchBanner: (showAccountMismatchBanner) => set({ showAccountMismatchBanner }),
      setAccountMismatchInfo: (accountMismatchInfo) => set({ accountMismatchInfo }),
      setUpscaleWarning: (upscaleWarning) => set({ upscaleWarning }),
      setAvailableUpscaleFactors: (availableUpscaleFactors) => set({ availableUpscaleFactors }),
      setProcessingProgress: (processingProgress) => set({ processingProgress }),
      setProcessingStage: (processingStage) => set({ processingStage }),
      setShowUploadArea: (showUploadArea) => set({ showUploadArea }),
      setUploadProgress: (uploadProgress) => set({ uploadProgress }),
      setShowNewImageNotification: (showNewImageNotification) => set({ showNewImageNotification }),
      setNewImageCount: (newImageCount) => set({ newImageCount }),
      setSavedIntent: (savedIntent: { route?: string; fileId?: string; action?: 'processing' | 'selection' } | null) => set({ savedIntent }),
      
      clearAuth: () => {
        console.log('🔒 Clearing authentication state')
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        localStorage.removeItem('user_id')
        localStorage.removeItem('user_info')
        localStorage.removeItem('token_expires_at')
        localStorage.removeItem('code_verifier')
        localStorage.removeItem('post_login_redirect')
        
        set({
          accessToken: null,
          isAuthenticated: false,
          userInfo: null,
          isCheckingAuth: false
        })
      },
      
      clearAllUserData: () => {
        console.log('🧹 Clearing all user data...')
        
        // Clear localStorage
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        localStorage.removeItem('user_id')
        localStorage.removeItem('user_info')
        localStorage.removeItem('token_expires_at')
        localStorage.removeItem('code_verifier')
        localStorage.removeItem('post_login_redirect')
        localStorage.removeItem('recentlyReauthorized')
        localStorage.removeItem('lastReauthorizationTime')
        
        // Clear React state
        set({
          accessToken: null,
          isAuthenticated: false,
          userInfo: null,
          showAccountSwitchBanner: false,
          fixingAccountSwitch: false,
          recentlyReauthorized: false,
          lastReauthorizationTime: 0,
          images: [],
          selectedImage: null,
          selectedImageThumbnail: null,
          thumbnailUrls: {},
          processingResult: null,
          currentStep: 'selection',
          loading: false,
          processingProgress: 0,
          processingStage: '',
          uploadProgress: 0
          // savedIntent: preserved during reauthorization
        })
        
        console.log('✅ All user data cleared')
      }
    }),
    { name: 'picsart-dropbox-store' }
  )
)

// Make store globally accessible for axios interceptor
if (typeof window !== 'undefined') {
  (window as any).useAppStore = useAppStore
}