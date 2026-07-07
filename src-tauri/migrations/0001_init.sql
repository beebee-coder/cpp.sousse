-- 0001_init.sql — Schéma local (SQLite)
-- Miroir du schéma Prisma cloud, adapté SQLite (TEXT pour enum/Json).
CREATE TABLE IF NOT EXISTS users (
  id           TEXT PRIMARY KEY,
  email        TEXT UNIQUE NOT NULL,
  firstName    TEXT,
  lastName     TEXT,
  password     TEXT NOT NULL,
  role         TEXT NOT NULL DEFAULT 'user',
  approved     INTEGER NOT NULL DEFAULT 0,
  createdAt    TEXT NOT NULL,
  updatedAt    TEXT NOT NULL,
  lastSyncAt   TEXT
);

CREATE TABLE IF NOT EXISTS procedures (
  id              TEXT PRIMARY KEY,
  title           TEXT NOT NULL,
  code            TEXT UNIQUE NOT NULL,
  description     TEXT,
  category        TEXT NOT NULL,
  criticality     TEXT NOT NULL DEFAULT 'NORMAL',
  status          TEXT NOT NULL DEFAULT 'DRAFT',
  steps           TEXT,
  prerequisites   TEXT,
  authorId        TEXT NOT NULL,
  createdAt       TEXT NOT NULL,
  updatedAt       TEXT NOT NULL,
  lastExecutedAt  TEXT,
  executionCount  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS procedure_executions (
  id            TEXT PRIMARY KEY,
  procedureId   TEXT NOT NULL,
  operatorId    TEXT NOT NULL,
  startTime     TEXT NOT NULL,
  endTime       TEXT,
  status        TEXT NOT NULL DEFAULT 'IN_PROGRESS',
  stepsStatus   TEXT,
  totalDuration INTEGER
);

CREATE TABLE IF NOT EXISTS knowledge_items (
  id        TEXT PRIMARY KEY,
  title     TEXT NOT NULL,
  type      TEXT NOT NULL,
  content   TEXT,
  question  TEXT,
  answer    TEXT,
  tags      TEXT,
  category  TEXT,
  userId    TEXT NOT NULL,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
