import { defineConfig } from '@prisma/config';

// DATABASE_URL comes from the process environment (Docker / .env).
// Do not import dotenv here — it is not required in the production image.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: process.env.DATABASE_URL as string,
  },
});
