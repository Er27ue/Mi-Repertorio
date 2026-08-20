import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import { createApp } from "./src/app.js";
import { openDatabase } from "./src/db/database.js";

test("persiste canciones y secciones en un archivo sqlite real", () => {
  const dir = mkdtempSync(join(tmpdir(), "repertorio-"));
  const dbPath = join(dir, "database.sqlite");
  try {
    let db = openDatabase(dbPath);
    const song = db.prepare(`
      INSERT INTO songs (nombre, artista, tono_original, tiene_capo, traste_capo)
      VALUES (?, ?, ?, ?, ?)
    `).run("Blackbird", "The Beatles", "G", 0, null);
    db.prepare(`
      INSERT INTO sections (song_id, tipo, orden, acordes, nota_seccion)
      VALUES (?, ?, ?, ?, ?)
    `).run(Number(song.lastInsertRowid), "Intro", 0, "G Am D", "");
    db.close();

    db = openDatabase(dbPath);
    const row = db.prepare("SELECT songs.nombre, sections.acordes FROM songs JOIN sections ON sections.song_id = songs.id").get();
    assert.equal(row.nombre, "Blackbird");
    assert.equal(row.acordes, "G Am D");
    db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("CRUD basico de canciones via HTTP usando tabla canciones", async () => {
  const dir = mkdtempSync(join(tmpdir(), "repertorio-api-"));
  const dbPath = join(dir, "database.sqlite");
  const db = openDatabase(dbPath);
  const server = createApp(db).listen(0);
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const createdSong = await api(baseUrl, "/songs", {
      method: "POST",
      body: { nombre: "Tuyo", artista: "Rodrigo Amarante", tono: "Am", tiene_capo: true, traste_capo: 2, estado: "dominada" }
    });
    assert.equal(createdSong.nombre, "Tuyo");
    assert.equal(createdSong.tono, "Am");
    assert.equal(createdSong.tiene_capo, true);
    assert.equal(createdSong.es_wishlist, false);
    assert.equal(createdSong.estado, "dominada");

    const updatedSong = await api(baseUrl, `/songs/${createdSong.id}`, {
      method: "PATCH",
      body: { nombre: "Tuyo editada", tono: "Bm", tiene_capo: false }
    });
    assert.equal(updatedSong.nombre, "Tuyo editada");
    assert.equal(updatedSong.tono, "Bm");
    assert.equal(updatedSong.traste_capo, null);

    const songs = await api(baseUrl, "/songs");
    assert.equal(songs.length, 1);
    assert.equal(songs[0].sections.length, 0);

    await api(baseUrl, `/songs/${createdSong.id}`, { method: "DELETE" });
    const empty = await api(baseUrl, "/songs");
    assert.equal(empty.length, 0);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("checklist me_la_se y wishlist funcionan desde canciones", async () => {
  const dir = mkdtempSync(join(tmpdir(), "repertorio-wishlist-"));
  const dbPath = join(dir, "database.sqlite");
  const db = openDatabase(dbPath);
  const server = createApp(db).listen(0);
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const song = await api(baseUrl, "/songs", {
      method: "POST",
      body: { nombre: "Linger", artista: "The Cranberries", tono: "D", tiene_capo: false }
    });
    assert.equal(song.me_la_se, false);

    const knownSong = await api(baseUrl, `/songs/${song.id}`, {
      method: "PATCH",
      body: { me_la_se: true }
    });
    assert.equal(knownSong.me_la_se, true);

    const favoriteSong = await api(baseUrl, `/songs/${song.id}`, {
      method: "PATCH",
      body: { favorito: true }
    });
    assert.equal(favoriteSong.favorito, true);

    const wish = await api(baseUrl, "/wishlist", {
      method: "POST",
      body: { nombre: "Harvest Moon", artista: "Neil Young", nota: "version acustica" }
    });
    assert.equal(wish.nombre, "Harvest Moon");
    assert.equal(wish.nota, "version acustica");

    const wishlist = await api(baseUrl, "/wishlist");
    assert.equal(wishlist.length, 1);
    assert.equal(db.prepare("SELECT COUNT(*) AS total FROM canciones WHERE es_wishlist = 1").get().total, 1);

    const favoriteWish = await api(baseUrl, `/songs/${wish.id}`, {
      method: "PATCH",
      body: { favorito: true }
    });
    assert.equal(favoriteWish.favorito, true);

    const editedWish = await api(baseUrl, `/wishlist/${wish.id}`, {
      method: "PATCH",
      body: { nota: "sacar intro y coro" }
    });
    assert.equal(editedWish.nota, "sacar intro y coro");

    const promoted = await api(baseUrl, `/songs/${wish.id}`, {
      method: "PATCH",
      body: { tono: "G", tiene_capo: true, traste_capo: 2, estado: "dominada" }
    });
    assert.equal(promoted.nombre, "Harvest Moon");
    assert.equal(promoted.es_wishlist, false);
    assert.equal(promoted.estado, "dominada");
    assert.equal(promoted.tono, "G");

    const emptyWishlistAfterPromote = await api(baseUrl, "/wishlist");
    assert.equal(emptyWishlistAfterPromote.length, 0);

    const repertorio = await api(baseUrl, "/songs");
    assert.equal(repertorio.length, 2);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("el formulario unificado crea y mueve canciones entre wishlist y dominadas", async () => {
  const dir = mkdtempSync(join(tmpdir(), "repertorio-status-"));
  const dbPath = join(dir, "database.sqlite");
  const db = openDatabase(dbPath);
  const server = createApp(db).listen(0);
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const wish = await api(baseUrl, "/songs", {
      method: "POST",
      body: {
        nombre: "Oceans",
        artista: "Hillsong United",
        tono: "",
        es_wishlist: true,
        me_la_se: false,
        favorito: false,
        notas: "Aprender la intro",
        categorias: ["Adoración", "Pop"],
        tecnica: "Ambas",
        imagen: "data:image/png;base64,iVBORw0KGgo="
      }
    });
    assert.equal(wish.es_wishlist, true);
    assert.deepEqual(wish.categorias, ["Adoración", "Pop"]);
    assert.equal(wish.tecnica, "Ambas");
    assert.match(wish.imagen, /^data:image\/png;base64,/);
    assert.equal((await api(baseUrl, "/wishlist")).length, 1);

    const incompletePromotion = await fetch(`${baseUrl}/songs/${wish.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estado: "dominada" })
    });
    assert.equal(incompletePromotion.status, 400);
    assert.match((await incompletePromotion.json()).error, /tono/i);
    assert.equal((await api(baseUrl, "/wishlist")).length, 1);

    const mastered = await api(baseUrl, `/songs/${wish.id}`, {
      method: "PATCH",
      body: { estado: "dominada", tono: "D", favorito: true }
    });
    assert.equal(mastered.me_la_se, true);
    assert.equal(mastered.favorito, true);
    assert.equal((await api(baseUrl, "/wishlist")).length, 0);

    const persisted = (await api(baseUrl, "/songs")).find((song) => song.id === wish.id);
    assert.deepEqual(persisted.categorias, ["Adoración", "Pop"]);
    assert.equal(persisted.tecnica, "Ambas");
    assert.equal(persisted.imagen, wish.imagen);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("migra en progreso a wishlist sin perder canciones", () => {
  const dir = mkdtempSync(join(tmpdir(), "repertorio-migration-"));
  const dbPath = join(dir, "database.sqlite");

  try {
    const legacyDb = new DatabaseSync(dbPath);
    legacyDb.exec(`
      CREATE TABLE canciones (
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
        orden INTEGER NOT NULL DEFAULT 0,
        fecha_creado TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        fecha_actualizada TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      INSERT INTO canciones (nombre, artista, me_la_se, es_wishlist, favorito, orden)
      VALUES
        ('Aprendiendo', 'Banda A', 0, 0, 1, 0),
        ('Lista', 'Banda B', 1, 0, 1, 1),
        ('Deseada', 'Banda C', 0, 1, 0, 2);
    `);
    legacyDb.close();

    const db = openDatabase(dbPath);
    const rows = db.prepare("SELECT * FROM canciones ORDER BY id").all();
    assert.equal(rows.length, 3);
    assert.equal(rows[0].nombre, "Aprendiendo");
    assert.equal(rows[0].estado, "wishlist");
    assert.equal(rows[0].es_wishlist, 1);
    assert.equal(rows[0].favorito, 1);
    assert.equal(rows[1].estado, "dominada");
    assert.equal(rows[1].me_la_se, 1);
    assert.equal(rows[2].estado, "wishlist");
    assert.throws(() => db.prepare("UPDATE canciones SET estado = 'en_progreso' WHERE id = 1").run());
    db.close();

    const reopened = openDatabase(dbPath);
    assert.equal(reopened.prepare("SELECT COUNT(*) AS total FROM canciones").get().total, 3);
    reopened.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("persiste foto de perfil y orden manual de todas las canciones", async () => {
  const dir = mkdtempSync(join(tmpdir(), "repertorio-profile-order-"));
  const dbPath = join(dir, "database.sqlite");
  const db = openDatabase(dbPath);
  const server = createApp(db).listen(0);
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const first = await api(baseUrl, "/songs", {
      method: "POST",
      body: { nombre: "Primera", artista: "Banda", tono: "C", estado: "dominada" }
    });
    const second = await api(baseUrl, "/songs", {
      method: "POST",
      body: { nombre: "Segunda", artista: "Banda", tono: "D", estado: "dominada" }
    });
    const third = await api(baseUrl, "/songs", {
      method: "POST",
      body: { nombre: "Tercera", artista: "Banda", estado: "wishlist", favorito: true }
    });

    await api(baseUrl, "/songs/reorder", {
      method: "PUT",
      body: { ids: [third.id, second.id, first.id] }
    });
    assert.deepEqual((await api(baseUrl, "/songs")).map((song) => song.id), [second.id, first.id]);
    const wishlist = await api(baseUrl, "/wishlist");
    assert.equal(wishlist[0].id, third.id);
    assert.equal(wishlist[0].favorito, true);

    const imagen = "data:image/png;base64,iVBORw0KGgo=";
    assert.deepEqual(await api(baseUrl, "/profile", { method: "PUT", body: { imagen } }), { imagen });
    assert.deepEqual(await api(baseUrl, "/profile"), { imagen });
  } finally {
    await new Promise((resolve) => server.close(resolve));
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

async function api(baseUrl, path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: options.method || "GET",
    headers: options.body ? { "Content-Type": "application/json" } : undefined,
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  if (response.status === 204) return null;
  const data = await response.json();
  assert.equal(response.ok, true, data.error);
  return data;
}
