import type { APIRoute } from 'astro';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import crypto from 'crypto';

function getSupabase(): SupabaseClient | null {
  const url = import.meta.env.PUBLIC_SUPABASE_URL as string | undefined;
  const key = import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string | undefined;
  const trimmed = (url ?? '').trim();
  if (!trimmed || !/^https?:\/\//i.test(trimmed) || !key || key === 'YOUR_SUPABASE_ANON_KEY') return null;
  return createClient(trimmed, key);
}

// Rate limiting storage (in production, use Redis or Vercel KV)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_IP = 5; // 5 submissions per minute

// Helper: Check rate limit
function checkRateLimit(ip: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const key = `submit-${ip}`;
  const record = rateLimitStore.get(key);

  if (!record || now > record.resetTime) {
    rateLimitStore.set(key, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return { allowed: true };
  }

  if (record.count >= MAX_REQUESTS_PER_IP) {
    const retryAfter = Math.ceil((record.resetTime - now) / 1000);
    return { allowed: false, retryAfter };
  }

  record.count++;
  return { allowed: true };
}

// Helper: Validate user data
function validateUserData(data: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!data.name || typeof data.name !== 'string' || data.name.trim().length < 2) {
    errors.push('Name must be at least 2 characters');
  }
  if (data.name && data.name.length > 100) {
    errors.push('Name is too long');
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!data.email || !emailRegex.test(data.email)) {
    errors.push('Invalid email format');
  }

  if (!data.phone || data.phone.length < 10) {
    errors.push('Phone number must be at least 10 digits');
  }

  if (!data.occupation || data.occupation.trim().length < 2) {
    errors.push('Occupation is required');
  }

  if (!data.ageGroup || data.ageGroup.trim().length < 2) {
    errors.push('Age group is required');
  }

  return { valid: errors.length === 0, errors };
}

// Helper: Generate secure update token (HMAC)
function generateUpdateToken(submissionId: string): string {
  const secret = import.meta.env.UPDATE_TOKEN_SECRET;
  
  // CRITICAL: Fail if secret is not configured
  if (!secret) {
    console.error('SECURITY ERROR: UPDATE_TOKEN_SECRET is not set in environment variables!');
    throw new Error('Server configuration error. Please contact support.');
  }
  
  const timestamp = Date.now();
  const payload = `${submissionId}:${timestamp}`;
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payload);
  const signature = hmac.digest('hex');
  return `${payload}:${signature}`;
}

export const POST: APIRoute = async ({ request, clientAddress }) => {
  try {
    // Get client IP for rate limiting
    const ip = request.headers.get('x-forwarded-for') || clientAddress || 'unknown';

    // Check rate limit
    const rateLimit = checkRateLimit(ip);
    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Too many requests. Please try again later.',
          retryAfter: rateLimit.retryAfter 
        }),
        { 
          status: 429, 
          headers: { 
            'Content-Type': 'application/json',
            'Retry-After': String(rateLimit.retryAfter || 60)
          } 
        }
      );
    }

    // Parse request body
    const body = await request.json();
    
    // Validate input
    const validation = validateUserData(body);
    if (!validation.valid) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: validation.errors.join(', ') 
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Sanitize data
    const sanitizedData = {
      name: body.name.trim().substring(0, 100),
      email: body.email.trim().toLowerCase(),
      phone: body.phone.trim(),
      occupation: body.occupation.trim().substring(0, 100),
      age_group: body.ageGroup.trim(),
      quiz_taken: false,
      quiz_started_at: new Date().toISOString(),
      submitted_at: new Date().toISOString(),
      ip_address: ip.split(',')[0].trim(), // Store first IP for basic tracking
    };

    const supabase = getSupabase();
    if (!supabase) {
      return new Response(
        JSON.stringify({ success: false, error: 'Quiz backend is not configured yet. Please try again later.' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Insert into Supabase
    const { data, error } = await supabase
      .from('quiz_submissions')
      .insert([sanitizedData])
      .select();

    if (error) {
      // Log detailed error only in development
      if (import.meta.env.DEV) {
        console.error('Supabase error:', error);
      } else {
        console.error('Database insertion failed');
      }
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Database error. Please try again.' 
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Generate secure update token
    const submissionId = data[0].id;
    const updateToken = generateUpdateToken(submissionId);

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: {
          id: submissionId,
          updateToken, // Client needs this to update results later
        }
      }),
      { 
        status: 200, 
        headers: { 
          'Content-Type': 'application/json',
          'Cache-Control': 'no-store'
        } 
      }
    );

  } catch (error) {
    // Log detailed error only in development
    if (import.meta.env.DEV) {
      console.error('API error:', error);
    } else {
      console.error('Server error occurred');
    }
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Server error. Please try again.' 
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
