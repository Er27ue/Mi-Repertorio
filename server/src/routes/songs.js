import express from "express";
import { mapSection, mapSong, mapWishlistItem } from "../db/database.js";

const VALID_NOTE = /^[A-G](#|b)?[a-zA-Z0-9#/+\-()]*$/;
const SECTION_TYPES = new Set(["Intro", "Verso", "Coro", "Puente", "Outro"]);
const SONG_STATES = new Set(["dominada", "wishlist"]);
const SONG_CATEGORIES = new Set(["Adoración", "Alabanza", "Himno", "Especial", "Instrumental", "Otra", "Pop", "Rock", "Balada", "Jazz", "Folk", "Secular"]);
const SONG_TECHNIQUES = new Set(["Fingerstyle", "Rasgueo", "Ambas"]);

export function createSongsRouter(db) {
  const router = express.Router();

  router.get("/songs", (_req, res) => {
    const songs = db.prepare("SELECT * FROM canciones WHERE estado = 'dominada' ORDER BY orden ASC, id ASC").all();
    res.json(songs.map((song) => mapSong(song)));
  });

  router.post("/songs", (req, res) => {
    const validation = validateSongPayload(req.body, true);
    if (validation.error) return res.status(400).json({ error: validation.error });

    const state = resolveRequestedState(validation.data, "wishlist");
    const isWishlist = state === "wishlist";
    const stateError = validateDominatedState(validation.data, state);
    if (stateError) return res.status(400).json({ error: stateError });
    const order = nextOrder(db);
    const result = db.prepare(`
      INSERT INTO canciones (
        nombre, artista, tono, tiene_capo, traste_capo, me_la_se, notas,
        favorito, es_wishlist, estado, categorias, tecnica, imagen, orden
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      validation.data.nombre,
      validation.data.artista,
      validation.data.tono,
      validation.data.tiene_capo ? 1 : 0,
      validation.data.traste_capo,
      state === "dominada" ? 1 : 0,
      validation.data.notas,
      validation.data.favorito ? 1 : 0,
      isWishlist ? 1 : 0,
      state,
      validation.data.categorias,
      validation.data.tecnica,
      validation.data.imagen,
      order
    );

    const saved = getSong(db, Number(result.lastInsertRowid));
    res.status(201).json(saved.es_wishlist ? mapWishlistItem(saved) : saved);
  });

  router.put("/songs/reorder", (req, res) => {
    const orderedIds = Array.isArray(req.body?.ids) ? req.body.ids.map(Number) : [];
    const existingIds = db.prepare("SELECT id FROM canciones ORDER BY orden ASC, id ASC").all().map((row) => row.id);
    if (
      orderedIds.length !== existingIds.length
      || new Set(orderedIds).size !== orderedIds.length
      || orderedIds.some((id) => !existingIds.includes(id))
    ) {
      return res.status(400).json({ error: "El orden debe incluir todas las canciones una sola vez." });
    }
    persistSongOrder(db, orderedIds);
    res.json({ ids: orderedIds });
  });

  router.patch("/songs/:id", (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "ID invalido." });
    if (!songExists(db, id)) return res.status(404).json({ error: "Cancion no encontrada." });

    const existing = db.prepare("SELECT * FROM canciones WHERE id = ?").get(id);
    const validation = validateSongPayload(req.body, false);
    if (validation.error) return res.status(400).json({ error: validation.error });

    const currentState = existing.estado || (existing.me_la_se && !existing.es_wishlist ? "dominada" : "wishlist");
    const state = resolveRequestedState(validation.data, currentState);
    const stateChanged = state !== currentState;
    validation.data.estado = state;
    validation.data.me_la_se = state === "dominada";
    validation.data.es_wishlist = state === "wishlist";
    if (stateChanged) validation.data.orden = nextOrder(db);
    const stateError = validateDominatedState({ ...existing, ...validation.data }, state);
    if (stateError) return res.status(400).json({ error: stateError });

    const allowed = ["nombre", "artista", "tono", "tiene_capo", "traste_capo", "me_la_se", "notas", "favorito", "es_wishlist", "estado", "categorias", "tecnica", "imagen", "orden"];
    const updates = [];
    const values = [];
    for (const key of allowed) {
      if (key in validation.data) {
        updates.push(`${key} = ?`);
        values.push(typeof validation.data[key] === "boolean" ? Number(validation.data[key]) : validation.data[key]);
      }
    }
    if (updates.length) {
      db.prepare(`UPDATE canciones SET ${updates.join(", ")} WHERE id = ?`).run(...values, id);
    }

    const saved = getSong(db, id);
    res.json(saved.es_wishlist ? mapWishlistItem({ ...saved, nota: saved.notas }) : saved);
  });

  router.delete("/songs/:id", (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "ID invalido." });
    db.prepare("DELETE FROM canciones WHERE id = ?").run(id);
    res.status(204).end();
  });

  router.post("/songs/:id/sections", (req, res) => {
    const songId = Number(req.params.id);
    if (!Number.isInteger(songId)) return res.status(400).json({ error: "ID invalido." });
    if (!legacySongExists(db, songId)) return res.status(404).json({ error: "Cancion no encontrada." });

    const data = validateSectionPayload(req.body, false);
    if (data.error) return res.status(400).json({ error: data.error });

    const nextOrder = db.prepare("SELECT COALESCE(MAX(orden), -1) + 1 AS next FROM sections WHERE song_id = ?").get(songId).next;
    const result = db.prepare(`
      INSERT INTO sections (song_id, tipo, orden, acordes, nota_seccion)
      VALUES (?, ?, ?, ?, ?)
    `).run(songId, data.tipo || "Intro", nextOrder, data.acordes || "", data.nota_seccion || "");

    res.status(201).json(mapSection(db.prepare("SELECT * FROM sections WHERE id = ?").get(Number(result.lastInsertRowid))));
  });

  router.patch("/sections/:id", (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "ID invalido." });
    const existing = db.prepare("SELECT * FROM sections WHERE id = ?").get(id);
    if (!existing) return res.status(404).json({ error: "Seccion no encontrada." });

    const data = validateSectionPayload(req.body, false);
    if (data.error) return res.status(400).json({ error: data.error });

    if (Array.isArray(req.body.sectionsOrder)) {
      persistSectionOrder(db, existing.song_id, req.body.sectionsOrder);
      return res.json(getSong(db, existing.song_id).sections.find((section) => section.id === id));
    }

    const allowed = ["tipo", "orden", "acordes", "nota_seccion"];
    const updates = [];
    const values = [];
    for (const key of allowed) {
      if (key in data) {
        updates.push(`${key} = ?`);
        values.push(data[key]);
      }
    }

    if (updates.length) db.prepare(`UPDATE sections SET ${updates.join(", ")} WHERE id = ?`).run(...values, id);
    res.json(mapSection(db.prepare("SELECT * FROM sections WHERE id = ?").get(id)));
  });

  router.delete("/sections/:id", (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "ID invalido." });
    const existing = db.prepare("SELECT * FROM sections WHERE id = ?").get(id);
    if (!existing) return res.status(204).end();
    db.prepare("DELETE FROM sections WHERE id = ?").run(id);
    normalizeSectionOrder(db, existing.song_id);
    res.status(204).end();
  });

  router.get("/wishlist", (_req, res) => {
    const items = db.prepare("SELECT * FROM canciones WHERE estado = 'wishlist' ORDER BY orden ASC, id ASC").all();
    res.json(items.map(mapWishlistItem));
  });

  router.post("/wishlist", (req, res) => {
    const data = validateWishlistPayload(req.body);
    if (data.error) return res.status(400).json({ error: data.error });

    const result = db.prepare(`
      INSERT INTO canciones (nombre, artista, tono, tiene_capo, traste_capo, me_la_se, notas, favorito, es_wishlist, estado, orden)
      VALUES (?, ?, NULL, 0, NULL, 0, ?, 0, 1, 'wishlist', ?)
    `).run(data.nombre, data.artista, data.nota, nextOrder(db));

    const item = db.prepare("SELECT * FROM canciones WHERE id = ?").get(Number(result.lastInsertRowid));
    res.status(201).json(mapWishlistItem(item));
  });

  router.patch("/wishlist/:id", (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "ID invalido." });
    const existing = db.prepare("SELECT * FROM canciones WHERE id = ? AND estado = 'wishlist'").get(id);
    if (!existing) return res.status(404).json({ error: "Item de wishlist no encontrado." });

    const data = validateWishlistPayload({ ...existing, nota: existing.notas, ...req.body });
    if (data.error) return res.status(400).json({ error: data.error });

    db.prepare(`
      UPDATE canciones
      SET nombre = ?, artista = ?, notas = ?
      WHERE id = ?
    `).run(data.nombre, data.artista, data.nota, id);

    res.json(mapWishlistItem(db.prepare("SELECT * FROM canciones WHERE id = ?").get(id)));
  });

  router.delete("/wishlist/:id", (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id)) return res.status(400).json({ error: "ID invalido." });
    db.prepare("DELETE FROM canciones WHERE id = ? AND estado = 'wishlist'").run(id);
    res.status(204).end();
  });

  router.get("/profile", (_req, res) => {
    const row = db.prepare("SELECT value FROM app_settings WHERE key = 'profile_image'").get();
    res.json({ imagen: row?.value || "" });
  });

  router.put("/profile", (req, res) => {
    const image = String(req.body?.imagen || "");
    const imageError = validateImage(image);
    if (imageError) return res.status(400).json({ error: imageError });
    db.prepare(`
      INSERT INTO app_settings (key, value) VALUES ('profile_image', ?)
      ON CONFLICT(key) DO UPDATE SET value = excluded.value
    `).run(image);
    res.json({ imagen: image });
  });

  return router;
}

function getSong(db, id) {
  const song = db.prepare("SELECT * FROM canciones WHERE id = ?").get(id);
  return mapSong(song, []);
}

function songExists(db, id) {
  return Boolean(db.prepare("SELECT id FROM canciones WHERE id = ?").get(id));
}

function legacySongExists(db, id) {
  return Boolean(db.prepare("SELECT id FROM songs WHERE id = ?").get(id));
}

function nextOrder(db) {
  return db.prepare("SELECT COALESCE(MAX(orden), -1) + 1 AS next FROM canciones").get().next;
}

function validateSongPayload(payload, required) {
  const data = {};
  if (required || "nombre" in payload) {
    data.nombre = String(payload.nombre || "").trim();
    if (!data.nombre) return { error: "El nombre de la cancion es requerido." };
  }
  if (required || "tono" in payload || "tono_original" in payload) {
    data.tono = String(payload.tono ?? payload.tono_original ?? "").trim();
    if (data.tono && !VALID_NOTE.test(data.tono)) return { error: "El tono debe empezar con una nota valida." };
  }
  if ("artista" in payload || required) {
    data.artista = String(payload.artista || "").trim();
    if (!data.artista) return { error: "El artista o banda es requerido." };
  }
  if ("notas" in payload || required) data.notas = String(payload.notas || "").trim();
  if ("me_la_se" in payload) data.me_la_se = Boolean(payload.me_la_se);
  if ("favorito" in payload) data.favorito = Boolean(payload.favorito);
  if ("es_wishlist" in payload) data.es_wishlist = Boolean(payload.es_wishlist);
  if ("estado" in payload) {
    const state = String(payload.estado || "").trim().toLowerCase();
    if (!SONG_STATES.has(state)) return { error: "El estado debe ser dominada o wishlist." };
    data.estado = state;
  }
  if (required || "categorias" in payload) {
    const categories = Array.isArray(payload.categorias) ? [...new Set(payload.categorias.map((item) => String(item).trim()))] : [];
    if (categories.length > 3) return { error: "Selecciona como máximo 3 categorías." };
    if (categories.some((category) => !SONG_CATEGORIES.has(category))) return { error: "Hay una categoría no válida." };
    data.categorias = JSON.stringify(categories);
  }
  if (required || "tecnica" in payload) {
    const technique = String(payload.tecnica || "Rasgueo").trim();
    if (!SONG_TECHNIQUES.has(technique)) return { error: "La técnica debe ser Fingerstyle, Rasgueo o Ambas." };
    data.tecnica = technique;
  }
  if (required || "imagen" in payload) {
    const image = String(payload.imagen || "");
    const imageError = validateImage(image);
    if (imageError) return { error: imageError };
    data.imagen = image;
  }
  if ("orden" in payload) {
    const orden = Number(payload.orden);
    if (!Number.isInteger(orden) || orden < 0) return { error: "El orden debe ser un entero positivo." };
    data.orden = orden;
  }
  if ("tiene_capo" in payload || required) data.tiene_capo = Boolean(payload.tiene_capo);
  if ("traste_capo" in payload || "tiene_capo" in data || required) {
    const capo = payload.traste_capo === null || payload.traste_capo === "" ? null : Number(payload.traste_capo);
    if (data.tiene_capo && (!Number.isInteger(capo) || capo < 1 || capo > 11)) {
      return { error: "El traste del capo debe estar entre 1 y 11." };
    }
    data.traste_capo = data.tiene_capo ? capo : null;
  }
  return { data };
}

function resolveRequestedState(data, fallback) {
  if (data.estado) return data.estado;
  if (data.es_wishlist === true) return "wishlist";
  if (data.me_la_se === true) return "dominada";
  if (data.me_la_se === false) return "wishlist";
  if (data.es_wishlist === false) return "dominada";
  return fallback;
}

function validateDominatedState(data, state) {
  if (state !== "dominada") return "";
  if (!String(data.tono || "").trim()) return "El tono es requerido para marcarla como dominada.";
  if (Boolean(data.tiene_capo) && !Number.isInteger(Number(data.traste_capo))) {
    return "Completa el traste del capo antes de marcarla como dominada.";
  }
  return "";
}

function validateSectionPayload(payload) {
  const data = {};
  if ("tipo" in payload) {
    const tipo = String(payload.tipo || "").trim();
    if (!tipo) return { error: "El tipo de seccion es requerido." };
    data.tipo = SECTION_TYPES.has(tipo) ? tipo : tipo.slice(0, 40);
  }
  if ("orden" in payload) {
    const orden = Number(payload.orden);
    if (!Number.isInteger(orden) || orden < 0) return { error: "El orden debe ser un entero positivo." };
    data.orden = orden;
  }
  if ("acordes" in payload) data.acordes = String(payload.acordes || "");
  if ("nota_seccion" in payload) data.nota_seccion = String(payload.nota_seccion || "");
  return data;
}

function validateWishlistPayload(payload) {
  const nombre = String(payload.nombre || "").trim();
  if (!nombre) return { error: "El nombre de la cancion es requerido." };
  return {
    nombre,
    artista: String(payload.artista || "").trim(),
    nota: String(payload.nota || "").trim()
  };
}

function persistSectionOrder(db, songId, orderedIds) {
  const existing = db.prepare("SELECT id FROM sections WHERE song_id = ?").all(songId).map((row) => row.id);
  const valid = orderedIds.map(Number).filter((id) => existing.includes(id));
  const missing = existing.filter((id) => !valid.includes(id));
  const finalOrder = [...valid, ...missing];
  const update = db.prepare("UPDATE sections SET orden = ? WHERE id = ?");
  db.exec("BEGIN");
  try {
    finalOrder.forEach((sectionId, index) => update.run(index, sectionId));
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function persistSongOrder(db, orderedIds) {
  const update = db.prepare("UPDATE canciones SET orden = ? WHERE id = ?");
  db.exec("BEGIN");
  try {
    orderedIds.forEach((id, index) => update.run(index, id));
    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function validateImage(image) {
  if (image && !/^data:image\/(jpeg|png|webp);base64,/i.test(image)) return "La imagen debe ser JPEG, PNG o WebP.";
  if (image.length > 4_500_000) return "La imagen es demasiado grande.";
  return "";
}

function normalizeSectionOrder(db, songId) {
  const ids = db.prepare("SELECT id FROM sections WHERE song_id = ? ORDER BY orden ASC, id ASC").all(songId).map((row) => row.id);
  persistSectionOrder(db, songId, ids);
}
