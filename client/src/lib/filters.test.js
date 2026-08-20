import assert from "node:assert/strict";
import test from "node:test";
import { filterSongs } from "./filters.js";

const songs = [
  { id: 1, nombre: "Es por fe", artista: "Generación 12", tono: "E", tiene_capo: true, traste_capo: 1, favorito: true, categorias: ["Alabanza", "Rock"], tecnica: "Rasgueo", notas: "Intro" },
  { id: 2, nombre: "Santo", artista: "Banda", tono: "G", tiene_capo: false, traste_capo: null, favorito: false, categorias: ["Adoración"], tecnica: "Fingerstyle", notas: "Suave" },
  { id: 3, nombre: "Himno", artista: "Iglesia", tono: "E", tiene_capo: false, traste_capo: null, favorito: true, categorias: ["Himno"], tecnica: "Ambas", notas: "" }
];

const defaults = {
  query: "",
  favoriteOnly: false,
  toneFilter: "Todos",
  capoFilter: "Todos",
  categoryFilter: "Todas",
  techniqueFilter: "Todas"
};

test("combina texto, tono, capo, categoría, técnica y favoritos", () => {
  const result = filterSongs(songs, {
    ...defaults,
    query: "generación",
    favoriteOnly: true,
    toneFilter: "E",
    capoFilter: "1",
    categoryFilter: "Rock",
    techniqueFilter: "Rasgueo"
  });
  assert.deepEqual(result.map((song) => song.id), [1]);
});

test("distingue canciones sin capo", () => {
  const result = filterSongs(songs, { ...defaults, capoFilter: "Sin capo" });
  assert.deepEqual(result.map((song) => song.id), [2, 3]);
});

test("devuelve una lista vacía cuando una combinación no coincide", () => {
  const result = filterSongs(songs, { ...defaults, toneFilter: "G", categoryFilter: "Himno" });
  assert.deepEqual(result, []);
});
