/**
 * Helper to safely construct URL for images and other resources
 * Handles various path formats and ensures consistent URL structure
 */
export const constructUrl = (url: string | null | undefined): string => {
  if (!url) return '/placeholder.svg';

  // Debug log when there's an issue with the URL
  if (url && url.includes('undefined')) {
    console.warn(`Invalid URL detected: ${url}`);
  }

  // Handle absolute URLs (http:// or https://)
  if (url.startsWith('http://') || url.startsWith('https://')) {
    // console.log(`constructUrl output (absolute URL): ${url}`);
    return url;
  }

  // Handle Docker network URLs (pass through as is)
  if (url.includes('cellseg-backend')) {
    // console.log(`constructUrl output (Docker network URL): ${url}`);
    return url;
  }

  // Handle direct backend URLs (pass through as is)
  if (url.includes('localhost:5001') || url.includes('backend:5000') || url.includes('backend:5001')) {
    // console.log(`constructUrl output (direct backend URL): ${url}`);
    return url;
  }

  // Handle paths that start with /api/ - remove the /api prefix
  if (url.startsWith('/api/')) {
    const result = url.substring(4); // Remove the /api prefix
    // console.log(`constructUrl output (removed /api prefix): ${result}`);
    return result;
  }

  // Extract path from URL if it contains 'uploads/'
  if (url.includes('uploads/')) {
    // Fix for duplicated uploads paths (uploads/uploads/...)
    // Handle multiple occurrences of 'uploads/' in the path
    let fixedPath = url;
    while (fixedPath.includes('uploads/uploads/')) {
      fixedPath = fixedPath.replace(/uploads\/uploads\//i, 'uploads/');
      // console.log(`constructUrl output (fixed duplicated uploads path): ${fixedPath}`);
    }

    // If we made changes, return the fixed path
    if (fixedPath !== url) {
      return fixedPath;
    }

    // Otherwise extract the path after 'uploads/'
    const uploadPathMatch = url.match(/uploads\/(.*)/i);
    if (uploadPathMatch && uploadPathMatch[1]) {
      const result = `/uploads/${uploadPathMatch[1]}`;
      // console.log(`constructUrl output (extracted uploads path): ${result}`);
      return result;
    }
  }

  // Handle server-side paths that start with /app/uploads
  if (url.startsWith('/app/uploads/')) {
    const result = `/uploads/${url.split('/app/uploads/')[1]}`;
    // console.log(`constructUrl output (server-side path): ${result}`);
    return result;
  }

  // Handle paths that already have /uploads prefix
  if (url.startsWith('/uploads/')) {
    // console.log(`constructUrl output (uploads prefix): ${url}`);
    return url;
  }

  // Handle paths that have uploads/ without leading slash
  if (url.startsWith('uploads/')) {
    const result = `/${url}`;
    // console.log(`constructUrl output (uploads without leading slash): ${result}`);
    return result;
  }

  // Handle paths that start with app/uploads
  if (url.startsWith('app/uploads/')) {
    const result = `/uploads/${url.split('app/uploads/')[1]}`;
    // console.log(`constructUrl output (app/uploads path): ${result}`);
    return result;
  }

  // Handle paths that might be just filenames in the uploads directory
  if (url.includes('.jpg') || url.includes('.jpeg') || url.includes('.png') || url.includes('.gif') || url.includes('.webp')) {
    // Check if it might be a filename without path
    if (!url.includes('/')) {
      const result = `/uploads/${url}`;
      // console.log(`constructUrl output (filename only): ${result}`);
      return result;
    }
  }

  // Handle paths that start with /lovable-uploads/ or /api/lovable-uploads/ (legacy paths)
  if (url.startsWith('/lovable-uploads/') || url.startsWith('/api/lovable-uploads/')) {
    // Convert old paths to new illustrations path
    const filename = url.includes('/') ? url.substring(url.lastIndexOf('/') + 1) : url;
    return `/assets/illustrations/${filename}`;
  }
  
  // Handle paths that start with /assets/illustrations/
  if (url.startsWith('/assets/illustrations/') || url.startsWith('/api/assets/illustrations/')) {
    // Remove the /api/ prefix if it exists
    if (url.startsWith('/api/assets/illustrations/')) {
      return '/assets/illustrations/' + url.substring('/api/assets/illustrations/'.length);
    }
    return url;
  }

  // For any other path, ensure it has a leading slash
  const result = url.startsWith('/') ? url : `/${url}`;
  // console.log(`constructUrl output (default case): ${result}`);
  return result;
};