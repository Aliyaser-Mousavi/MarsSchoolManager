/**
 * Mars School Manager - SQLite Connection Client
 * Utilizes expo-sqlite with WAL journal mode and strict foreign keys
 */

import * as SQLite from 'expo-sqlite';

export const DATABASE_NAME = 'mars_school.db';

let dbInstance: SQLite.SQLiteDatabase | null = null;

/**
 * Returns the singleton SQLite database instance, ensuring WAL mode and foreign keys are active.
 */
export async function getDbAsync(): Promise<SQLite.SQLiteDatabase> {
  if (!dbInstance) {
    dbInstance = await SQLite.openDatabaseAsync(DATABASE_NAME);
    await configurePragmas(dbInstance);
  }
  return dbInstance;
}

/**
 * Enforces critical persistence invariants on the database connection.
 */
export async function configurePragmas(db: SQLite.SQLiteDatabase): Promise<void> {
  await db.execAsync(`
    PRAGMA foreign_keys = ON;
    PRAGMA journal_mode = WAL;
    PRAGMA synchronous = NORMAL;
  `);
}

/**
 * Closes the active database connection (useful for testing or full backup restorations).
 */
export async function closeDbAsync(): Promise<void> {
  if (dbInstance) {
    await dbInstance.closeAsync();
    dbInstance = null;
  }
}

export interface DatabaseHealthReport {
  integrityCheck: string;
  foreignKeyErrors: unknown[];
  isHealthy: boolean;
}

/**
 * Runs low-level SQLite diagnostics to verify database health.
 */
export async function checkDatabaseHealthAsync(db: SQLite.SQLiteDatabase): Promise<DatabaseHealthReport> {
  const integrityResult = await db.getFirstAsync<{ integrity_check: string }>('PRAGMA integrity_check;');
  const foreignKeyErrors = await db.getAllAsync('PRAGMA foreign_key_check;');
  const integrityCheck = integrityResult?.integrity_check ?? 'unknown';

  return {
    integrityCheck,
    foreignKeyErrors,
    isHealthy: integrityCheck === 'ok' && foreignKeyErrors.length === 0,
  };
}

/**
 * Helper to run a callback inside an atomic transaction.
 */
export async function withTransactionAsync<T>(
  callback: (db: SQLite.SQLiteDatabase) => Promise<T>
): Promise<T> {
  const db = await getDbAsync();
  let result!: T;
  await db.withTransactionAsync(async () => {
    result = await callback(db);
  });
  return result;
}
