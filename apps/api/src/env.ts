export interface Bindings {
  APP_ENV?: 'development' | 'beta' | 'production';
  DATABASE_URL?: string;
  BETTER_AUTH_SECRET?: string;
  BETTER_AUTH_URL?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
  APPLE_CLIENT_ID?: string;
  APPLE_APP_BUNDLE_IDENTIFIER?: string;
  APPLE_TEAM_ID?: string;
  APPLE_KEY_ID?: string;
  APPLE_PRIVATE_KEY?: string;
  PROOF_IMAGES?: R2Bucket;
}

export interface ApiEnvironment {
  Bindings: Bindings;
}
