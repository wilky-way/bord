import { Database } from "bun:sqlite";
import { readFileSync } from "fs";
import { join } from "path";

let db: Database;

export function initDb(): Database {
  const dbPath = join(import.meta.dir, "..", "..", "bord.db");
  db = new Database(dbPath, { create: true });
  db.exec("PRAGMA journal_mode = WAL");
  db.exec("PRAGMA foreign_keys = ON");

  // Run schema
  const schema = readFileSync(join(import.meta.dir, "..", "schema.sql"), "utf-8");
  db.exec(schema);

  return db;
}

export function getDb(): Database {
  if (!db) throw new Error("Database not initialized");
  return db;
}
