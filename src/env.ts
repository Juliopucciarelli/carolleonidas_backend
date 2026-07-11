function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export const env = {
  DATABASE_URL: required("DATABASE_URL"),
  JWT_SECRET: required("JWT_SECRET"),
  ADMIN_SEED_EMAIL: required("ADMIN_SEED_EMAIL"),
  ADMIN_SEED_PASSWORD: required("ADMIN_SEED_PASSWORD"),
  PORT: process.env.PORT ?? "3001",
};
