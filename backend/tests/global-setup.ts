import { execSync } from 'node:child_process';
import mariadb from 'mariadb';

/**
 * Prepares the dedicated test database (default `online_shops_test`):
 *  1. creates it if missing
 *  2. applies migrations (`prisma migrate deploy` — non-destructive)
 *  3. empties every table (only ever in a database whose name ends with `_test`)
 *  4. loads the demo seed as fixtures
 * It never touches the development database `online_shops`.
 */
export default async function setup() {
  const url = new URL(process.env.TEST_DATABASE_URL ?? 'mysql://root:@localhost:3306/online_shops_test');
  const dbName = url.pathname.replace(/^\//, '');
  if (!/^[a-z0-9_]+_test$/i.test(dbName)) {
    throw new Error(`Refusing to use "${dbName}" for tests: the database name must end with "_test"`);
  }

  const conn = await mariadb.createConnection({
    host: url.hostname,
    port: Number(url.port || 3306),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
  });
  try {
    await conn.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    const env = { ...process.env, DATABASE_URL: url.toString(), NODE_ENV: 'test' };
    execSync('npx prisma migrate deploy', { env, stdio: 'pipe' });

    await conn.query(`USE \`${dbName}\``);
    const tables: { t: string }[] = await conn.query(
      "SELECT table_name AS t FROM information_schema.tables WHERE table_schema = ? AND table_name <> '_prisma_migrations'",
      [dbName],
    );
    await conn.query('SET FOREIGN_KEY_CHECKS = 0');
    for (const { t } of tables) await conn.query(`TRUNCATE TABLE \`${t}\``);
    await conn.query('SET FOREIGN_KEY_CHECKS = 1');

    execSync('npx tsx src/scripts/seed-demo.ts', { env, stdio: 'pipe' });
  } finally {
    await conn.end();
  }
}
