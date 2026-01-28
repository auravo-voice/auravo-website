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

// Rate limiting
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT_WINDOW = 60 * 1000;
const MAX_REQUESTS_PER_IP = 10;

function checkRateLimit(ip: string): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const key = `update-${ip}`;
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

// Helper: Verify update token
function verifyUpdateToken(token: string, submissionId: string): boolean {
  try {
    // CRITICAL: Fail if secret is not configured
    const secret = import.meta.env.UPDATE_TOKEN_SECRET;
    if (!secret) {
      console.error('SECURITY ERROR: UPDATE_TOKEN_SECRET is not set in environment variables!');
      return false;
    }

    const parts = token.split(':');
    if (parts.length !== 3) return false;

    const [tokenId, timestamp, signature] = parts;

    // Check if token is for the correct submission
    if (tokenId !== submissionId) return false;

    // Check if token is expired (24 hours)
    const tokenTime = parseInt(timestamp, 10);
    const now = Date.now();
    const twentyFourHours = 24 * 60 * 60 * 1000;
    if (now - tokenTime > twentyFourHours) return false;

    // Verify signature using constant-time comparison (prevents timing attacks)
    const payload = `${tokenId}:${timestamp}`;
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payload);
    const expectedSignature = hmac.digest('hex');

    // Use crypto.timingSafeEqual for constant-time comparison
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');
    const actualBuffer = Buffer.from(signature, 'hex');
    
    if (expectedBuffer.length !== actualBuffer.length) return false;
    
    return crypto.timingSafeEqual(expectedBuffer, actualBuffer);
  } catch {
    return false;
  }
}

// Helper: Validate results data
function validateResults(results: any): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!results.archetype || typeof results.archetype !== 'string') {
    errors.push('Invalid archetype');
  }

  if (!results.percentages || typeof results.percentages !== 'object') {
    errors.push('Invalid percentages');
  }

  if (!results.quiz_version || typeof results.quiz_version !== 'string') {
    errors.push('Invalid quiz version');
  }

  return { valid: errors.length === 0, errors };
}

export const POST: APIRoute = async ({ request, clientAddress }) => {
  try {
    const ip = request.headers.get('x-forwarded-for') || clientAddress || 'unknown';

    // Rate limit check
    const rateLimit = checkRateLimit(ip);
    if (!rateLimit.allowed) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Too many requests. Please try again later.' 
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

    const body = await request.json();
    const { submissionId, updateToken, results } = body;

    // Validate required fields
    if (!submissionId || !updateToken || !results) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing required fields' 
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Verify update token
    if (!verifyUpdateToken(updateToken, submissionId)) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Invalid or expired update token' 
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Validate results
    const validation = validateResults(results);
    if (!validation.valid) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: validation.errors.join(', ') 
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const supabase = getSupabase();
    if (!supabase) {
      return new Response(
        JSON.stringify({ success: false, error: 'Quiz backend is not configured yet. Please try again later.' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check if submission exists and hasn't been completed yet
    const { data: existingSubmission, error: fetchError } = await supabase
      .from('quiz_submissions')
      .select('quiz_taken')
      .eq('id', submissionId)
      .single();

    if (fetchError || !existingSubmission) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Submission not found' 
        }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Optional: Prevent updating already completed quizzes (uncomment if needed)
    // if (existingSubmission.quiz_taken) {
    //   return new Response(
    //     JSON.stringify({ 
    //       success: false, 
    //       error: 'Quiz already completed' 
    //     }),
    //     { status: 400, headers: { 'Content-Type': 'application/json' } }
    //   );
    // }

    // Update quiz results
    const { data, error } = await supabase
      .from('quiz_submissions')
      .update({
        quiz_taken: true,
        archetype: results.archetype,
        archetype_percentages: results.percentages,
        answers_compact: results.answers_compact,
        quiz_version: results.quiz_version,
        quiz_completed_at: new Date().toISOString(),
      })
      .eq('id', submissionId)
      .select();

    if (error) {
      // Log detailed error only in development
      if (import.meta.env.DEV) {
        console.error('Supabase update error:', error);
      } else {
        console.error('Database update failed');
      }
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Failed to update results' 
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: data[0]
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
