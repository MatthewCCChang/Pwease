import { betterAuth } from 'better-auth';
import { expo } from '@better-auth/expo';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import type { Database } from '../db';
import * as schema from '../db/schema';
import type { Bindings } from '../env';
import { fail } from '../routes/errors';

export function webOrigin(env: Bindings) {
  return env.WEB_ORIGIN || (env.APP_ENV === 'production' ? undefined : 'http://localhost:8081');
}
// Create inside withDatabase: Worker connections must not escape their request.
export function createAuth(env: Bindings, db: Database) {
  if (!env.BETTER_AUTH_SECRET || !env.BETTER_AUTH_URL) {
    fail(503, 'SERVICE_UNAVAILABLE', 'Authentication is not configured.');
  }
  const googleId = env.GOOGLE_WEB_CLIENT_ID || env.GOOGLE_CLIENT_ID;
  const origin = webOrigin(env);
  return betterAuth({
    baseURL: env.BETTER_AUTH_URL, secret: env.BETTER_AUTH_SECRET,
    database: drizzleAdapter(db, { provider: 'pg', schema, transaction: true }),
    socialProviders: googleId && env.GOOGLE_CLIENT_SECRET ? {
      google: { prompt: 'select_account', clientId: googleId, clientSecret: env.GOOGLE_CLIENT_SECRET },
    } : {},
    trustedOrigins: ['pwease://', ...(origin ? [origin] : []),
      ...(env.APP_ENV === 'development' ? ['exp://', 'exp://**'] : [])],
    plugins: [expo()],
  });
}
