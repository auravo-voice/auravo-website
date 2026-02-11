import type { APIRoute } from 'astro';
import { Resend } from 'resend';

const TO_EMAIL = 'auravo.voice@gmail.com';
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

function formatBodyForEmail(body: Record<string, unknown>): string {
  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : '—');
  const requestTypeLabels: Record<string, string> = {
    workshop: 'Workshop',
    institution: 'Bring Auravo to my institution',
    coach: 'Review my voice with a coach',
  };
  return [
    'Name: ' + str(body.name),
    'Email: ' + str(body.email),
    'Phone: ' + str(body.phone),
    'Organization: ' + str(body.organization),
    'Request type: ' + (requestTypeLabels[String(body.requestType)] ?? String(body.requestType)),
    'Preferred date: ' + str(body.preferredDate),
    'Participant count: ' + str(body.participantCount),
    '',
    'Message:',
    str(body.message),
  ].join('\n');
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const result = validate(body);
    if (!result.valid) {
      return new Response(
        JSON.stringify({ success: false, error: result.error }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const apiKey = import.meta.env.RESEND_API_KEY as string | undefined;
    const fromEmail = (import.meta.env.RESEND_FROM_EMAIL as string | undefined) || 'Auravo Website <onboarding@resend.dev>';
    if (!apiKey || !apiKey.trim()) {
      console.error('RESEND_API_KEY is not set');
      return new Response(
        JSON.stringify({ success: false, error: 'Email is not configured. Please try again later.' }),
        { status: 503, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const resend = new Resend(apiKey);
    const subject = `Book workshop: ${String(body.requestType)} – ${String(body.name)}`;
    const text = formatBodyForEmail(body);
    const { error } = await resend.emails.send({
      from: fromEmail,
      to: [TO_EMAIL],
      subject,
      text,
    });

    if (error) {
      console.error('Resend error:', error);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to send. Please try again.' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err) {
    if (import.meta.env.DEV) console.error(err);
    return new Response(
      JSON.stringify({ success: false, error: 'Something went wrong. Please try again.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
