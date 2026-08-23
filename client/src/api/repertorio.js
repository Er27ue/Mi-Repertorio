import { supabase } from "../lib/supabaseClient.js";

const DB_NAME = "mi-repertorio";
const DB_VERSION = 1;
const SONGS_STORE = "canciones";
const SETTINGS_STORE = "ajustes";
const LEGACY_STORE = "mi-repertorio-phone-v1";
const DEVICE_KEY = "mi-repertorio-device-id";

let databasePromise;
let writeQueue = Promise.resolve();

export async function migrateLocalData(userId) {
  const db = await openDatabase();
  const migrationKey = `supabaseMigrated:${userId}`;
  const migrated = await getLocalSetting(db, migrationKey);
  if (migrated?.value) return { imported: 0 };

  const [localSongs, localProfile, cloudSongs] = await Promise.all([
    allLocalSongs(db),
    getLocalSetting(db, "profileImage"),
    fetchCloudSongs(),
  ]);
  const knownSongs = new Set(cloudSongs.map(songFingerprint));
  const deviceId = getDeviceId();
  const missingSongs = localSongs.filter((song) => !knownSongs.has(songFingerprint(song)));

  if (missingSongs.length) {
    const rows = missingSongs.map((song, index) => ({
      ...toDatabaseSong(normalize(song, song)),
      user_id: userId,
      origen_local_id: `${deviceId}:${song.id ?? index}`,
    }));
    const { error } = await supabase.from("canciones").upsert(rows, {
      onConflict: "user_id,origen_local_id",
      ignoreDuplicates: true,
    });
    if (error) throw dataError(error);
  }

  if (localProfile?.value) {
    const { data: profile } = await supabase
      .from("ajustes")
      .select("valor")
      .eq("clave", "profileImage")
      .maybeSingle();
    if (!profile?.valor) await updateProfile(localProfile.value);
  }

  await setLocalSetting(db, migrationKey, true);
  return { imported: missingSongs.length };
}

export async function getSongs() {
  return fetchCloudSongs().then((songs) => songs.filter((song) => song.estado === "dominada"));
}

export async function createSong(payload) {
  return enqueueWrite(async () => {
    const user = await requireUser();
    const order = await nextCloudOrder();
    const song = normalize(payload, { orden: order, fecha_creado: new Date().toISOString() });
    const { data, error } = await supabase
      .from("canciones")
      .insert({ ...toDatabaseSong(song), user_id: user.id })
      .select()
      .single();
    if (error) throw dataError(error);
    return fromDatabaseSong(data);
  });
}

export async function updateSong(id, payload) {
  return enqueueWrite(async () => {
    const { data: current, error: readError } = await supabase.from("canciones").select("*").eq("id", id).single();
    if (readError) throw dataError(readError);
    const existing = fromDatabaseSong(current);
    const song = normalize({ ...existing, ...payload }, existing);
    const { data, error } = await supabase
      .from("canciones")
      .update({ ...toDatabaseSong(song), updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .single();
    if (error) throw dataError(error);
    return fromDatabaseSong(data);
  });
}

export async function deleteSong(id) {
  return enqueueWrite(async () => {
    const { error } = await supabase.from("canciones").delete().eq("id", id);
    if (error) throw dataError(error);
    return null;
  });
}

export async function reorderSongs(ids) {
  return enqueueWrite(async () => {
    const results = await Promise.all(ids.map((id, orden) => (
      supabase.from("canciones").update({ orden, updated_at: new Date().toISOString() }).eq("id", id)
    )));
    const failed = results.find((result) => result.error);
    if (failed?.error) throw dataError(failed.error);
    return { ids };
  });
}

export async function getWishlist() {
  return fetchCloudSongs().then((songs) => songs.filter((song) => song.estado === "wishlist").map(wishlistItem));
}

export async function getProfile() {
  const { data, error } = await supabase.from("ajustes").select("valor").eq("clave", "profileImage").maybeSingle();
  if (error) throw dataError(error);
  return { imagen: String(data?.valor || "") };
}

export async function updateProfile(imagen) {
  return enqueueWrite(async () => {
    const user = await requireUser();
    const value = String(imagen || "");
    const { error } = await supabase.from("ajustes").upsert({
      user_id: user.id,
      clave: "profileImage",
      valor: value,
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,clave" });
    if (error) throw dataError(error);
    return { imagen: value };
  });
}

async function fetchCloudSongs() {
  const { data, error } = await supabase
    .from("canciones")
    .select("*")
    .order("orden", { ascending: true })
    .order("fecha_creado", { ascending: true });
  if (error) throw dataError(error);
  return (data || []).map(fromDatabaseSong);
}

async function nextCloudOrder() {
  const { data, error } = await supabase.from("canciones").select("orden").order("orden", { ascending: false }).limit(1).maybeSingle();
  if (error) throw dataError(error);
  return Number(data?.orden ?? -1) + 1;
}

async function requireUser() {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw new Error("Inicia sesion para sincronizar tu repertorio.");
  return data.user;
}

function enqueueWrite(operation) {
  const result = writeQueue.then(operation, operation);
  writeQueue = result.catch(() => undefined);
  return result;
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
    orden: Number(payload.orden ?? defaults.orden) || 0,
    fecha_creado: payload.fecha_creado || defaults.fecha_creado || new Date().toISOString(),
  };
  if (defaults.id != null || payload.id != null) song.id = String(payload.id ?? defaults.id);
  return song;
}

function toDatabaseSong(song) {
  return {
    nombre: song.nombre,
    artista: song.artista,
    tono: song.tono,
    tono_original: song.tono_original,
    tiene_capo: song.tiene_capo,
    traste_capo: song.traste_capo,
    me_la_se: song.me_la_se,
    notas: song.notas,
    favorito: song.favorito,
    es_wishlist: song.es_wishlist,
    estado: song.estado,
    categorias: song.categorias,
    tecnica: song.tecnica,
    imagen: song.imagen,
    orden: song.orden,
    fecha_creado: song.fecha_creado,
  };
}

function fromDatabaseSong(row) {
  return { ...normalize(row, row), id: String(row.id), updated_at: row.updated_at };
}

function wishlistItem(song) {
  return { ...song, nota: song.notas, es_wishlist: true, estado: "wishlist" };
}

function songFingerprint(song) {
  return `${String(song.nombre || "").trim().toLocaleLowerCase()}::${String(song.artista || "").trim().toLocaleLowerCase()}`;
}

function dataError(error) {
  if (error?.code === "23505") return new Error("Esa cancion ya fue sincronizada.");
  return new Error(error?.message || "No se pudo sincronizar con Supabase.");
}

function getDeviceId() {
  let id = window.localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    window.localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

async function openDatabase() {
  if (!databasePromise) {
    databasePromise = new Promise((resolve, reject) => {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(SONGS_STORE)) db.createObjectStore(SONGS_STORE, { keyPath: "id", autoIncrement: true });
        if (!db.objectStoreNames.contains(SETTINGS_STORE)) db.createObjectStore(SETTINGS_STORE, { keyPath: "key" });
      };
      request.onerror = () => reject(request.error || new Error("No se pudo abrir la base de datos local."));
      request.onsuccess = async () => {
        const db = request.result;
        db.onversionchange = () => db.close();
        await migrateLegacyData(db);
        resolve(db);
      };
    });
  }
  return databasePromise;
}

async function migrateLegacyData(db) {
  const migrated = await getLocalSetting(db, "legacyMigrated");
  if (migrated?.value) return;
  let legacy = null;
  try { legacy = JSON.parse(window.localStorage.getItem(LEGACY_STORE) || "null"); } catch { legacy = null; }
  const transaction = db.transaction([SONGS_STORE, SETTINGS_STORE], "readwrite");
  if (Array.isArray(legacy?.songs)) legacy.songs.forEach((song) => transaction.objectStore(SONGS_STORE).put(normalize(song, song)));
  if (legacy?.profileImage) transaction.objectStore(SETTINGS_STORE).put({ key: "profileImage", value: String(legacy.profileImage) });
  transaction.objectStore(SETTINGS_STORE).put({ key: "legacyMigrated", value: true });
  await transactionDone(transaction);
}

async function allLocalSongs(db) {
  return readRequest(db.transaction(SONGS_STORE).objectStore(SONGS_STORE).getAll());
}

async function getLocalSetting(db, key) {
  return readRequest(db.transaction(SETTINGS_STORE).objectStore(SETTINGS_STORE).get(key));
}

async function setLocalSetting(db, key, value) {
  const transaction = db.transaction(SETTINGS_STORE, "readwrite");
  transaction.objectStore(SETTINGS_STORE).put({ key, value });
  return transactionDone(transaction);
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
