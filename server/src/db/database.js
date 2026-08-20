import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DatabaseSync } from "node:sqlite";

const __dirname = dirname(fileURLToPath(import.meta.url));
const defaultPath = resolve(__dirname, "../../database.sqlite");

export function openDatabase(path = process.env.DATABASE_PATH || defaultPath) {
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec("PRAGMA foreign_keys = ON");
  migrate(db);
  return db;
}

function migrate(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS canciones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      artista TEXT,
      tono TEXT,
      tiene_capo INTEGER NOT NULL DEFAULT 0,
      traste_capo INTEGER,
      me_la_se INTEGER NOT NULL DEFAULT 0,
      notas TEXT,
      favorito INTEGER NOT NULL DEFAULT 0,
      es_wishlist INTEGER NOT NULL DEFAULT 0,
      estado TEXT NOT NULL DEFAULT 'wishlist' CHECK (estado IN ('dominada', 'wishlist')),
      categorias TEXT NOT NULL DEFAULT '[]',
      tecnica TEXT NOT NULL DEFAULT 'Rasgueo',
      imagen TEXT,
      orden INTEGER NOT NULL DEFAULT 0,
      fecha_creado TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      fecha_actualizada TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS songs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      artista TEXT,
      tono_original TEXT NOT NULL,
      tiene_capo INTEGER NOT NULL DEFAULT 0,
      traste_capo INTEGER,
      me_la_se INTEGER NOT NULL DEFAULT 0,
      notas TEXT,
      fecha_creada TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      fecha_actualizada TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS sections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      song_id INTEGER NOT NULL,
      tipo TEXT NOT NULL DEFAULT 'Intro',
      orden INTEGER NOT NULL DEFAULT 0,
      acordes TEXT NOT NULL DEFAULT '',
      nota_seccion TEXT,
      FOREIGN KEY (song_id) REFERENCES songs(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS wishlist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      artista TEXT,
      nota TEXT,
      fecha_agregada TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL DEFAULT ''
    );

    CREATE TRIGGER IF NOT EXISTS songs_touch_updated_at
    AFTER UPDATE ON songs
    FOR EACH ROW
    BEGIN
      UPDATE songs SET fecha_actualizada = CURRENT_TIMESTAMP WHERE id = OLD.id;
    END;

    CREATE TRIGGER IF NOT EXISTS canciones_touch_updated_at
    AFTER UPDATE ON canciones
    FOR EACH ROW
    BEGIN
      UPDATE canciones SET fecha_actualizada = CURRENT_TIMESTAMP WHERE id = OLD.id;
    END;
  `);

  addColumnIfMissing(db, "canciones", "favorito", "INTEGER NOT NULL DEFAULT 0");
  addColumnIfMissing(db, "canciones", "es_wishlist", "INTEGER NOT NULL DEFAULT 0");
  addColumnIfMissing(db, "canciones", "estado", "TEXT NOT NULL DEFAULT 'wishlist' CHECK (estado IN ('dominada', 'wishlist'))");
  addColumnIfMissing(db, "canciones", "categorias", "TEXT NOT NULL DEFAULT '[]'");
  addColumnIfMissing(db, "canciones", "tecnica", "TEXT NOT NULL DEFAULT 'Rasgueo'");
  addColumnIfMissing(db, "canciones", "imagen", "TEXT");
  addColumnIfMissing(db, "canciones", "orden", "INTEGER NOT NULL DEFAULT 0");
  addColumnIfMissing(db, "canciones", "fecha_actualizada", "TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP");
  migrateOldSongs(db);
  migrateOldWishlist(db);
  normalizeSongStates(db);
  normalizeSongOrder(db);
}

function addColumnIfMissing(db, table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all().map((item) => item.name);
  if (!columns.includes(column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
  }
}

function migrateOldSongs(db) {
  const legacySongs = tableExists(db, "songs")
    ? db.prepare("SELECT * FROM songs").all()
    : [];
  const insert = db.prepare(`
    INSERT INTO canciones (
      nombre, artista, tono, tiene_capo, traste_capo, me_la_se, notas,
      favorito, es_wishlist, estado, orden, fecha_creado, fecha_actualizada
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?)
  `);
  let dominatedOrder = db.prepare("SELECT COALESCE(MAX(orden), -1) + 1 AS value FROM canciones WHERE estado = 'dominada'").get().value;
  let wishlistOrder = db.prepare("SELECT COALESCE(MAX(orden), -1) + 1 AS value FROM canciones WHERE estado = 'wishlist'").get().value;
  for (const song of legacySongs) {
    const existing = db.prepare(`
      SELECT id FROM canciones
      WHERE nombre = ? AND COALESCE(artista, '') = COALESCE(?, '') AND COALESCE(tono, '') = COALESCE(?, '')
    `).get(song.nombre, song.artista || "", song.tono_original || "");
    if (!existing) {
      const state = song.me_la_se ? "dominada" : "wishlist";
      insert.run(
        song.nombre,
        song.artista || "",
        song.tono_original || "",
        song.tiene_capo || 0,
        song.traste_capo,
        song.me_la_se || 0,
        song.notas || "",
        state === "wishlist" ? 1 : 0,
        state,
        state === "dominada" ? dominatedOrder++ : wishlistOrder++,
        song.fecha_creada || new Date().toISOString(),
        song.fecha_actualizada || song.fecha_creada || new Date().toISOString()
      );
    }
  }
}

function migrateOldWishlist(db) {
  const legacyWishlist = tableExists(db, "wishlist")
    ? db.prepare("SELECT * FROM wishlist").all()
    : [];
  const insert = db.prepare(`
    INSERT INTO canciones (
      nombre, artista, tono, tiene_capo, traste_capo, me_la_se, notas,
      favorito, es_wishlist, estado, orden, fecha_creado, fecha_actualizada
    )
    VALUES (?, ?, NULL, 0, NULL, 0, ?, 0, 1, 'wishlist', ?, ?, ?)
  `);
  const maxOrder = db.prepare("SELECT COALESCE(MAX(orden), -1) AS value FROM canciones WHERE estado = 'wishlist'").get().value;
  let offset = maxOrder + 1;
  for (const item of legacyWishlist) {
    const existing = db.prepare(`
      SELECT id FROM canciones
      WHERE estado = 'wishlist' AND nombre = ? AND COALESCE(artista, '') = COALESCE(?, '')
    `).get(item.nombre, item.artista || "");
    if (!existing) {
      insert.run(
        item.nombre,
        item.artista || "",
        item.nota || "",
        offset,
        item.fecha_agregada || new Date().toISOString(),
        item.fecha_agregada || new Date().toISOString()
      );
      offset += 1;
    }
  }
}

function normalizeSongStates(db) {
  db.exec(`
    UPDATE canciones
    SET estado = CASE
      WHEN me_la_se = 1 AND es_wishlist = 0 THEN 'dominada'
      ELSE 'wishlist'
    END;

    UPDATE canciones
    SET
      me_la_se = CASE WHEN estado = 'dominada' THEN 1 ELSE 0 END,
      es_wishlist = CASE WHEN estado = 'wishlist' THEN 1 ELSE 0 END;
  `);
}

function normalizeSongOrder(db) {
  const ids = db.prepare("SELECT id FROM canciones ORDER BY orden ASC, id ASC").all().map((row) => row.id);
  const update = db.prepare("UPDATE canciones SET orden = ? WHERE id = ?");
  db.exec("BEGIN");
  try {
    ids.forEach((id, index) => update.run(index, id));
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function tableExists(db, table) {
  return Boolean(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(table));
}

export function mapSong(row, sections = []) {
  const state = row.estado || (row.me_la_se && !row.es_wishlist ? "dominada" : "wishlist");
  return {
    id: row.id,
    nombre: row.nombre,
    artista: row.artista || "",
    tono: row.tono ?? row.tono_original ?? "",
    tono_original: row.tono ?? row.tono_original ?? "",
    tiene_capo: Boolean(row.tiene_capo),
    traste_capo: row.traste_capo,
    me_la_se: state === "dominada",
    notas: row.notas || "",
    favorito: Boolean(row.favorito),
    es_wishlist: state === "wishlist",
    estado: state,
    categorias: parseCategories(row.categorias),
    tecnica: row.tecnica || "Rasgueo",
    imagen: row.imagen || "",
    orden: row.orden ?? 0,
    fecha_creado: row.fecha_creado || row.fecha_creada,
    fecha_creada: row.fecha_creado || row.fecha_creada,
    fecha_actualizada: row.fecha_actualizada,
    sections
  };
}

export function mapSection(row) {
  return {
    id: row.id,
    song_id: row.song_id,
    tipo: row.tipo,
    orden: row.orden,
    acordes: row.acordes || "",
    nota_seccion: row.nota_seccion || ""
  };
}

export function mapWishlistItem(row) {
  return {
    id: row.id,
    nombre: row.nombre,
    artista: row.artista || "",
    nota: row.nota || row.notas || "",
    notas: row.nota || row.notas || "",
    tono: row.tono || "",
    tono_original: row.tono || "",
    tiene_capo: Boolean(row.tiene_capo),
    traste_capo: row.traste_capo,
    me_la_se: Boolean(row.me_la_se),
    favorito: Boolean(row.favorito),
    es_wishlist: true,
    estado: "wishlist",
    categorias: parseCategories(row.categorias),
    tecnica: row.tecnica || "Rasgueo",
    imagen: row.imagen || "",
    orden: row.orden ?? 0,
    fecha_agregada: row.fecha_agregada || row.fecha_creado,
    fecha_creado: row.fecha_creado
  };
}

function parseCategories(value) {
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
