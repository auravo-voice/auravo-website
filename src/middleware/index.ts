import { defineMiddleware } from 'astro:middleware';

// CORS Configuration
const ALLOWED_ORIGINS = [
  'http://localhost:4321', // Local development
  'http://localhost:3000', // Alternative local port
  // Add your production domains here:
  'https://thesignaturevoice.com',
  'https://thesignaturevoice.vercel.app',
  // 'https://yoursite.com',
  // 'https://www.yoursite.com',
];

// Helper: Check if origin is allowed
function isOriginAllowed(origin: string | null): boolean {
  if (!origin) return true; // Same-origin requests have no Origin header
  
  // In production, check against whitelist
  if (import.meta.env.PROD) {
    return ALLOWED_ORIGINS.some(allowed => origin.startsWith(allowed));
  }
  
  // In development, allow all localhost
  return origin.includes('localhost') || origin.includes('127.0.0.1');
}

export const onRequest = defineMiddleware(async ({ request, url }, next) => {
  const origin = request.headers.get('origin');
  
  // Handle CORS for API routes
  if (url.pathname.startsWith('/api/')) {
    // Preflight request (OPTIONS)
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': origin && isOriginAllowed(origin) ? origin : 'null',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
          'Access-Control-Max-Age': '86400', // 24 hours
        },
      });
    }

    // Check origin for actual requests
    if (origin && !isOriginAllowed(origin)) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'CORS policy: Origin not allowed' 
        }), 
        { 
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
  }

  // Continue to route handler
  const response = await next();

  // Add CORS headers to API responses
  if (url.pathname.startsWith('/api/') && origin && isOriginAllowed(origin)) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Credentials', 'true');
  }

  // Add security headers to all responses
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');

  return response;
});
