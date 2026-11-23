import 'dotenv/config';

const isProd = process.env.NODE_ENV === 'production';

function env(name: string, devDefault: string): string {
  const value = process.env[name];
  if (value) return value;
  if (isProd) throw new Error(`Missing required env variable: ${name}`);
  return devDefault;
}

export const config = {
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: env('DATABASE_URL', 'file:local.db'),
  databaseAuthToken: process.env.DATABASE_AUTH_TOKEN || undefined,
  jwtSecret: env('JWT_SECRET', 'dev-secret'),
  accounts: {
    scanner: {
      login: env('SCANNER_LOGIN', 'scanner'),
      password: env('SCANNER_PASSWORD', 'scanner'),
    },
    admin: {
      login: env('ADMIN_LOGIN', 'admin'),
      password: env('ADMIN_PASSWORD', 'admin'),
    },
  },
  corsOrigins: (process.env.CORS_ORIGIN ?? 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
};
