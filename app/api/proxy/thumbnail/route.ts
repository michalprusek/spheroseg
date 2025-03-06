import { NextRequest, NextResponse } from 'next/server';
import { API_BASE_URL, fetchWithAuth, isOfflineMode } from '@/app/api/api-config';

// Mark this route as dynamic to avoid static generation errors
export const dynamic = 'force-dynamic';

/**
 * API proxy for thumbnails that solves CORS issues
 * This proxy forwards requests to the API server which serves thumbnails directly from MinIO
 */
export async function GET(request: NextRequest) {
  try {
    // If we're in offline mode, return a placeholder
    if (isOfflineMode()) {
      return new Response(null, {
        status: 302,
        headers: {
          'Location': '/images/placeholder-thumbnail.svg',
          'Cache-Control': 'no-cache',
        },
      });
    }

    // Get object_name from query parameter
    const url = new URL(request.url);
    // Support both 'object_name' and 'objectName' query parameters
    const objectName = url.searchParams.get('object_name') || url.searchParams.get('objectName');
    
    if (!objectName) {
      console.error('Proxy: Missing object_name parameter');
      return new Response(null, {
        status: 302,
        headers: {
          'Location': '/images/placeholder-thumbnail.svg',
          'Cache-Control': 'no-cache',
        },
      });
    }
    
    console.log(`Thumbnail proxy: serving ${objectName}`);

    // Get the auth token from the cookie, authorization header, or request query
    let token = request.cookies.get('token')?.value || 
                url.searchParams.get('token') || 
                request.headers.get('authorization')?.replace('Bearer ', '');
    
    if (!token) {
      console.error('Proxy: No authentication token provided');
      return new Response(null, {
        status: 302,
        headers: {
          'Location': '/images/placeholder-thumbnail.svg',
          'Cache-Control': 'no-cache',
        },
      });
    }

    // Try direct MinIO access first (faster) using the object name
    const minioUrl = `http://localhost:9000/thumbnails/${objectName}`;
    
    try {
      console.log(`Trying direct MinIO access at: ${minioUrl}`);
      const minioResponse = await fetch(minioUrl, {
        method: 'GET',
        headers: {
          'Cache-Control': 'no-cache',
        },
        next: { revalidate: 0 }
      });
      
      if (minioResponse.ok) {
        // Get content type and image buffer
        const contentType = minioResponse.headers.get('content-type') || 'image/png';
        const imageBuffer = await minioResponse.arrayBuffer();
        
        console.log(`Successfully fetched thumbnail from MinIO: ${objectName}`);
        
        // Return image with CORS headers
        return new Response(imageBuffer, {
          status: 200,
          headers: {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=3600',
            'Access-Control-Allow-Origin': '*',
          },
        });
      } else {
        console.log(`MinIO direct access failed with status: ${minioResponse.status}`);
      }
    } catch (error) {
      console.log(`Error trying direct MinIO access: ${error.message}`);
      // Silently fail and try the API method as fallback
    }

    // Fallback: Get thumbnail from API server using the direct endpoint
    const apiUrl = `${API_BASE_URL}/images/thumbnail/${objectName}`;
    
    // Make the request to the API with explicit headers
    const apiResponse = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      },
      cache: 'no-store'
    });
    
    if (!apiResponse.ok) {
      console.error(`Proxy: Failed to fetch thumbnail from API: ${apiResponse.status} ${apiResponse.statusText}`);
      return new Response(null, {
        status: 302,
        headers: {
          'Location': '/images/placeholder-thumbnail.svg',
          'Cache-Control': 'no-cache',
        },
      });
    }

    // Get content type and image buffer
    const contentType = apiResponse.headers.get('content-type') || 'image/png';
    const imageBuffer = await apiResponse.arrayBuffer();

    // Return image with CORS headers
    return new Response(imageBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=3600',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('Proxy: Error in thumbnail proxy:', error);
    return new Response(null, {
      status: 302,
      headers: {
        'Location': '/images/placeholder-thumbnail.svg',
        'Cache-Control': 'no-cache',
      },
    });
  }
}