-- Shortlist Studio — Cloudflare D1 / SQLite Schema
-- Note: Tables also auto-create safely via ensureTables(DB) on first API request.

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL DEFAULT '',
  first_name TEXT NOT NULL DEFAULT '',
  ai_chats_total INTEGER NOT NULL DEFAULT 0,
  ai_chats_today INTEGER NOT NULL DEFAULT 0,
  ai_chats_date TEXT NOT NULL DEFAULT '',
  pdfs_downloaded INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS resumes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  track_id TEXT NOT NULL DEFAULT 'mba-finance',
  custom_role_name TEXT NOT NULL DEFAULT '',
  layout_mode TEXT NOT NULL DEFAULT 'fresher',
  font_family TEXT NOT NULL DEFAULT 'times',
  font_size_pt REAL NOT NULL DEFAULT 10.0,
  current_step INTEGER NOT NULL DEFAULT 1,
  content_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_resumes_user ON resumes(user_id, updated_at DESC);
