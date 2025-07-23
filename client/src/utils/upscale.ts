/**
 * Upscale utility functions for safe factor calculation
 * Based on Picsart API limits and image characteristics
 */

export interface ImageData {
  size: number;
  width?: number;
  height?: number;
  name?: string;
  path?: string;
}

export interface UpscaleWarning {
  show: boolean;
  message: string;
  type: 'dimension' | 'filesize' | 'general';
}

/**
 * Calculate safe upscale factors based on official Picsart API documentation
 * 
 * Official API Limitations:
 * - Images can be upscaled up to 8 times
 * - Images can be upscaled with outputs up to 4800x4800 (16 Mpx)
 * - Supported formats: JPG, PNG, TIFF, WEBP
 * 
 * Input Image Maximum Recommended Resolution by Factor:
 * - Factor 2: Max input 2000x2000
 * - Factor 4: Max input 1024x1024  
 * - Factor 6: Max input 800x800
 * - Factor 8: Max input 600x600
 */
export function calculateSafeUpscaleFactors(imageData: ImageData): number[] {
  const width = imageData.width || 0;
  const height = imageData.height || 0;
  console.log('📊 Dimension Debug - width:', width, 'height:', height);
  
  console.log('📊 Upscale factor calculation:', {
    dimensions: width + '×' + height
  });
  
  // If no dimensions available, cannot determine upscale factors
  if (width === 0 || height === 0) {
    console.log('❌ No image dimensions available - cannot calculate upscale factors');
    return [];
  }
  
  const safeFactors: number[] = [];
  
  // Official API limits - check each factor individually based on PIXEL DIMENSIONS only
  const factorLimits = [
    { factor: 2, maxWidth: 2000, maxHeight: 2000 },
    { factor: 4, maxWidth: 1024, maxHeight: 1024 },
    { factor: 6, maxWidth: 800, maxHeight: 800 },
    { factor: 8, maxWidth: 600, maxHeight: 600 }
  ];
  
  for (const limit of factorLimits) {
    // Check if input dimensions are within recommended limits
    const inputWithinLimits = width <= limit.maxWidth && height <= limit.maxHeight;
    
    // Check if output dimensions would be within API limits (4800x4800)
    const outputWidth = width * limit.factor;
    const outputHeight = height * limit.factor;
    const outputWithinLimits = outputWidth <= 4800 && outputHeight <= 4800;
    
    if (inputWithinLimits && outputWithinLimits) {
      safeFactors.push(limit.factor);
      console.log(`✅ Factor ${limit.factor}x available - input ${width}×${height} ≤ ${limit.maxWidth}×${limit.maxHeight}, output ${outputWidth}×${outputHeight} ≤ 4800×4800`);
    } else {
      if (!inputWithinLimits) {
        console.log(`❌ Factor ${limit.factor}x not available - input ${width}×${height} > ${limit.maxWidth}×${limit.maxHeight}`);
      }
      if (!outputWithinLimits) {
        console.log(`❌ Factor ${limit.factor}x not available - output ${outputWidth}×${outputHeight} > 4800×4800`);
      }
    }
  }
  
  if (safeFactors.length === 0) {
    console.log('🚫 No safe upscale factors available for image ' + width + '×' + height);
  } else {
    console.log('✅ Available upscale factors: ' + safeFactors.join('x, ') + 'x');
  }
  
  return safeFactors;
}

/**
 * Generate upscale warning message based on official Picsart API limitations (pixel dimensions only)
 */
export function generateUpscaleWarning(imageData: ImageData): UpscaleWarning {
  const width = imageData.width || 0;
  const height = imageData.height || 0;
  
  let message = 'This image cannot be upscaled.';
  let type: 'dimension' | 'filesize' | 'general' = 'general';
  
  if (width === 0 || height === 0) {
    message = 'Image dimensions are unknown. Cannot determine upscale compatibility.';
    type = 'general';
  } else if (width > 2000 || height > 2000) {
    message = `This image (${width}×${height}) exceeds the maximum input size for upscaling (2000×2000 for any factor).`;
    type = 'dimension';
  } else {
    // This shouldn't happen if called correctly, but provide a fallback
    message = `This image (${width}×${height}) cannot be upscaled with any available factors.`;
    type = 'dimension';
  }
  
  message += ' Try background removal only or use a smaller image.';
  
  return {
    show: true,
    message,
    type
  };
}

/**
 * Check if upscaling is safe for the given image and factor
 */
export function isUpscaleSafe(imageData: ImageData, factor: number): boolean {
  const safeFactors = calculateSafeUpscaleFactors(imageData);
  return safeFactors.includes(factor);
}

/**
 * Get recommended upscale factor (first/lowest safe factor)
 */
export function getRecommendedUpscaleFactor(imageData: ImageData): number | null {
  const safeFactors = calculateSafeUpscaleFactors(imageData);
  return safeFactors.length > 0 ? safeFactors[0] : null;
}

/**
 * Format upscale factor options for UI display
 */
export function formatUpscaleOptions(imageData: ImageData): Array<{ value: number; label: string; recommended?: boolean }> {
  const safeFactors = calculateSafeUpscaleFactors(imageData);
  
  return safeFactors.map((factor, index) => ({
    value: factor,
    label: `${factor}x${index === 0 ? ' (Recommended)' : ''}`,
    recommended: index === 0
  }));
}

/**
 * Get upscale info message for UI display
 */
export function getUpscaleInfoMessage(imageData: ImageData): string {
  const safeFactors = calculateSafeUpscaleFactors(imageData);
  const sizeInMB = (imageData.size / 1024 / 1024).toFixed(1);
  
  if (safeFactors.length === 0) {
    return `⚠️ File is too large (${sizeInMB}MB) for safe upscaling. Try a smaller image or use background removal only.`;
  } else {
    return `✅ ${safeFactors.length} safe option${safeFactors.length > 1 ? 's' : ''} for ${sizeInMB}MB image. Factors limited to prevent crashes.`;
  }
} 