/** Short-lived cookie holding OAuth provider metadata between start and callback. */
export const AURAVO_OAUTH_PROVIDER_COOKIE = "auravo_oauth_provider";

/** Post-login path (e.g. `/dashboard`) after OAuth succeeds. */
export const AURAVO_OAUTH_REDIRECT_COOKIE = "auravo_oauth_redirect";

export const AURAVO_OAUTH_COOKIE_MAX_AGE_SEC = 60 * 10;

export type StoredOAuthProvider = {
  name: string;
  state: string;
  codeVerifier: string;
};
