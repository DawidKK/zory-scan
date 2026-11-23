import { Global, Module } from '@nestjs/common';
import { createClient } from '@libsql/client';
import { drizzle, LibSQLDatabase } from 'drizzle-orm/libsql';
import { config } from '../config';
import * as schema from './schema';

export const DB = Symbol('DB');
export type Database = LibSQLDatabase<typeof schema>;

export function createDb(): Database {
  const client = createClient({ url: config.databaseUrl, authToken: config.databaseAuthToken });
  return drizzle(client, { schema });
}

@Global()
@Module({
  providers: [{ provide: DB, useFactory: createDb }],
  exports: [DB],
})
export class DbModule {}
