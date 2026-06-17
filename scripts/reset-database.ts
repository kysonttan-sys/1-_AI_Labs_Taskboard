import { Client } from 'pg';

/**
 * Drops the public schema in the configured PostgreSQL database so that
 * `prisma migrate deploy` can recreate a clean schema from scratch.
 *
 * Usage:
 *   $env:DATABASE_URL="postgresql://..."
 *   npx tsx scripts/reset-database.ts
 */
async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL environment variable is required.');
    process.exit(1);
  }

  const client = new Client({ connectionString });
  try {
    await client.connect();
    console.log('Connected to database. Dropping public schema...');
    await client.query('DROP SCHEMA IF EXISTS public CASCADE;');
    await client.query('CREATE SCHEMA public;');
    await client.query('GRANT ALL ON SCHEMA public TO public;');
    console.log('Public schema reset successfully.');
    console.log(
      'Next, run: npm run db:migrate   (or   npx prisma migrate deploy)',
    );
  } catch (err) {
    console.error('Failed to reset database:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
