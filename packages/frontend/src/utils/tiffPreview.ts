/**
 * Utility for generating TIFF/BMP preview using backend service
 */

import apiClient from '@/lib/apiClient';

/**
 * Generate a preview for TIFF/BMP files using backend conversion
 * @param file The file to generate preview for
 * @returns Promise with blob URL of the preview or null if failed
 */
export async function generateTiffPreview(file: File): Promise<string | null> {
  try {
    // Check if it's a TIFF or BMP file
    const ext = file.name.toLowerCase();
    const isTiff = ext.endsWith('.tiff') || ext.endsWith('.tif');
    const isBmp = ext.endsWith('.bmp');

    if (!isTiff && !isBmp) {
      // For other formats, use regular blob URL
      return URL.createObjectURL(file);
    }

    // For TIFF files, we need server-side conversion
    // Send to backend for conversion
    const formData = new FormData();
    formData.append('file', file); // Backend expects 'file' field name

    try {
      // Use the preview endpoint which handles TIFF/BMP conversion
      const response = await apiClient.post('/api/preview/generate', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        responseType: 'blob',
      });

      // Create blob URL from response
      return URL.createObjectURL(response.data);
    } catch (error) {
      console.warn('Server-side TIFF conversion failed, using fallback preview', error);
      // Fall back to canvas preview
      return generateCanvasPreview(file);
    }
  } catch (error) {
    console.error('Failed to generate TIFF/BMP preview:', error);
    return null;
  }
}

/**
 * Generate a canvas-based preview with file info
 * Used as fallback when server preview fails
 */
export function generateCanvasPreview(file: File): string {
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
