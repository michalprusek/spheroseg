/**
 * Client-side preview generation for BMP and TIFF files
 * Uses Canvas API for instant preview generation without server round-trip
 */

/**
 * Generate a client-side preview for BMP files using Canvas
 * @param file The BMP file to generate preview for
 * @returns Promise with data URL of the preview
 */
export async function generateBmpPreview(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const img = new Image();
      
      img.onload = () => {
        // Create canvas for preview
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error('Failed to get canvas context'));
          return;
        }
        
        // Set max dimensions for preview
        const maxSize = 400;
        let width = img.width;
        let height = img.height;
        
        // Calculate scaling to fit within maxSize
        if (width > height) {
          if (width > maxSize) {
            height = (height * maxSize) / width;
            width = maxSize;
          }
        } else {
          if (height > maxSize) {
            width = (width * maxSize) / height;
            height = maxSize;
          }
        }
        
        // Set canvas dimensions
        canvas.width = width;
        canvas.height = height;
        
        // Draw scaled image
        ctx.drawImage(img, 0, 0, width, height);
        
        // Convert to data URL
        const dataUrl = canvas.toDataURL('image/png', 0.9);
        resolve(dataUrl);
      };
      
      img.onerror = () => {
        reject(new Error('Failed to load BMP image'));
      };
      
      // Set image source to the file data
      img.src = e.target?.result as string;
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read BMP file'));
    };
    
    // Read file as data URL
    reader.readAsDataURL(file);
  });
}

/**
 * Generate a fallback preview showing file info
 * Used when actual image preview is not possible
 */
export function generateFallbackPreview(file: File): string {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  canvas.width = 200;
  canvas.height = 200;
  
  if (ctx) {
    // Draw background
    ctx.fillStyle = '#f3f4f6';
    ctx.fillRect(0, 0, 200, 200);
    
    // Draw file icon
    ctx.fillStyle = '#9ca3af';
    ctx.fillRect(60, 40, 80, 100);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(65, 45, 70, 90);
    
    // Add file type text
    ctx.fillStyle = '#374151';
    ctx.font = 'bold 20px Arial';
    ctx.textAlign = 'center';
    const ext = file.name.split('.').pop()?.toUpperCase() || 'FILE';
    ctx.fillText(ext, 100, 90);
    
    // Add file name
    ctx.font = '12px Arial';
    ctx.fillStyle = '#6b7280';
    const fileName = file.name.length > 20 ? file.name.substring(0, 17) + '...' : file.name;
    ctx.fillText(fileName, 100, 160);
    
    // Add file size
    const fileSize = (file.size / (1024 * 1024)).toFixed(2) + ' MB';
    ctx.fillText(fileSize, 100, 175);
  }
  
  return canvas.toDataURL('image/png');
}

/**
 * Check if browser supports reading the file format
 * @param file The file to check
 * @returns true if browser can likely display the format
 */
export function canBrowserDisplayFormat(file: File): boolean {
  const supportedFormats = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
  
  // Check MIME type
  if (supportedFormats.includes(file.type)) {
    return true;
  }
  
  // Check file extension for BMP (browser support varies)
  const ext = file.name.toLowerCase();
  if (ext.endsWith('.bmp')) {
    // Most modern browsers support BMP
    return true;
  }
  
  return false;
}

/**
 * Generate client-side preview for any image file
 * Attempts client-side preview first, falls back to server if needed
 */
export async function generateClientSidePreview(file: File): Promise<string | null> {
  try {
    const ext = file.name.toLowerCase();
    
    // For TIFF files, we still need server-side conversion
    if (ext.endsWith('.tiff') || ext.endsWith('.tif')) {
      return null; // Signal that server-side preview is needed
    }
    
    // For BMP files, try client-side preview
    if (ext.endsWith('.bmp') || file.type === 'image/bmp') {
      try {
        return await generateBmpPreview(file);
      } catch (error) {
        console.warn('Failed to generate BMP preview client-side:', error);
        return generateFallbackPreview(file);
      }
    }
    
    // For other supported formats, create blob URL directly
    if (canBrowserDisplayFormat(file)) {
      return URL.createObjectURL(file);
    }
    
    // For unsupported formats, return null to trigger server-side preview
    return null;
  } catch (error) {
    console.error('Error in client-side preview generation:', error);
    return null;
  }
}