/**
 * Mars School Manager - Atomic SQLite Migration Runner
 * Uses PRAGMA user_version to track and sequentially apply migrations.
 */

import { SQLiteDatabase } from 'expo-sqlite';
import * as FileSystem from 'expo-file-system/legacy';
import { migration001 } from './001_initial_schema';

export interface MigrationStep {
  version: number;
  description: string;
  up: (db: SQLiteDatabase) => Promise<void>;
}

export const REGISTERED_MIGRATIONS: MigrationStep[] = [
  migration001,
];

/**
 * Creates a pre-migration snapshot copy of the database file if running on a native device with existing data.
 */
async function backupDatabaseBeforeMigration(currentVersion: number): Promise<void> {
  try {
    const docDir = FileSystem.documentDirectory;
    if (!docDir) return;

    const candidatePaths = [
      `${docDir}SQLite/mars_school.db`,
      `${docDir}mars_school.db`,
    ];

    for (const dbPath of candidatePaths) {
      const fileInfo = await FileSystem.getInfoAsync(dbPath);
      if (fileInfo.exists && !fileInfo.isDirectory) {
        const timestamp = Date.now();
        const backupPath = `${docDir}mars_school_backup_v${currentVersion}_${timestamp}.db`;
        await FileSystem.copyAsync({ from: dbPath, to: backupPath });
        console.log(`[Database Migration] Pre-upgrade backup created: ${backupPath}`);
        return;
      }
    }
  } catch (error) {
    // Non-fatal: Log warning and proceed with migration
    console.warn('[Database Migration] Backup snapshot creation warning:', error);
  }
}

/**
 * Runs all pending migrations sequentially within isolated transactions.
 */
export async function runMigrationsAsync(db: SQLiteDatabase): Promise<number> {
  const versionRow = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version;');
  const currentVersion = versionRow?.user_version ?? 0;

  const pendingMigrations = REGISTERED_MIGRATIONS.filter((m) => m.version > currentVersion).sort(
    (a, b) => a.version - b.version
  );

  if (pendingMigrations.length === 0) {
    return currentVersion;
  }

  // Pre-migration WAL flush and physical file snapshot if upgrading an existing populated DB
  if (currentVersion > 0) {
    await db.execAsync('PRAGMA wal_checkpoint(TRUNCATE);');
    await backupDatabaseBeforeMigration(currentVersion);
  }

  for (const migration of pendingMigrations) {
    console.log(`[Database Migration] Applying migration v${migration.version}: ${migration.description}`);
    await db.withTransactionAsync(async () => {
      await migration.up(db);
      await db.execAsync(`PRAGMA user_version = ${migration.version};`);
    });
    console.log(`[Database Migration] Successfully applied migration v${migration.version}`);
  }

  const finalVersionRow = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version;');
  return finalVersionRow?.user_version ?? currentVersion;
}
