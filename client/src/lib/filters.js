export function filterSongs(songs, filters) {
  const query = filters.query.trim().toLowerCase();
  return songs
    .filter((song) => !query || `${song.nombre} ${song.artista} ${song.notas || song.nota || ""}`.toLowerCase().includes(query))
    .filter((song) => !filters.favoriteOnly || song.favorito)
    .filter((song) => filters.toneFilter === "Todos" || normalizeTone(song.tono || song.tono_original) === normalizeTone(filters.toneFilter))
    .filter((song) => {
      if (filters.capoFilter === "Todos") return true;
      if (filters.capoFilter === "Sin capo") return !song.tiene_capo;
      return Boolean(song.tiene_capo) && Number(song.traste_capo) === Number(filters.capoFilter);
    })
    .filter((song) => filters.categoryFilter === "Todas" || (song.categorias || []).includes(filters.categoryFilter))
    .filter((song) => filters.techniqueFilter === "Todas" || song.tecnica === filters.techniqueFilter);
}

function normalizeTone(tone) {
  return String(tone || "").trim().toLowerCase();
}
