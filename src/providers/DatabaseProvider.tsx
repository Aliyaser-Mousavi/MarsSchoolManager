/**
 * Mars School Manager - Database Provider & Context
 * Initializes Dari/Persian RTL layout, runs atomic migrations, seeds defaults,
 * and provides database access across the entire component tree.
 */

import React, { createContext, useContext, useEffect, useState } from "react";
import { I18nManager } from "react-native";
import { SQLiteDatabase } from "expo-sqlite";
import * as SplashScreen from "expo-splash-screen";
import {
  checkDatabaseHealthAsync,
  DatabaseHealthReport,
  getDbAsync,
} from "@/db/client";
import { runMigrationsAsync } from "@/db/migrations";
import { seedInitialDataIfNeeded, SeedResult } from "@/db/seed";

// Force Right-to-Left (RTL) layout for Dari/Persian interface
try {
  if (!I18nManager.isRTL) {
    I18nManager.allowRTL(true);
    I18nManager.forceRTL(true);
  }
} catch (e) {
  console.warn("[RTL Configuration Warning]:", e);
}

export interface DatabaseContextValue {
  db: SQLiteDatabase | null;
  isLoading: boolean;
  isReady: boolean;
  error: Error | null;
  health: DatabaseHealthReport | null;
  schemaVersion: number;
  seedResult: SeedResult | null;
}

const DatabaseContext = createContext<DatabaseContextValue>({
  db: null,
  isLoading: true,
  isReady: false,
  error: null,
  health: null,
  schemaVersion: 0,
  seedResult: null,
});

export function DatabaseProvider({ children }: { children: React.ReactNode }) {
  const [db, setDb] = useState<SQLiteDatabase | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [health, setHealth] = useState<DatabaseHealthReport | null>(null);
  const [schemaVersion, setSchemaVersion] = useState(0);
  const [seedResult, setSeedResult] = useState<SeedResult | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function initDatabase() {
      try {
        console.log(
          "[Mars School Manager] Initializing local SQLite database...",
        );
        const database = await getDbAsync();

        console.log("[Mars School Manager] Running schema migrations...");
        const version = await runMigrationsAsync(database);

        console.log("[Mars School Manager] Running idempotent data seed...");
        const seed = await seedInitialDataIfNeeded(database);

        console.log(
          "[Mars School Manager] Performing database integrity check...",
        );
        const healthReport = await checkDatabaseHealthAsync(database);

        if (isMounted) {
          setDb(database);
          setSchemaVersion(version);
          setSeedResult(seed);
          setHealth(healthReport);
          setIsReady(true);
          setIsLoading(false);
        }

        await SplashScreen.hideAsync().catch(() => {
          // Splash screen hide may throw if already hidden
        });
      } catch (err) {
        console.error(
          "[Mars School Manager Database Initialization Error]:",
          err,
        );
        if (isMounted) {
          setError(err instanceof Error ? err : new Error(String(err)));
          setIsLoading(false);
        }
        await SplashScreen.hideAsync().catch(() => {});
      }
    }

    initDatabase();

    return () => {
      isMounted = false;
    };
  }, []);

  return (
    <DatabaseContext.Provider
      value={{
        db,
        isLoading,
        isReady,
        error,
        health,
        schemaVersion,
        seedResult,
      }}
    >
      {children}
    </DatabaseContext.Provider>
  );
}

export function useDatabase(): DatabaseContextValue {
  const context = useContext(DatabaseContext);
  if (!context) {
    throw new Error("useDatabase must be used within a DatabaseProvider");
  }
  return context;
}
