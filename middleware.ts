import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// This function can be marked `async` if using `await` inside
export function middleware(request: NextRequest) {
  // Get the pathname of the request
  const path = request.nextUrl.pathname
  
  // Check if the path is the login page
  const isLoginPage = path === '/' || path === '/login'
  
  // Check if the user is authenticated by looking for the access token cookie
  const token = request.cookies.get('access_token')?.value
  const isAuthenticated = !!token
  
  // If the user is not authenticated and trying to access a protected route like /projects, redirect to login
  if (!isAuthenticated && 
      (path === '/projects' || path.startsWith('/projects/')) && 
      !path.startsWith('/_next') && 
      !path.startsWith('/api')) {
    return NextResponse.redirect(new URL('/', request.url))
  }
  
  // If the user is authenticated and trying to access the login page, redirect to projects
  if (isAuthenticated && isLoginPage) {
    return NextResponse.redirect(new URL('/projects', request.url))
  }
  
  // Continue with the request
  return NextResponse.next()
}

// See "Matching Paths" below to learn more
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * 1. /api routes
     * 2. /_next (Next.js internals)
     * 3. /fonts, /icons, etc. (static files)
     * 4. all root files inside /public (robots.txt, favicon.ico, etc.)
     */
    '/((?!api|_next|fonts|icons|public|locales|[\\w-]+\\.\\w+).*)',
  ],
} 