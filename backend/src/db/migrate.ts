import { resolve } from 'node:path';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { Logger } from '@nestjs/common';
import { createDb } from './db.module';

export async function runMigrations() {
  const db = createDb();
  await migrate(db, { migrationsFolder: resolve(process.cwd(), 'drizzle') });
  new Logger('DB').log('Migrations applied');
}
