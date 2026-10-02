// Expo statically replaces this expression. Never put secrets in EXPO_PUBLIC_* values.
const configuredApiUrl = process.env.EXPO_PUBLIC_API_URL?.trim();
const apiUrl = configuredApiUrl || 'http://localhost:8787';
const parsedUrl = new URL(apiUrl);

if (!['http:', 'https:'].includes(parsedUrl.protocol) || parsedUrl.username || parsedUrl.password) {
  throw new Error('EXPO_PUBLIC_API_URL must be an HTTP(S) URL without credentials.');
}

export const config = { apiUrl: apiUrl.replace(/\/+$/, '') } as const;
