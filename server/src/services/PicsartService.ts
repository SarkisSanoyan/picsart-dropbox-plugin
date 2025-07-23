import FormData from 'form-data';
import fetch from 'node-fetch';
import { Agent } from 'https';

export class PicsartService {
  private apiKey: string;
  private httpsAgent: Agent;

  constructor() {
    this.apiKey = process.env.PICSART_API_KEY || '';
    if (!this.apiKey) {
      console.error('❌ PICSART_API_KEY is not set in environment variables');
      console.error('💡 Please add PICSART_API_KEY to your .env file');
      console.error('💡 Get your API key from: https://picsart.io/api/');
      throw new Error('PICSART_API_KEY is not set in environment variables');
    }
    
    // Configure HTTPS agent for better connection handling
    this.httpsAgent = new Agent({
      keepAlive: true,
      maxSockets: 5,
      maxFreeSockets: 2,
      timeout: 15000,
    });
    
    console.log('✅ PicsartService initialized with API key:', this.apiKey.substring(0, 8) + '...');
    
    // Pre-warm the API connection in background
    this.warmUpConnection();
  }

  // Pre-warm API connection to avoid cold start delays
  private async warmUpConnection(): Promise<void> {
    try {
      console.log('🔥 [PICSART] Warming up API connection...');
      // Make a lightweight test call to establish connection
      const warmupResult = await this.testConnection();
      if (warmupResult) {
        console.log('✅ [PICSART] API connection warmed up successfully');
      } else {
        console.log('⚠️ [PICSART] API warmup failed, will retry on first real request');
      }
    } catch (error) {
      console.log('⚠️ [PICSART] API warmup failed:', (error as Error).message);
    }
  }

  // Helper to create fetch options with fresh connection if needed
  private createFetchOptions(options: any, attempt: number): any {
    // Use progressive timeouts: 10s, 15s, 30s, 45s, 60s
    const timeout = Math.min(10000 + (attempt * 5000), 60000);
    
    return {
      ...options,
      timeout,
      agent: this.httpsAgent,
      // Force new connection after rate limit issues
      headers: {
        ...options.headers,
        'Connection': attempt > 2 ? 'close' : 'keep-alive',
      }
    };
  }

  // Function to call Picsart RemoveBG API (Updated to latest API)
  async removeBg(imageBuffer: Buffer): Promise<Buffer> {
    try {
      console.log('🎨 [PICSART] Starting background removal...');
      console.log('🎨 [PICSART] Image size:', imageBuffer.length, 'bytes');

      const form = new FormData();
      form.append('output_type', 'cutout');
      form.append('bg_blur', '0');
      form.append('scale', 'fit');
      form.append('auto_center', 'false');
      form.append('stroke_size', '0');
      form.append('stroke_color', 'FFFFFF');
      form.append('stroke_opacity', '100');
      form.append('shadow', 'disabled');
      form.append('shadow_opacity', '20');
      form.append('shadow_blur', '50');
      form.append('format', 'PNG');
      form.append('image', imageBuffer, { 
        filename: 'image.png',
        contentType: 'image/png'
      });

      const baseOptions = {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'X-Picsart-API-Key': this.apiKey,
          ...form.getHeaders(),
        },
        body: form,
      };

      console.log('🎨 [PICSART] Calling Picsart RemoveBG API...');
      console.log('🎨 [PICSART] API Key:', this.apiKey.substring(0, 8) + '...');
      
      // API call with smart retry logic
      let res;
      let lastApiError;
      const maxApiRetries = 5;
      
      for (let attempt = 1; attempt <= maxApiRetries; attempt++) {
        try {
          console.log(`🔄 [PICSART] API attempt ${attempt}/${maxApiRetries}...`);
          
          // Use progressive timeout and connection strategy
          const options = this.createFetchOptions(baseOptions, attempt);
          
          res = await fetch('https://api.picsart.io/tools/1.0/removebg', options);
          
          console.log('🎨 [PICSART] Response status:', res.status);
          console.log('🎨 [PICSART] Response headers:', res.headers.raw());

          if (res.ok) {
            break; // Success, exit retry loop
          }

          if (res.status === 429) {
            // Smart rate limit handling - fast initial retries, then exponential backoff
            const waitTime = attempt <= 2 ? 
              1000 * attempt :  // Fast: 1s, 2s for first attempts
              Math.min(Math.pow(2, attempt - 2) * 3000, 15000); // Then: 3s, 6s, 12s max
            console.log(`⏳ [PICSART] API rate limited (429), waiting ${waitTime}ms before retry ${attempt}/${maxApiRetries}...`);
            
            if (attempt < maxApiRetries) {
              await new Promise(resolve => setTimeout(resolve, waitTime));
              // Reset connection after rate limit
              this.httpsAgent.destroy();
              this.httpsAgent = new Agent({
                keepAlive: true,
                maxSockets: 5,
                maxFreeSockets: 2,
                timeout: 15000,
              });
              continue;
            }
          }

          // Handle other errors immediately (don't retry non-recoverable errors)
          const errText = await res.text();
          console.error('❌ [PICSART] RemoveBG failed with status:', res.status);
          console.error('❌ [PICSART] Error response:', errText);
          
          if (res.status === 401) {
            throw new Error(`Invalid Picsart API key. Please check your PICSART_API_KEY environment variable. Status: ${res.status}`);
          } else if (res.status === 402) {
            throw new Error(`Picsart API quota exceeded or payment required. Status: ${res.status}`);
          } else if (res.status === 429) {
            lastApiError = new Error(`Picsart API rate limit exceeded. Please try again later. Status: ${res.status}`);
          } else {
            throw new Error(`Picsart RemoveBG failed (${res.status}): ${errText}`);
          }
          break;

        } catch (error) {
          lastApiError = error instanceof Error ? error : new Error('API call failed');
          console.error(`❌ [PICSART] API attempt ${attempt} failed:`, lastApiError.message);
          
          // Handle network errors (socket hang up, timeout, etc.)
          const isNetworkError = lastApiError.message.includes('socket hang up') || 
                                 lastApiError.message.includes('timeout') ||
                                 lastApiError.message.includes('ECONNRESET');
          
          if (attempt < maxApiRetries && isNetworkError) {
            // Fast retry for network errors, but reset connection
            const waitTime = attempt <= 2 ? 500 * attempt : 2000; // 0.5s, 1s, then 2s
            console.log(`⏳ [PICSART] Network error, waiting ${waitTime}ms before retry...`);
            
            // Reset connection pool after network errors
            this.httpsAgent.destroy();
            this.httpsAgent = new Agent({
              keepAlive: true,
              maxSockets: 5,
              maxFreeSockets: 2,
              timeout: 15000,
            });
            
            await new Promise(resolve => setTimeout(resolve, waitTime));
          } else if (attempt === maxApiRetries) {
            throw lastApiError;
          }
        }
      }

      if (!res?.ok) {
        console.error('❌ [PICSART] All API attempts failed. Last status:', res?.status);
        throw lastApiError || new Error('Picsart API failed after retries');
      }

      // Parse JSON response to get image URL
      const jsonResponse = await res.json();
      console.log('✅ [PICSART] API responded with:', jsonResponse);

      // Handle different response formats
      if (jsonResponse.status !== 'success') {
        console.error('❌ [PICSART] API returned non-success status:', jsonResponse);
        throw new Error(`Picsart API error: ${JSON.stringify(jsonResponse)}`);
      }

      if (!jsonResponse.data?.url) {
        console.error('❌ [PICSART] No image URL in response:', jsonResponse);
        throw new Error(`Picsart API error: No image URL returned. Response: ${JSON.stringify(jsonResponse)}`);
      }

      const imageUrl = jsonResponse.data.url;
      console.log('📥 [PICSART] Downloading processed image from:', imageUrl);

      // Download the processed image from the URL with retry logic for rate limits
      let imageResponse;
      let lastDownloadError;
      const maxRetries = 5; // Increased from 3 to 5 for persistent CDN rate limiting
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`🔄 [PICSART] Download attempt ${attempt}/${maxRetries}...`);
          
          // Use progressive timeout for downloads
          const downloadOptions = this.createFetchOptions({}, attempt);
          imageResponse = await fetch(imageUrl, downloadOptions);
          
          if (imageResponse.ok) {
            break; // Success, exit retry loop
          }
          
          if (imageResponse.status === 429) {
            // Fast retry for CDN rate limiting
            const waitTime = attempt <= 2 ? 
              500 * attempt :  // Fast: 0.5s, 1s for first attempts
              Math.min(Math.pow(2, attempt - 2) * 2000, 10000); // Then: 2s, 4s, 8s max
            console.log(`⏳ [PICSART] CDN rate limited (429), waiting ${waitTime}ms before retry ${attempt}/${maxRetries}...`);
            
            if (attempt < maxRetries) {
              await new Promise(resolve => setTimeout(resolve, waitTime));
              continue;
            }
          }
          
          // Non-429 error or final attempt - break and handle below
          lastDownloadError = new Error(`Failed to download processed image: ${imageResponse.status}`);
          break;
          
        } catch (error) {
          lastDownloadError = error instanceof Error ? error : new Error('Download failed');
          console.error(`❌ [PICSART] Download attempt ${attempt} failed:`, lastDownloadError.message);
          
          if (attempt < maxRetries) {
            const waitTime = attempt <= 2 ? 300 * attempt : 1000; // Very fast retry: 0.3s, 0.6s, then 1s
            console.log(`⏳ [PICSART] Download error, waiting ${waitTime}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
          }
        }
      }
      
      if (!imageResponse?.ok) {
        console.error('❌ [PICSART] All download attempts failed. Last status:', imageResponse?.status);
        throw lastDownloadError || new Error('Failed to download processed image after retries');
      }

      const processedImageBuffer = Buffer.from(await imageResponse.arrayBuffer());
      console.log('✅ [PICSART] Background removed successfully, processed image size:', processedImageBuffer.length, 'bytes');

      return processedImageBuffer;
    } catch (error) {
      console.error('❌ [PICSART] RemoveBG operation failed:', error);
      
      // Enhanced error logging
      if (error instanceof Error) {
        console.error('❌ [PICSART] Error details:', {
          name: error.name,
          message: error.message,
          stack: error.stack?.split('\n').slice(0, 3).join('\n')
        });
      }
      
      throw error;
    }
  }

  // Function to call Picsart Upscale API (Updated to latest API)
  async upscale(imageBuffer: Buffer, upscaleFactor: number = 2): Promise<Buffer> {
    try {
      console.log(`🔍 [PICSART] Starting upscale with factor ${upscaleFactor}x...`);
      console.log('🔍 [PICSART] Image size:', imageBuffer.length, 'bytes');

      const form = new FormData();
      form.append('upscale_factor', upscaleFactor.toString());
      form.append('format', 'JPG');
      form.append('image', imageBuffer, { 
        filename: 'image.jpg',
        contentType: 'image/jpeg'
      });

      const baseUpscaleOptions = {
        method: 'POST',
        headers: {
          'accept': 'application/json',
          'X-Picsart-API-Key': this.apiKey,
          ...form.getHeaders(),
        },
        body: form,
      };

      console.log(`🔍 [PICSART] Calling Picsart Upscale API with factor ${upscaleFactor}x...`);
      
      // API call with smart retry logic
      let res;
      let lastUpscaleApiError;
      const maxUpscaleApiRetries = 5;
      
              for (let attempt = 1; attempt <= maxUpscaleApiRetries; attempt++) {
          try {
            console.log(`🔄 [PICSART] Upscale API attempt ${attempt}/${maxUpscaleApiRetries}...`);
            
            // Use progressive timeout and connection strategy
            const options = this.createFetchOptions(baseUpscaleOptions, attempt);
            
            res = await fetch('https://api.picsart.io/tools/1.0/upscale', options);
          
          console.log('🔍 [PICSART] Upscale response status:', res.status);

          if (res.ok) {
            break; // Success, exit retry loop
          }

          if (res.status === 429) {
            // Smart rate limit handling - fast initial retries, then exponential backoff
            const waitTime = attempt <= 2 ? 
              1000 * attempt :  // Fast: 1s, 2s for first attempts
              Math.min(Math.pow(2, attempt - 2) * 3000, 15000); // Then: 3s, 6s, 12s max
            console.log(`⏳ [PICSART] Upscale API rate limited (429), waiting ${waitTime}ms before retry ${attempt}/${maxUpscaleApiRetries}...`);
            
            if (attempt < maxUpscaleApiRetries) {
              await new Promise(resolve => setTimeout(resolve, waitTime));
              // Reset connection after rate limit
              this.httpsAgent.destroy();
              this.httpsAgent = new Agent({
                keepAlive: true,
                maxSockets: 5,
                maxFreeSockets: 2,
                timeout: 15000,
              });
              continue;
            }
          }

          // Handle other errors immediately (don't retry non-recoverable errors)
          const errText = await res.text();
          console.error('❌ [PICSART] Upscale failed with status:', res.status);
          console.error('❌ [PICSART] Error response:', errText);
          
          if (res.status === 401) {
            throw new Error(`Invalid Picsart API key. Status: ${res.status}`);
          } else if (res.status === 402) {
            throw new Error(`Picsart API quota exceeded. Status: ${res.status}`);
          } else if (res.status === 429) {
            lastUpscaleApiError = new Error(`Picsart API rate limit exceeded. Status: ${res.status}`);
          } else {
            throw new Error(`Picsart Upscale failed (${res.status}): ${errText}`);
          }
          break;

        } catch (error) {
          lastUpscaleApiError = error instanceof Error ? error : new Error('Upscale API call failed');
          console.error(`❌ [PICSART] Upscale API attempt ${attempt} failed:`, lastUpscaleApiError.message);
          
          // Handle network errors (socket hang up, timeout, etc.)
          const isNetworkError = lastUpscaleApiError.message.includes('socket hang up') || 
                                 lastUpscaleApiError.message.includes('timeout') ||
                                 lastUpscaleApiError.message.includes('ECONNRESET');
          
          if (attempt < maxUpscaleApiRetries && isNetworkError) {
            // Fast retry for network errors, but reset connection
            const waitTime = attempt <= 2 ? 500 * attempt : 2000; // 0.5s, 1s, then 2s
            console.log(`⏳ [PICSART] Network error, waiting ${waitTime}ms before retry...`);
            
            // Reset connection pool after network errors
            this.httpsAgent.destroy();
            this.httpsAgent = new Agent({
              keepAlive: true,
              maxSockets: 5,
              maxFreeSockets: 2,
              timeout: 15000,
            });
            
            await new Promise(resolve => setTimeout(resolve, waitTime));
          } else if (attempt === maxUpscaleApiRetries) {
            throw lastUpscaleApiError;
          }
        }
      }

      if (!res?.ok) {
        console.error('❌ [PICSART] All upscale API attempts failed. Last status:', res?.status);
        throw lastUpscaleApiError || new Error('Picsart Upscale API failed after retries');
      }

      // Parse JSON response to get image URL
      const jsonResponse = await res.json();
      console.log('✅ [PICSART] Upscale API responded with:', jsonResponse);

      if (jsonResponse.status !== 'success' || !jsonResponse.data?.url) {
        throw new Error(`Picsart Upscale API error: ${JSON.stringify(jsonResponse)}`);
      }

      const imageUrl = jsonResponse.data.url;
      console.log('📥 [PICSART] Downloading upscaled image from:', imageUrl);

      // Download the processed image from the URL with retry logic for rate limits
      let imageResponse;
      let lastUpscaleDownloadError;
      const maxRetries = 5; // Increased from 3 to 5 for persistent CDN rate limiting
      
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`🔄 [PICSART] Download attempt ${attempt}/${maxRetries}...`);
          
          // Use progressive timeout for downloads (longer for upscale)
          const downloadOptions = this.createFetchOptions({}, attempt);
          downloadOptions.timeout = Math.min(downloadOptions.timeout * 2, 120000); // Double timeout for upscale downloads
          imageResponse = await fetch(imageUrl, downloadOptions);
          
          if (imageResponse.ok) {
            break; // Success, exit retry loop
          }
          
          if (imageResponse.status === 429) {
            // Fast retry for CDN rate limiting
            const waitTime = attempt <= 2 ? 
              500 * attempt :  // Fast: 0.5s, 1s for first attempts
              Math.min(Math.pow(2, attempt - 2) * 2000, 10000); // Then: 2s, 4s, 8s max
            console.log(`⏳ [PICSART] CDN rate limited (429), waiting ${waitTime}ms before retry ${attempt}/${maxRetries}...`);
            
            if (attempt < maxRetries) {
              await new Promise(resolve => setTimeout(resolve, waitTime));
              continue;
            }
          }
          
          // Non-429 error or final attempt - break and handle below
          lastUpscaleDownloadError = new Error(`Failed to download upscaled image: ${imageResponse.status}`);
          break;
          
        } catch (error) {
          lastUpscaleDownloadError = error instanceof Error ? error : new Error('Download failed');
          console.error(`❌ [PICSART] Download attempt ${attempt} failed:`, lastUpscaleDownloadError.message);
          
          if (attempt < maxRetries) {
            const waitTime = attempt <= 2 ? 300 * attempt : 1000; // Very fast retry: 0.3s, 0.6s, then 1s
            console.log(`⏳ [PICSART] Download error, waiting ${waitTime}ms before retry...`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
          }
        }
      }
      
      if (!imageResponse?.ok) {
        console.error('❌ [PICSART] All download attempts failed. Last status:', imageResponse?.status);
        throw lastUpscaleDownloadError || new Error('Failed to download upscaled image after retries');
      }

      const processedImageBuffer = Buffer.from(await imageResponse.arrayBuffer());
      console.log(`✅ [PICSART] Image upscaled ${upscaleFactor}x successfully, processed image size:`, processedImageBuffer.length, 'bytes');

      return processedImageBuffer;
    } catch (error) {
      console.error('❌ [PICSART] Upscale operation failed:', error);
      throw error;
    }
  }

  // Test API connection with a lightweight approach
  async testConnection(): Promise<boolean> {
    try {
      console.log('🧪 [PICSART] Testing API connection...');
      
      // Instead of testing with removeBg (which requires valid image), 
      // just test the connection with a simple HTTP request to check API availability
      const testOptions = {
        method: 'GET',
        headers: {
          'accept': 'application/json',
          'X-Picsart-API-Key': this.apiKey,
        },
        timeout: 10000,
        agent: this.httpsAgent,
      };

      // Use a lightweight endpoint or just test the connection establishment
      const testRes = await fetch('https://api.picsart.io/tools/1.0/removebg', {
        method: 'POST',
        headers: testOptions.headers,
        body: '{}', // Empty body will get 400, but proves connection works
        timeout: testOptions.timeout,
        agent: testOptions.agent,
      });

      // Any response (even 400 Bad Request) means the connection is working
      // We're just testing connectivity, not actual processing
      const connectionWorking = testRes.status === 400 || testRes.status === 422 || testRes.status < 500;
      
      if (connectionWorking) {
        console.log('✅ [PICSART] API connection test successful (connection established)');
        return true;
      } else {
        console.log(`⚠️ [PICSART] API returned status ${testRes.status}, but connection established`);
        return true; // Even server errors mean connection is working
      }
    } catch (error) {
      console.log('⚠️ [PICSART] API connection test failed (will retry on first real request):', (error as Error).message);
      return false;
    }
  }
} 