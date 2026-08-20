const DB_NAME = "mi-repertorio";
const DB_VERSION = 1;
const SONGS_STORE = "canciones";
const SETTINGS_STORE = "ajustes";
const LEGACY_STORE = "mi-repertorio-phone-v1";

let databasePromise;
let writeQueue = Promise.resolve();

export async function getSongs() {
  return localSongs("dominada");
}

export async function createSong(payload) {
  return enqueueWrite(() => localCreate(payload));
}

export async function updateSong(id, payload) {
  return enqueueWrite(() => localUpdate(id, payload));
}

export async function deleteSong(id) {
  return enqueueWrite(() => localDelete(id));
}

export async function reorderSongs(ids) {
  return enqueueWrite(() => localReorder(ids));
}

export async function getWishlist() {
  return localSongs("wishlist").then((songs) => songs.map(wishlistItem));
}

export async function createWishlistItem(payload) {
  return enqueueWrite(() => localCreate({ ...payload, notas: payload.nota || "", estado: "wishlist" }).then(wishlistItem));
}

export async function updateWishlistItem(id, payload) {
  return enqueueWrite(() => localUpdate(id, { ...payload, notas: payload.nota, estado: "wishlist" }).then(wishlistItem));
}

export async function deleteWishlistItem(id) {
  return enqueueWrite(() => localDelete(id));
}

export async function getProfile() {
  const db = await openDatabase();
  const setting = await readRequest(db.transaction(SETTINGS_STORE).objectStore(SETTINGS_STORE).get("profileImage"));
  return { imagen: String(setting?.value || "") };
}

export async function updateProfile(imagen) {
  return enqueueWrite(async () => {
    const value = String(imagen || "");
    const db = await openDatabase();
    const transaction = db.transaction(SETTINGS_STORE, "readwrite");
    transaction.objectStore(SETTINGS_STORE).put({ key: "profileImage", value });
    await transactionDone(transaction);
    return { imagen: value };
  });
}

async function localSongs(state) {
  const songs = await allSongs();
  return songs
    .filter((song) => song.estado === state)
    .sort((a, b) => Number(a.orden) - Number(b.orden) || Number(a.id) - Number(b.id));
}

async function localCreate(payload) {
  const db = await openDatabase();
  const existing = await allSongs(db);
  const song = normalize(payload, {
    orden: nextOrder(existing),
    fecha_creado: new Date().toISOString(),
  });
  const transaction = db.transaction(SONGS_STORE, "readwrite");
  const id = await readRequest(transaction.objectStore(SONGS_STORE).add(song));
  await transactionDone(transaction);
  return { ...song, id };
}

async function localUpdate(id, payload) {
  const numericId = Number(id);
  const db = await openDatabase();
  const transaction = db.transaction(SONGS_STORE, "readwrite");
  const store = transaction.objectStore(SONGS_STORE);
  const current = await readRequest(store.get(numericId));
  if (!current) {
    transaction.abort();
    throw new Error("Cancion no encontrada.");
  }
  const song = normalize({ ...current, ...payload }, current);
  store.put(song);
  await transactionDone(transaction);
  return song;
}

async function localDelete(id) {
  const db = await openDatabase();
  const transaction = db.transaction(SONGS_STORE, "readwrite");
  transaction.objectStore(SONGS_STORE).delete(Number(id));
  await transactionDone(transaction);
  return null;
}

async function localReorder(ids) {
  const positions = new Map(ids.map((id, index) => [Number(id), index]));
  const db = await openDatabase();
  const transaction = db.transaction(SONGS_STORE, "readwrite");
  const store = transaction.objectStore(SONGS_STORE);
  const songs = await readRequest(store.getAll());
  songs.forEach((song) => {
    const position = positions.get(Number(song.id));
    if (position !== undefined) store.put({ ...song, orden: position });
  });
  await transactionDone(transaction);
  return { ids };
}

async function allSongs(database) {
  const db = database || await openDatabase();
  return readRequest(db.transaction(SONGS_STORE).objectStore(SONGS_STORE).getAll());
}

async function openDatabase() {
  if (!databasePromise) {
    databasePromise = new Promise((resolve, reject) => {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(SONGS_STORE)) {
          db.createObjectStore(SONGS_STORE, { keyPath: "id", autoIncrement: true });
        }
        if (!db.objectStoreNames.contains(SETTINGS_STORE)) {
          db.createObjectStore(SETTINGS_STORE, { keyPath: "key" });
        }
      };
      request.onerror = () => reject(request.error || new Error("No se pudo abrir la base de datos local."));
      request.onblocked = () => reject(new Error("La base de datos local esta bloqueada por otra ventana."));
      request.onsuccess = async () => {
        const db = request.result;
        db.onversionchange = () => db.close();
        try {
          await migrateLegacyData(db);
          resolve(db);
        } catch (error) {
          db.close();
          databasePromise = undefined;
          reject(error);
        }
      };
    });
  }
  return databasePromise;
}

async function migrateLegacyData(db) {
  const migrated = await readRequest(db.transaction(SETTINGS_STORE).objectStore(SETTINGS_STORE).get("legacyMigrated"));
  if (migrated?.value) return;

  let legacy = null;
  try {
    legacy = JSON.parse(window.localStorage.getItem(LEGACY_STORE) || "null");
  } catch {
    legacy = null;
  }

  const transaction = db.transaction([SONGS_STORE, SETTINGS_STORE], "readwrite");
  const songsStore = transaction.objectStore(SONGS_STORE);
  const settingsStore = transaction.objectStore(SETTINGS_STORE);
  if (Array.isArray(legacy?.songs)) {
    legacy.songs.forEach((song) => songsStore.put(normalize(song, song)));
  }
  if (legacy?.profileImage) {
    settingsStore.put({ key: "profileImage", value: String(legacy.profileImage) });
  }
  settingsStore.put({ key: "legacyMigrated", value: true });
  await transactionDone(transaction);
}

function enqueueWrite(operation) {
  const result = writeQueue.then(operation, operation);
  writeQueue = result.catch(() => undefined);
  return result;
}

function readRequest(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Error al leer la base de datos local."));
  });
}

function transactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error || new Error("Error al guardar en la base de datos local."));
    transaction.onabort = () => reject(transaction.error || new Error("La operacion local fue cancelada."));
  });
}

function normalize(payload, defaults = {}) {
  const state = payload.estado === "dominada" || payload.me_la_se === true || payload.es_wishlist === false ? "dominada" : "wishlist";
  const tieneCapo = Boolean(payload.tiene_capo);
  const tono = String(payload.tono ?? payload.tono_original ?? "").trim();
  const song = {
    nombre: String(payload.nombre || "").trim(),
    artista: String(payload.artista || "").trim(),
    tono,
    tono_original: tono,
    tiene_capo: tieneCapo,
    traste_capo: tieneCapo && payload.traste_capo !== "" && payload.traste_capo != null ? Number(payload.traste_capo) : null,
    me_la_se: state === "dominada",
    notas: String(payload.notas ?? payload.nota ?? ""),
    favorito: Boolean(payload.favorito),
    es_wishlist: state === "wishlist",
    estado: state,
    categorias: Array.isArray(payload.categorias) ? payload.categorias : [],
    tecnica: payload.tecnica || "Rasgueo",
    imagen: String(payload.imagen || ""),
    orden: Number(defaults.orden) || 0,
    fecha_creado: defaults.fecha_creado || new Date().toISOString(),
  };
  if (defaults.id != null) song.id = Number(defaults.id);
  return song;
}

function wishlistItem(song) {
  return { ...song, nota: song.notas, es_wishlist: true, estado: "wishlist" };
}

function nextOrder(songs) {
  return songs.reduce((max, song) => Math.max(max, Number(song.orden) || 0), -1) + 1;
}

