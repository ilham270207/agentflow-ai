import "dotenv/config";
import pg from "pg";
import fs from "node:fs/promises";
import path from "node:path";

const DATA_DIR = path.join(process.cwd(), "data");
const FILE_MAP = {
  users: "umaira-users.json",
  sessions: "umaira-sessions.json",
  "gallery-index": "gallery.json"
};
const MIME = { webp: "image/webp", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg" };

export const usingDb = Boolean(process.env.DATABASE_URL);

const pool = usingDb
  ? new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 20000
    })
  : null;
if (pool) pool.on("error", (err) => console.error("[db] koneksi idle error:", err.message));

let ready = null;
export function initDb() {
  if (!usingDb) return Promise.resolve();
  if (!ready) {
    ready = pool
      .query(`
        CREATE TABLE IF NOT EXISTS umaira_kv (
          key text PRIMARY KEY,
          value jsonb NOT NULL,
          updated_at timestamptz NOT NULL DEFAULT now()
        );
        CREATE TABLE IF NOT EXISTS umaira_files (
          name text PRIMARY KEY,
          mime text NOT NULL,
          data bytea NOT NULL,
          created_at timestamptz NOT NULL DEFAULT now()
        );
      `)
      .catch((err) => {
        ready = null;
        throw err;
      });
  }
  return ready;
}

function fileFor(key) {
  const f = FILE_MAP[key];
  if (!f) throw new Error("Kunci tidak dikenal: " + key);
  return path.join(DATA_DIR, f);
}

function safeFilePath(name) {
  const p = path.resolve(DATA_DIR, name);
  if (!p.startsWith(DATA_DIR + path.sep)) throw new Error("Nama file tidak valid");
  return p;
}

export async function kvGet(key, fallback) {
  if (usingDb) {
    await initDb();
    const r = await pool.query("SELECT value FROM umaira_kv WHERE key = $1", [key]);
    return r.rows.length ? r.rows[0].value : fallback;
  }
  try {
    return JSON.parse(await fs.readFile(fileFor(key), "utf8"));
  } catch (err) {
    if (err.code === "ENOENT") return fallback;
    throw err;
  }
}

const queues = new Map();
export function kvSet(key, value) {
  const run = async () => {
    if (usingDb) {
      await initDb();
      await pool.query(
        `INSERT INTO umaira_kv (key, value, updated_at) VALUES ($1, $2::jsonb, now())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
        [key, JSON.stringify(value)]
      );
      return;
    }
    const file = fileFor(key);
    await fs.mkdir(DATA_DIR, { recursive: true, mode: 0o700 });
    const tmp = file + ".tmp";
    await fs.writeFile(tmp, JSON.stringify(value, null, 2), { mode: 0o600 });
    await fs.rename(tmp, file);
  };
  const next = (queues.get(key) || Promise.resolve()).catch(() => {}).then(run);
  queues.set(key, next);
  return next;
}

export async function fileSave(name, buffer, mime) {
  if (usingDb) {
    await initDb();
    await pool.query(
      `INSERT INTO umaira_files (name, mime, data) VALUES ($1, $2, $3)
       ON CONFLICT (name) DO UPDATE SET mime = EXCLUDED.mime, data = EXCLUDED.data`,
      [name, mime, buffer]
    );
    return;
  }
  const p = safeFilePath(name);
  await fs.mkdir(path.dirname(p), { recursive: true });
  await fs.writeFile(p, buffer);
}

export async function fileGet(name) {
  if (usingDb) {
    await initDb();
    const r = await pool.query("SELECT mime, data FROM umaira_files WHERE name = $1", [name]);
    return r.rows[0] ? { mime: r.rows[0].mime, data: r.rows[0].data } : null;
  }
  try {
    const data = await fs.readFile(safeFilePath(name));
    const ext = path.extname(name).slice(1).toLowerCase();
    return { mime: MIME[ext] || "application/octet-stream", data };
  } catch (err) {
    if (err.code === "ENOENT") return null;
    throw err;
  }
}

export async function fileDelete(name) {
  if (usingDb) {
    await initDb();
    await pool.query("DELETE FROM umaira_files WHERE name = $1", [name]);
    return;
  }
  await fs.rm(safeFilePath(name), { force: true });
}
