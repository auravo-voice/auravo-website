import type { APIRoute } from 'astro';

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(body: unknown): { valid: boolean; error?: string } {
  if (!body || typeof body !== 'object') return { valid: false, error: 'Invalid request' };
  const b = body as Record<string, unknown>;

  const name = typeof b.name === 'string' ? b.name.trim() : '';
  if (name.length < 2) return { valid: false, error: 'Name must be at least 2 characters' };
  if (name.length > 200) return { valid: false, error: 'Name is too long' };

  const email = typeof b.email === 'string' ? b.email.trim() : '';
  if (!email) return { valid: false, error: 'Email is required' };
  if (!emailRegex.test(email)) return { valid: false, error: 'Invalid email address' };

  const requestType = b.requestType;
  if (requestType !== 'workshop' && requestType !== 'institution' && requestType !== 'coach') {
    return { valid: false, error: 'Please choose an option' };
  }

  const message = typeof b.message === 'string' ? b.message.trim() : '';
  if (message.length < 10) return { valid: false, error: 'Message must be at least 10 characters' };
  if (message.length > 3000) return { valid: false, error: 'Message is too long' };

  return { valid: true };
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const result = validate(body);
    if (!result.valid) {
      return new Response(
        JSON.stringify({ success: false, error: result.error }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Optional: add Supabase or email integration here
    // const supabase = getSupabase();
    // await supabase.from('workshop_requests').insert([{ ... }]);

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch {
    return new Response(
      JSON.stringify({ success: false, error: 'Something went wrong. Please try again.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
