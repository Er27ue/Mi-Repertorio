import assert from "node:assert/strict";
import test from "node:test";
import { searchSongs } from "./songSearch.js";

test("normaliza resultados de canciones de iTunes", async (context) => {
  context.mock.method(globalThis, "fetch", async (url) => {
    assert.equal(url.searchParams.get("term"), "Glorioso");
    assert.equal(url.searchParams.get("entity"), "song");
    assert.equal(url.searchParams.get("limit"), "8");
    return {
      ok: true,
      json: async () => ({
        results: [{
          trackId: 42,
          trackName: "Glorioso",
          artistName: "BJ Putnam",
          artworkUrl100: "http://example.com/cover.jpg",
        }],
      }),
    };
  });

  assert.deepEqual(await searchSongs(" Glorioso "), [{
    id: "42",
    name: "Glorioso",
    artist: "BJ Putnam",
    artwork: "https://example.com/cover.jpg",
  }]);
});

test("no hace peticiones con una busqueda demasiado corta", async (context) => {
  const fetchMock = context.mock.method(globalThis, "fetch", async () => {
    throw new Error("No debe ejecutarse");
  });

  assert.deepEqual(await searchSongs("G"), []);
  assert.equal(fetchMock.mock.callCount(), 0);
});

test("descarta resultados sin nombre o artista", async (context) => {
  context.mock.method(globalThis, "fetch", async () => ({
    ok: true,
    json: async () => ({ results: [{ trackName: "Sin artista" }, { artistName: "Sin canción" }] }),
  }));

  assert.deepEqual(await searchSongs("prueba"), []);
});

