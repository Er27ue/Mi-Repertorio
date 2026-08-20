const ITUNES_SEARCH_URL = "https://itunes.apple.com/search";

export async function searchSongs(query, { signal } = {}) {
  const term = String(query || "").trim();
  if (term.length < 2) return [];

  const url = new URL(ITUNES_SEARCH_URL);
  url.searchParams.set("term", term);
  url.searchParams.set("entity", "song");
  url.searchParams.set("limit", "8");

  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error("No se pudo buscar en iTunes.");

  const data = await response.json();
  if (!Array.isArray(data?.results)) return [];

  return data.results
    .filter((item) => item?.trackName && item?.artistName)
    .map((item) => ({
      id: String(item.trackId || `${item.artistName}-${item.trackName}-${item.collectionId || ""}`),
      name: String(item.trackName),
      artist: String(item.artistName),
      artwork: secureArtwork(item.artworkUrl100 || item.artworkUrl60 || ""),
    }));
}

function secureArtwork(url) {
  return String(url || "").replace(/^http:/, "https:");
}

