import assert from "node:assert/strict";
import test from "node:test";
import { transponerAcorde, transponerLineaDeAcordes, transponerTono } from "./transpose.js";

test("transporta acordes simples", () => {
  assert.equal(transponerAcorde("C", 2), "D");
  assert.equal(transponerAcorde("G", 1), "G#");
  assert.equal(transponerAcorde("A", -2), "G");
});

test("conserva sufijos comunes", () => {
  assert.equal(transponerAcorde("Am", 2), "Bm");
  assert.equal(transponerAcorde("Cmaj7", 2), "Dmaj7");
  assert.equal(transponerAcorde("Dsus4", 2), "Esus4");
  assert.equal(transponerAcorde("Fdim", 1), "F#dim");
  assert.equal(transponerAcorde("Gaug", -2), "Faug");
});

test("transporta slash chords en raiz y bajo", () => {
  assert.equal(transponerAcorde("D/F#", 2), "E/G#");
  assert.equal(transponerAcorde("C/E", -1), "B/Eb");
});

test("resuelve wrap-around cromatico en ambas direcciones", () => {
  assert.equal(transponerAcorde("B", 1), "C");
  assert.equal(transponerAcorde("C", -1), "B");
  assert.equal(transponerAcorde("Bb", 3), "C#");
  assert.equal(transponerAcorde("C#", -2), "B");
});

test("deja intactos tokens no reconocidos", () => {
  assert.equal(transponerAcorde("N.C.", 2), "N.C.");
  assert.equal(transponerAcorde("x2", 2), "x2");
  assert.equal(transponerLineaDeAcordes("G - N.C. - x2 - D/F#", 2), "A - N.C. - x2 - E/G#");
});

test("transporta lineas completas y tono general", () => {
  assert.equal(transponerLineaDeAcordes("G D/F# Em C", 2), "A E/G# F#m D");
  assert.equal(transponerLineaDeAcordes("Am, F; C: G", -2), "Gm, Eb; Bb: F");
  assert.equal(transponerTono("F#m7", 3), "Am7");
});
