import { Database } from "bun:sqlite";
import { mkdirSync, readFileSync } from "fs";
import { dirname, join } from "path";

let db: Database;

export function initDb(): Database {
  const dbPath = process.env.BORD_DB_PATH ?? join(import.meta.dir, "..", "..", "bord.db");
  const schemaPath = process.env.BORD_SCHEMA_PATH ?? join(import.meta.dir, "..", "schema.sql");
  mkdirSync(dirname(dbPath), { recursive: true });
  db = new Database(dbPath, { create: true });
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");

  // Run schema
  const schema = readFileSync(schemaPath, "utf-8");
  db.exec(schema);

  return db;
}

export function getDb(): Database {
  if (!db) throw new Error("Database not initialized");
  return db;
}
