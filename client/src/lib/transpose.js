const SHARP_NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const FLAT_NOTES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
const NOTE_TO_INDEX = new Map([
  ["C", 0],
  ["B#", 0],
  ["C#", 1],
  ["Db", 1],
  ["D", 2],
  ["D#", 3],
  ["Eb", 3],
  ["E", 4],
  ["Fb", 4],
  ["E#", 5],
  ["F", 5],
  ["F#", 6],
  ["Gb", 6],
  ["G", 7],
  ["G#", 8],
  ["Ab", 8],
  ["A", 9],
  ["A#", 10],
  ["Bb", 10],
  ["B", 11],
  ["Cb", 11]
]);

const CHORD_RE = /^([A-G](?:#|b)?)([^/\s]*)(?:\/([A-G](?:#|b)?))?$/;

export function transponerAcorde(acorde, semitonos) {
  if (!acorde || semitonos === 0) return acorde;
  const match = acorde.match(CHORD_RE);
  if (!match) return acorde;

  const [, root, suffix, bass] = match;
  const transposedRoot = transposeNote(root, semitonos);
  if (!transposedRoot) return acorde;

  if (!bass) return `${transposedRoot}${suffix}`;

  const transposedBass = transposeNote(bass, semitonos);
  if (!transposedBass) return acorde;
  return `${transposedRoot}${suffix}/${transposedBass}`;
}

export function transponerLineaDeAcordes(linea, semitonos) {
  if (!linea || semitonos === 0) return linea;
  return linea.replace(/(?<![A-Za-z.])[A-G](?:#|b)?[^/\s|,;:.]*(?:\/[A-G](?:#|b)?)?/g, (token) => transponerAcorde(token, semitonos));
}

export function transponerTono(tono, semitonos) {
  return transponerAcorde(tono, semitonos);
}

function transposeNote(note, semitonos) {
  const index = NOTE_TO_INDEX.get(note);
  if (index === undefined) return null;
  const scale = semitonos < 0 ? FLAT_NOTES : SHARP_NOTES;
  return scale[mod(index + semitonos, 12)];
}

function mod(value, base) {
  return ((value % base) + base) % base;
}
