import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Supabase configuration – only create client when URL/key are set and valid
const supabaseUrl = (import.meta.env.PUBLIC_SUPABASE_URL as string | undefined) ?? '';
const supabaseAnonKey = (import.meta.env.PUBLIC_SUPABASE_ANON_KEY as string | undefined) ?? '';
const trimmedUrl = supabaseUrl.trim();
const isValidUrl = trimmedUrl.length > 0 && /^https?:\/\//i.test(trimmedUrl);
const hasRealKey = supabaseAnonKey.length > 0 && supabaseAnonKey !== 'YOUR_SUPABASE_ANON_KEY';

export const supabase: SupabaseClient | null =
  isValidUrl && hasRealKey ? createClient(trimmedUrl, supabaseAnonKey) : null;

export interface UserData {
  name: string;
  email: string;
  phone: string;
  occupation: string;
  ageGroup: string;
}

export interface SaveUserDetailsResponse {
  success: boolean;
  data?: {
    id: string;
    updateToken?: string;
  };
  error?: {
    message: string;
  };
}

export interface QuizResults {
  archetype: string;
  percentages: Record<string, number>;
  answers_compact: unknown[];
  quiz_version?: string;
}

export interface UpdateQuizResultsResponse {
  success: boolean;
  data?: unknown;
  error?: {
    message: string;
  };
}

/**
 * Save user details when they submit the form (Stage 1)
 * Now uses secure server-side API endpoint instead of direct Supabase access
 * @param userData - User information (name, email, phone, occupation, ageGroup)
 * @returns Response with submission ID and update token
 */
const SAVE_DETAILS_TIMEOUT_MS = 10000;

export async function saveUserDetails(userData: UserData): Promise<SaveUserDetailsResponse> {
  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutId = controller
    ? window.setTimeout(() => controller.abort(), SAVE_DETAILS_TIMEOUT_MS)
    : null;

  try {
    const response = await fetch('/api/quiz/submit-details', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(userData),
      signal: controller?.signal,
    });

    if (timeoutId && typeof window !== 'undefined') window.clearTimeout(timeoutId);

    const result = await response.json() as { data?: { id: string; updateToken?: string }; error?: string };

    if (!response.ok) {
      console.error('Error saving user details:', result.error);
      return { success: false, error: { message: result.error || 'Unknown error' } };
    }

    // Store update token in localStorage for later use
    if (typeof window !== 'undefined' && result.data?.updateToken) {
      localStorage.setItem('quiz_update_token', result.data.updateToken);
    }

    return { success: true, data: result.data };
  } catch (error) {
    if (timeoutId && typeof window !== 'undefined') window.clearTimeout(timeoutId);
    console.error('Failed to save user details:', error);
    const message =
      error instanceof Error && error.name === 'AbortError'
        ? 'Request timed out. Please check your connection.'
        : 'Network error. Please check your connection.';
    return { success: false, error: { message } };
  }
}

/**
 * Update quiz results when user completes the quiz (Stage 2)
 * Now uses secure server-side API endpoint with token validation
 * @param submissionId - The ID from Stage 1
 * @param results - Quiz results (archetype, percentages, answers_compact, quiz_version, etc.)
 * @returns Response from server
 */
export async function updateQuizResults(
  submissionId: string,
  results: QuizResults
): Promise<UpdateQuizResultsResponse> {
  try {
    // Retrieve update token from localStorage
    const updateToken = typeof window !== 'undefined' 
      ? localStorage.getItem('quiz_update_token') 
      : null;

    if (!updateToken) {
      console.error('Update token not found');
      return { success: false, error: { message: 'Update token missing. Please retake the quiz.' } };
    }

    const response = await fetch('/api/quiz/update-results', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        submissionId,
        updateToken,
        results: {
          archetype: results.archetype,
          percentages: results.percentages,
          answers_compact: results.answers_compact,
          quiz_version: results.quiz_version || 'v1',
        },
      }),
    });

    const result = await response.json() as { data?: unknown; error?: string };

    if (!response.ok) {
      console.error('Error updating quiz results:', result.error);
      return { success: false, error: { message: result.error || 'Unknown error' } };
    }

    // Clear token after successful update (optional - prevents retakes)
    // if (typeof window !== 'undefined') {
    //   localStorage.removeItem('quiz_update_token');
    // }

    return { success: true, data: result.data };
  } catch (error) {
    console.error('Failed to update quiz results:', error);
    return { success: false, error: { message: 'Network error. Please check your connection.' } };
  }
}

/**
 * ADMIN FUNCTIONS REMOVED FROM CLIENT BUNDLE
 * 
 * These functions have been moved to server-side API routes for security.
 * If you need admin access to submissions, create a separate admin API endpoint
 * with proper authentication.
 * 
 * Example: /api/admin/submissions (requires admin authentication)
 */

