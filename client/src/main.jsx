import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Check, ChevronDown, ClipboardPaste, ImagePlus, MoreHorizontal, Minus, Music2, Plus, RotateCcw, Search, Star, Trash2, Upload, X } from "lucide-react";
import { AnimatePresence, motion, Reorder, useDragControls, useReducedMotion } from "motion/react";
import {
  createSong,
  deleteSong,
  getProfile,
  getSongs,
  getWishlist,
  reorderSongs,
  updateProfile,
  updateSong
} from "./api/repertorio.js";
import { searchSongs } from "./api/songSearch.js";
import { filterSongs } from "./lib/filters.js";
import "./theme.css";
import "./styles.css";

const spring = {
  snappy: { type: "spring", stiffness: 520, damping: 36, mass: 0.9 },
  soft: { type: "spring", stiffness: 290, damping: 30, mass: 1 }
};
const press = { scale: 0.97 };
const toneOptions = [
  "Todos",
  "C", "C#", "Db", "D", "D#", "Eb", "E", "F", "F#", "Gb", "G", "G#", "Ab", "A", "A#", "Bb", "B",
  "Cm", "C#m", "Dbm", "Dm", "D#m", "Ebm", "Em", "Fm", "F#m", "Gbm", "Gm", "G#m", "Abm", "Am", "A#m", "Bbm", "Bm"
];
const statusOptions = [
  { value: "dominada", label: "Dominada" },
  { value: "wishlist", label: "Wishlist" }
];
const categoryGroups = [
  { label: "Contexto", options: ["Adoración", "Alabanza", "Himno", "Especial", "Instrumental", "Otra"] },
  { label: "Género", options: ["Pop", "Rock", "Balada", "Jazz", "Folk", "Secular"] }
];
const techniqueOptions = ["Fingerstyle", "Rasgueo", "Ambas"];
const publicAsset = (path) => `${import.meta.env.BASE_URL}${path.replace(/^\//, "")}`;

const landingColumns = [
  [
    { src: publicAsset("landing/worship-group.webp"), alt: "Grupo de adoracion" },
    { src: publicAsset("landing/album-el-shaddai.webp"), alt: "Album El Shaddai" },
    { src: publicAsset("landing/portrait-table.webp"), alt: "Retrato musical" },
    { src: publicAsset("landing/album-radical.webp"), alt: "Album Generacion Radical" },
    { src: publicAsset("landing/lamp.webp"), alt: "Lampara encendida" }
  ],
  [
    { src: publicAsset("landing/worship-band.webp"), alt: "Banda adorando" },
    { src: publicAsset("landing/album-garden.webp"), alt: "Portada Tumbas a Jardines" },
    { src: publicAsset("landing/album-endless-praise.webp"), alt: "Album Endless Praise" },
    { src: publicAsset("landing/child-of-god.webp"), alt: "Child of God" }
  ],
  [
    { src: publicAsset("landing/worship-room.webp"), alt: "Sala de adoracion" },
    { src: publicAsset("landing/album-maverick-vol3.webp"), alt: "Album Maverick City Volumen 3" },
    { src: publicAsset("landing/album-dove-world.webp"), alt: "Album con paloma" },
    { src: publicAsset("landing/album-como-en-el-cielo.webp"), alt: "Album Como en el cielo" }
  ]
];

function App() {
  const reduceMotion = useReducedMotion();
  const [showLanding, setShowLanding] = useState(true);
  const [songs, setSongs] = useState([]);
  const [wishlist, setWishlist] = useState([]);
  const [orderedIds, setOrderedIds] = useState([]);
  const [activeTab, setActiveTab] = useState("dominada");
  const [query, setQuery] = useState("");
  const [profileImage, setProfileImage] = useState("");
  const [toneFilter, setToneFilter] = useState("Todos");
  const [capoFilter, setCapoFilter] = useState("Todos");
  const [categoryFilter, setCategoryFilter] = useState("Todas");
  const [techniqueFilter, setTechniqueFilter] = useState("Todas");
  const [sheet, setSheet] = useState(null);
  const [celebration, setCelebration] = useState(null);
  const [error, setError] = useState("");
  const reorderTimer = useRef(null);

  useEffect(() => {
    refresh();
  }, []);

  async function refresh() {
    setError("");
    try {
      const [songData, wishData, profileData] = await Promise.all([getSongs(), getWishlist(), getProfile()]);
      setSongs(sortByOrder(songData));
      setWishlist(sortByOrder(wishData));
      setOrderedIds(sortByOrder([...songData, ...wishData]).map((item) => item.id));
      setProfileImage(profileData.imagen || "");
    } catch (err) {
      setError(err.message);
    }
  }

  const allItems = useMemo(() => sortByIds([...songs, ...wishlist], orderedIds), [songs, wishlist, orderedIds]);
  const tabItems = useMemo(() => {
    if (activeTab === "favoritos") return allItems.filter((item) => item.favorito);
    return allItems.filter((item) => activeTab === "wishlist" ? item.es_wishlist : !item.es_wishlist);
  }, [activeTab, allItems]);
  const commonFilters = { query, toneFilter, capoFilter, categoryFilter, techniqueFilter, favoriteOnly: false };
  const visibleItems = useMemo(
    () => filterSongs(tabItems, commonFilters),
    [tabItems, query, toneFilter, capoFilter, categoryFilter, techniqueFilter]
  );
  const hasActiveFilters = Boolean(query.trim() || toneFilter !== "Todos" || capoFilter !== "Todos" || categoryFilter !== "Todas" || techniqueFilter !== "Todas");

  async function saveSong(payload, currentItem) {
    const saved = currentItem?.id
      ? await updateSong(currentItem.id, payload)
      : await createSong(payload);

    setSongs((current) => current.filter((song) => song.id !== saved.id));
    setWishlist((current) => current.filter((item) => item.id !== saved.id));
    setOrderedIds((current) => {
      const withoutSaved = current.filter((id) => id !== saved.id);
      const changedSection = Boolean(currentItem?.id) && Boolean(currentItem.es_wishlist) !== Boolean(saved.es_wishlist);
      return current.includes(saved.id) && !changedSection ? current : [...withoutSaved, saved.id];
    });
    if (saved.es_wishlist) {
      setWishlist((current) => sortByOrder([saved, ...current]));
      setActiveTab("wishlist");
    } else {
      setSongs((current) => sortByOrder([saved, ...current]));
      setActiveTab(saved.favorito ? "favoritos" : "dominada");
      if (currentItem?.estado === "wishlist" || currentItem?.es_wishlist) {
        setCelebration(saved);
      }
    }
    setSheet(null);
  }

  async function toggleFavorite(song) {
    const saved = await updateSong(song.id, { favorito: !song.favorito });
    setSongs((current) => current.map((item) => (item.id === saved.id ? saved : item)));
    setWishlist((current) => current.map((item) => (item.id === saved.id ? saved : item)));
  }

  async function removeItem(itemId) {
    await deleteSong(itemId);
    setSongs((current) => current.filter((song) => song.id !== itemId));
    setWishlist((current) => current.filter((item) => item.id !== itemId));
    setOrderedIds((current) => current.filter((id) => id !== itemId));
    setSheet(null);
  }

  async function promoteWishlist(item) {
    const saved = await updateSong(item.id, { estado: "dominada" });
    setWishlist((current) => current.filter((entry) => entry.id !== item.id));
    setSongs((current) => sortByOrder([saved, ...current.filter((song) => song.id !== saved.id)]));
    setOrderedIds((current) => [...current.filter((id) => id !== saved.id), saved.id]);
    setActiveTab("dominada");
    setCelebration(saved);
  }

  async function saveProfileImage(image) {
    const saved = await updateProfile(image);
    setProfileImage(saved.imagen || "");
  }

  function handleReorder(nextItems) {
    if (hasActiveFilters) return;
    const movableIds = new Set(tabItems.map((item) => item.id));
    let replacementIndex = 0;
    const reordered = allItems.map((item) => (
      movableIds.has(item.id) ? nextItems[replacementIndex++] : item
    ));
    const reorderedIds = reordered.map((item) => item.id);
    setOrderedIds(reorderedIds);
    window.clearTimeout(reorderTimer.current);
    reorderTimer.current = window.setTimeout(async () => {
      try {
        await reorderSongs(reorderedIds);
      } catch (err) {
        setError(err.message);
        await refresh();
      }
    }, 220);
  }

  const pageCopy = {
    favoritos: { title: "Tus canciones favoritas", empty: "Marca con estrella las canciones que quieres tener mas a mano." },
    dominada: { title: "Las que ya te sabes", empty: "Agrega la primera cancion que ya dominas." },
    wishlist: { title: "Canciones que quieres aprender", empty: "Anota aqui las canciones que quieres aprender." }
  }[activeTab];

  return (
    <main className="app-shell">
      <div className="phone-frame">
        <header className="topbar">
          <ProfileImageButton value={profileImage} onChange={saveProfileImage} />
          <h1>Mi Repertorio</h1>
        </header>

        <section className="hero-strip">
          <div><span>{allItems.filter((item) => item.favorito).length}</span><p>favoritos</p></div>
          <div><span>{songs.length}</span><p>dominadas</p></div>
          <div><span>{wishlist.length}</span><p>wishlist</p></div>
        </section>

        <label className="search-row">
          <Search size={17} />
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar cancion o artista" />
        </label>

        <FilterBar
          activeTab={activeTab}
          toneFilter={toneFilter}
          setToneFilter={setToneFilter}
          capoFilter={capoFilter}
          setCapoFilter={setCapoFilter}
          categoryFilter={categoryFilter}
          setCategoryFilter={setCategoryFilter}
          techniqueFilter={techniqueFilter}
          setTechniqueFilter={setTechniqueFilter}
        />

        <nav className="notebook-tabs">
          <TabButton active={activeTab === "favoritos"} onClick={() => setActiveTab("favoritos")}>Favoritos</TabButton>
          <TabButton active={activeTab === "dominada"} onClick={() => setActiveTab("dominada")}>Dominadas</TabButton>
          <TabButton active={activeTab === "wishlist"} onClick={() => setActiveTab("wishlist")}>Wishlist</TabButton>
        </nav>

        {error ? <p className="error-note">{error}</p> : null}

        <AnimatePresence mode="wait">
          <motion.section
            key={activeTab}
            className="notebook-page"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -10 }}
            transition={reduceMotion ? { duration: 0.16 } : spring.soft}
          >
            <ListHeader
              title={pageCopy.title}
              actionLabel="Agregar"
              onAction={() => setSheet({ type: "song", defaultStatus: activeTab === "wishlist" ? "wishlist" : "dominada", defaultFavorite: activeTab === "favoritos" })}
              reduceMotion={reduceMotion}
            />
            <SongList
              items={visibleItems}
              activeTab={activeTab}
              onEdit={(item) => setSheet({ type: "song", item })}
              onToggleFavorite={toggleFavorite}
              onPromote={promoteWishlist}
              onReorder={handleReorder}
              canReorder={!hasActiveFilters && visibleItems.length > 1}
              reduceMotion={reduceMotion}
            />
            {!tabItems.length ? <EmptyState text={pageCopy.empty} /> : null}
            {tabItems.length > 0 && !visibleItems.length ? <EmptyState text="No hay canciones que coincidan con estos filtros." /> : null}
          </motion.section>
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {showLanding ? (
          <LandingScreen
            key="landing-screen"
            onEnter={() => setShowLanding(false)}
            reduceMotion={reduceMotion}
          />
        ) : null}
        {sheet?.type === "song" ? (
          <SongFormSheet
            key="song-sheet"
            item={sheet.item}
            defaultStatus={sheet.defaultStatus || activeTab}
            defaultFavorite={sheet.defaultFavorite}
            onClose={() => setSheet(null)}
            onSave={saveSong}
            onDelete={removeItem}
            reduceMotion={reduceMotion}
          />
        ) : null}
        {celebration ? (
          <CelebrationDialog key="celebration" song={celebration} onClose={() => setCelebration(null)} reduceMotion={reduceMotion} />
        ) : null}
      </AnimatePresence>
    </main>
  );
}

function LandingScreen({ onEnter, reduceMotion }) {
  const title = "Mi Repertorio";
  const [typedTitle, setTypedTitle] = useState(reduceMotion ? title : "");
  const titleDone = typedTitle.length === title.length;

  useEffect(() => {
    if (reduceMotion) {
      setTypedTitle(title);
      return undefined;
    }

    let index = 0;
    const timer = window.setInterval(() => {
      index += 1;
      setTypedTitle(title.slice(0, index));
      if (index >= title.length) window.clearInterval(timer);
    }, 82);

    return () => window.clearInterval(timer);
  }, [reduceMotion]);

  return (
    <motion.section
      className="landing-screen"
      initial={{ opacity: 1 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.48, ease: "easeOut" }}
    >
      <motion.div
        className="landing-card"
        initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 18, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.46, ease: "easeOut" }}
      >
        <motion.div
          className="landing-visual"
          initial={reduceMotion ? false : { opacity: 0, scale: 1.04 }}
          animate={reduceMotion ? undefined : { opacity: 1, scale: [1.04, 1] }}
          transition={{ duration: 1.4, ease: "easeOut" }}
        >
          <LandingCollage reduceMotion={reduceMotion} />
        </motion.div>

        <div className="landing-copy">
          <h2 className="landing-title">
            <span className="title-measure">{title}</span>
            <span className="title-typed">
              {typedTitle}
              <motion.span
                className="typing-cursor"
                animate={reduceMotion ? { opacity: 0 } : { opacity: [0, 1, 0] }}
                transition={{ repeat: Infinity, duration: 0.82 }}
              />
            </span>
          </h2>

          <motion.p
            className="landing-verse"
            initial={false}
            animate={titleDone ? { opacity: 1, y: 0 } : { opacity: 0, y: 6 }}
            transition={{ delay: reduceMotion ? 0 : 0.18, duration: 0.72, ease: "easeOut" }}
          >
            «Mas la hora viene, y ahora es, cuando los verdaderos adoradores adorarán al Padre en espíritu y en verdad; porque también el Padre tales adoradores busca que le adoren. Dios es Espíritu; y los que le adoran, en espíritu y en verdad es necesario que adoren.» <span className="verse-version">Juan 4:23-24 · RVR 1960</span>
          </motion.p>

          <motion.div
            className="landing-actions"
            initial={reduceMotion ? { opacity: 1 } : { opacity: 0, y: 10 }}
            animate={titleDone ? { opacity: 1, y: 0 } : { opacity: 0, y: 10 }}
            transition={{ delay: reduceMotion ? 0 : 0.42, duration: 0.44, ease: "easeOut" }}
          >
            <motion.button
              className="landing-button"
              whileTap={reduceMotion ? undefined : press}
              onClick={onEnter}
              disabled={!titleDone}
            >
              Comenzar
            </motion.button>
          </motion.div>
        </div>
      </motion.div>
    </motion.section>
  );
}

function LandingCollage({ reduceMotion }) {
  return (
    <div className="landing-collage" aria-hidden="true">
      {landingColumns.map((column, columnIndex) => {
        return (
          <motion.div
            className={`collage-column collage-column-${columnIndex + 1}${reduceMotion ? " is-static" : ""}`}
            key={columnIndex}
            initial={reduceMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={reduceMotion
              ? { duration: 0.2 }
              : { delay: columnIndex * 0.12, duration: 0.42, ease: "easeOut" }}
          >
            {[0, 1].map((copyIndex) => (
              <div className="collage-sequence" key={copyIndex}>
                {column.map((image) => (
                  <figure className="collage-tile" key={`${copyIndex}-${image.src}`}>
                    <img src={image.src} alt={copyIndex === 0 ? image.alt : ""} draggable="false" loading="eager" decoding="async" />
                  </figure>
                ))}
              </div>
            ))}
          </motion.div>
        );
      })}
    </div>
  );
}

function TabButton({ active, onClick, children }) {
  return (
    <button className={active ? "tab-choice active" : "tab-choice"} onClick={onClick}>
      {active ? <motion.span layoutId="tab-underline" className="tab-line" transition={spring.snappy} /> : null}
      {children}
    </button>
  );
}

function ListHeader({ title, actionLabel, onAction, reduceMotion }) {
  return (
    <div className="list-header">
      <h2>{title}</h2>
      <motion.button className="small-action" whileTap={reduceMotion ? undefined : press} onClick={onAction}>
        <Plus size={16} /> {actionLabel}
      </motion.button>
    </div>
  );
}

function ProfileImageButton({ value, onChange }) {
  const inputRef = useRef(null);
  const [cropSource, setCropSource] = useState("");

  function loadFile(file) {
    if (!file?.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.onload = () => setCropSource(String(reader.result || ""));
    reader.readAsDataURL(file);
  }

  return (
    <>
      <button className={value ? "profile-button has-image" : "profile-button"} onClick={() => inputRef.current?.click()} title="Subir foto de perfil" aria-label="Subir foto de perfil">
        {value ? <img src={value} alt="Foto de perfil" /> : null}
      </button>
      <input ref={inputRef} className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => loadFile(event.target.files?.[0])} />
      <AnimatePresence>
        {cropSource ? <ImageCropEditor source={cropSource} onCancel={() => setCropSource("")} onConfirm={(image) => { onChange(image); setCropSource(""); }} /> : null}
      </AnimatePresence>
    </>
  );
}

function FilterBar({
  activeTab,
  toneFilter,
  setToneFilter,
  capoFilter,
  setCapoFilter,
  categoryFilter,
  setCategoryFilter,
  techniqueFilter,
  setTechniqueFilter
}) {
  const [openFilter, setOpenFilter] = useState(null);
  const activeCount = Number(toneFilter !== "Todos")
    + Number(capoFilter !== "Todos")
    + Number(categoryFilter !== "Todas")
    + Number(techniqueFilter !== "Todas");

  useEffect(() => {
    setOpenFilter(null);
  }, [activeTab]);

  function toggleFilter(name) {
    setOpenFilter((current) => (current === name ? null : name));
  }

  function resetFilters() {
    setToneFilter("Todos");
    setCapoFilter("Todos");
    setCategoryFilter("Todas");
    setTechniqueFilter("Todas");
    setOpenFilter(null);
  }

  return (
    <section className="filter-bar" aria-label="Filtros de canciones">
      <div className="filter-toolbar">
        <div className="filter-scroller">
          <FilterMenuButton label="Tono" value={toneFilter} active={toneFilter !== "Todos"} open={openFilter === "tone"} onClick={() => toggleFilter("tone")} />
          <FilterMenuButton label="Capo" value={formatCapoFilter(capoFilter)} active={capoFilter !== "Todos"} open={openFilter === "capo"} onClick={() => toggleFilter("capo")} />
          <FilterMenuButton label="Categoría" value={categoryFilter} active={categoryFilter !== "Todas"} open={openFilter === "category"} onClick={() => toggleFilter("category")} />
          <FilterMenuButton label="Técnica" value={techniqueFilter} active={techniqueFilter !== "Todas"} open={openFilter === "technique"} onClick={() => toggleFilter("technique")} />
        </div>
        {activeCount ? (
          <button className="reset-filters" onClick={resetFilters} title={`Limpiar ${activeCount} filtros`} aria-label={`Limpiar ${activeCount} filtros`}>
            <RotateCcw size={15} /><span>{activeCount}</span>
          </button>
        ) : null}
      </div>

      <AnimatePresence initial={false}>
        {openFilter ? (
          <motion.div
            className={`filter-drawer ${openFilter === "tone" ? "tone-drawer" : ""}`}
            initial={{ opacity: 0, height: 0, y: -5 }}
            animate={{ opacity: 1, height: "auto", y: 0 }}
            exit={{ opacity: 0, height: 0, y: -4 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            {openFilter === "tone" ? (
              <FilterOptions
                value={toneFilter}
                options={toneOptions}
                onChange={(value) => { setToneFilter(value); setOpenFilter(null); }}
                compact
              />
            ) : null}
            {openFilter === "capo" ? (
              <FilterOptions
                value={capoFilter}
                options={["Todos", "Sin capo", ...Array.from({ length: 11 }, (_, index) => String(index + 1))]}
                formatOption={formatCapoFilter}
                onChange={(value) => { setCapoFilter(value); setOpenFilter(null); }}
              />
            ) : null}
            {openFilter === "category" ? (
              <div className="filter-category-groups">
                <FilterOptions value={categoryFilter} options={["Todas"]} onChange={(value) => { setCategoryFilter(value); setOpenFilter(null); }} />
                {categoryGroups.map((group) => (
                  <div key={group.label}><p>{group.label}</p><FilterOptions value={categoryFilter} options={group.options} onChange={(value) => { setCategoryFilter(value); setOpenFilter(null); }} /></div>
                ))}
              </div>
            ) : null}
            {openFilter === "technique" ? (
              <FilterOptions
                value={techniqueFilter}
                options={["Todas", ...techniqueOptions]}
                onChange={(value) => { setTechniqueFilter(value); setOpenFilter(null); }}
              />
            ) : null}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}

function FilterMenuButton({ label, value, active, open, onClick }) {
  return (
    <button className={active ? "filter-chip menu active" : "filter-chip menu"} onClick={onClick} aria-expanded={open}>
      <span>{label}</span><strong>{value}</strong><ChevronDown className={open ? "rotated" : ""} size={14} />
    </button>
  );
}

function FilterOptions({ value, options, onChange, formatOption = (option) => option, compact = false }) {
  return (
    <div className={compact ? "filter-options compact" : "filter-options"}>
      {options.map((option) => (
        <button key={option} className={value === option ? "active" : ""} onClick={() => onChange(option)}>
          {value === option ? <Check size={13} /> : null}{formatOption(option)}
        </button>
      ))}
    </div>
  );
}

function SongList({ items, activeTab, onEdit, onToggleFavorite, onPromote, onReorder, canReorder, reduceMotion }) {
  return (
    <Reorder.Group axis="y" values={items} onReorder={onReorder} className="song-ledger">
      <AnimatePresence>
        {items.map((item) => (
          <SongCard
            key={item.id}
            item={item}
            activeTab={activeTab}
            onEdit={onEdit}
            onToggleFavorite={onToggleFavorite}
            onPromote={onPromote}
            canReorder={canReorder}
            reduceMotion={reduceMotion}
          />
        ))}
      </AnimatePresence>
    </Reorder.Group>
  );
}

function SongCard({ item, activeTab, onEdit, onToggleFavorite, onPromote, canReorder, reduceMotion }) {
  const dragControls = useDragControls();
  const showPromote = item.es_wishlist && (activeTab === "wishlist" || activeTab === "favoritos");
  return (
    <Reorder.Item
      value={item}
      dragListener={false}
      dragControls={dragControls}
      style={{ touchAction: "pan-y" }}
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: -8, height: 0, marginTop: 0, marginBottom: 0 }}
      transition={reduceMotion ? { duration: 0.14 } : { duration: 0.34, ease: "easeOut" }}
      className="ledger-row"
    >
      <div
        className={canReorder ? "song-thumbnail reorder-touch-area" : "song-thumbnail"}
        aria-hidden="true"
        onPointerDown={(event) => {
          if (canReorder) dragControls.start(event);
        }}
      >
        {item.imagen ? <img src={item.imagen} alt="" /> : <MusicPlaceholder size={36} />}
      </div>
      <button className="row-main" onClick={() => onEdit(item)}>
        <strong>{item.nombre}</strong>
        <span className="song-artist">{item.artista || "Sin artista"}</span>
        <span className="song-meta">{item.tono || "Tono por definir"}{item.tiene_capo ? ` · Capo ${item.traste_capo}` : item.es_wishlist ? "" : " · Sin capo"}</span>
        <span className="song-detail">{formatSongDetail(item)}</span>
        {item.notas || item.nota ? <em>{item.notas || item.nota}</em> : null}
      </button>
      <div className="card-actions">
        <motion.button className={item.favorito ? "favorite-button active" : "favorite-button"} whileTap={reduceMotion ? undefined : { scale: 0.9 }} onClick={() => onToggleFavorite(item)} title={item.favorito ? "Quitar de favoritos" : "Agregar a favoritos"}>
          <Star size={16} fill={item.favorito ? "currentColor" : "none"} />
        </motion.button>
        {showPromote ? <motion.button className="promote-check" whileTap={reduceMotion ? undefined : { scale: 0.9 }} onClick={() => onPromote(item)} title="Pasar a dominadas"><Check size={18} /></motion.button> : null}
        <button className="more-button" onClick={() => onEdit(item)} title="Editar"><MoreHorizontal size={18} /></button>
      </div>
    </Reorder.Item>
  );
}

function SongFormSheet({ item, defaultStatus, defaultFavorite = false, onClose, onSave, onDelete, reduceMotion }) {
  const initialStatus = defaultStatus || getItemStatus(item);
  const [form, setForm] = useState({
    nombre: item?.nombre || "",
    artista: item?.artista || "",
    tono: item?.tono || item?.tono_original || "",
    tiene_capo: item?.tiene_capo || false,
    traste_capo: item?.traste_capo || 1,
    estado: initialStatus,
    favorito: Boolean(item?.favorito || defaultFavorite),
    categorias: Array.isArray(item?.categorias) ? item.categorias : [],
    tecnica: item?.tecnica || "Rasgueo",
    notas: item?.notas || item?.nota || "",
    imagen: item?.imagen || ""
  });
  const [submitted, setSubmitted] = useState(false);
  const canSave = Boolean(form.nombre.trim() && form.artista.trim());

  function submit(event) {
    event.preventDefault();
    setSubmitted(true);
    if (!canSave) return;
    onSave({
      nombre: form.nombre.trim(),
      artista: form.artista.trim(),
      tono: form.tono.trim(),
      tiene_capo: form.tiene_capo,
      traste_capo: form.tiene_capo ? Number(form.traste_capo) : null,
      estado: form.estado,
      me_la_se: form.estado === "dominada",
      favorito: form.favorito,
      es_wishlist: form.estado === "wishlist",
      categorias: form.categorias,
      tecnica: form.tecnica,
      notas: form.notas.trim(),
      imagen: form.imagen
    }, item);
  }

  return (
    <Sheet title={item ? "Editar cancion" : "Agregar cancion"} onClose={onClose} reduceMotion={reduceMotion}>
      <form className="sheet-form" onSubmit={submit}>
        <SongNameAutocomplete
          value={form.nombre}
          invalid={submitted && !form.nombre.trim()}
          onChange={(nombre) => setForm((current) => ({ ...current, nombre }))}
          onSelect={(result) => setForm((current) => ({
            ...current,
            nombre: result.name,
            artista: result.artist,
            imagen: result.artwork || current.imagen
          }))}
        />
        <Field label="Artista o banda *" value={form.artista} onChange={(value) => setForm({ ...form, artista: value })} invalid={submitted && !form.artista.trim()} />

        <ImagePicker value={form.imagen} onChange={(imagen) => setForm({ ...form, imagen })} />

        <div className="form-pair">
          <TonePicker value={form.tono} onChange={(tono) => setForm({ ...form, tono })} />
          <div className="field-block capo-field">
            <span>Capo</span>
            <button type="button" className={form.tiene_capo ? "capo-control active" : "capo-control"} onClick={() => setForm({ ...form, tiene_capo: !form.tiene_capo })}>
              <span className="control-copy"><strong>{form.tiene_capo ? `Traste ${form.traste_capo}` : "Sin capo"}</strong></span>
              <span className="custom-switch" aria-hidden="true"><i /></span>
            </button>
          </div>
        </div>
        {form.tiene_capo ? (
          <div className="fret-stepper">
            <span><strong>Traste del capo</strong><small>Del 1 al 11</small></span>
            <div>
              <button type="button" onClick={() => setForm({ ...form, traste_capo: Math.max(1, Number(form.traste_capo) - 1) })} title="Bajar traste"><Minus size={16} /></button>
              <output>{form.traste_capo}</output>
              <button type="button" onClick={() => setForm({ ...form, traste_capo: Math.min(11, Number(form.traste_capo) + 1) })} title="Subir traste"><Plus size={16} /></button>
            </div>
          </div>
        ) : null}

        <fieldset className="status-fieldset">
          <legend>Estado</legend>
          <div className="status-options">
            {statusOptions.map((status) => (
              <button
                type="button"
                key={status.value}
                className={form.estado === status.value ? "status-choice active" : "status-choice"}
                onClick={() => setForm({ ...form, estado: status.value })}
              >
                {status.label}
              </button>
            ))}
          </div>
        </fieldset>

        <button type="button" className={form.favorito ? "favorite-toggle active" : "favorite-toggle"} onClick={() => setForm({ ...form, favorito: !form.favorito })}>
          <Star size={18} fill={form.favorito ? "currentColor" : "none"} />
          <span><strong>Favorita</strong><small>Mostrar en la seccion Favoritos</small></span>
        </button>

        <CategoryPicker
          value={form.categorias}
          onToggle={(category) => setForm((current) => {
            const selected = current.categorias.includes(category);
            if (!selected && current.categorias.length >= 3) return current;
            const categorias = selected
              ? current.categorias.filter((item) => item !== category)
              : [...current.categorias, category];
            return { ...current, categorias };
          })}
        />

        <fieldset className="status-fieldset">
          <legend>Técnica</legend>
          <div className="status-options technique-options">
            {techniqueOptions.map((technique) => (
              <button
                type="button"
                key={technique}
                className={form.tecnica === technique ? "status-choice active" : "status-choice"}
                onClick={() => setForm({ ...form, tecnica: technique })}
              >
                {technique}
              </button>
            ))}
          </div>
        </fieldset>

        <label className="field-block"><span>Notas</span><textarea value={form.notas} onChange={(event) => setForm({ ...form, notas: event.target.value })} placeholder="Ej: Intro: G F E G / Precoro: Am C..." /></label>
        {submitted && (!form.nombre.trim() || !form.artista.trim()) ? <p className="form-error">Completa el nombre y el artista para guardar.</p> : null}
        <div className="sheet-actions">
          {item ? <button type="button" className="delete-link" onClick={() => onDelete(item.id)}><Trash2 size={15} /> Borrar</button> : <span />}
          <div className="form-commands">
            <button type="button" className="cancel-button" onClick={onClose}>Cancelar</button>
            <motion.button className="save-button" whileTap={reduceMotion ? undefined : press}>{item ? "Guardar cambios" : "Guardar"}</motion.button>
          </div>
        </div>
      </form>
    </Sheet>
  );
}

function TonePicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="tone-picker field-block">
      <span>Tono</span>
      <button type="button" className="picker-trigger" onClick={() => setOpen((current) => !current)} aria-expanded={open}>
        <strong>{value || "Sin definir"}</strong><span>{open ? "Cerrar" : "Elegir"}</span>
      </button>
      <AnimatePresence>
        {open ? (
          <motion.div className="tone-grid" initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}>
            <button type="button" className={!value ? "tone-option active" : "tone-option"} onClick={() => { onChange(""); setOpen(false); }}>Sin tono</button>
            {toneOptions.slice(1).map((tone) => (
              <button type="button" key={tone} className={value === tone ? "tone-option active" : "tone-option"} onClick={() => { onChange(tone); setOpen(false); }}>{tone}</button>
            ))}
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function CategoryPicker({ value, onToggle }) {
  return (
    <fieldset className="category-fieldset">
      <legend>Categorías <span>{value.length}/3</span></legend>
      {categoryGroups.map((group) => (
        <div className="category-group" key={group.label}>
          <p>{group.label}</p>
          <div>
            {group.options.map((category) => {
              const selected = value.includes(category);
              return (
                <button
                  type="button"
                  key={category}
                  className={selected ? "category-option active" : "category-option"}
                  disabled={!selected && value.length >= 3}
                  onClick={() => onToggle(category)}
                >
                  {selected ? <Check size={13} /> : null}{category}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </fieldset>
  );
}

function ImagePicker({ value, onChange }) {
  const inputRef = useRef(null);
  const [cropSource, setCropSource] = useState("");
  const [error, setError] = useState("");

  function loadFile(file) {
    setError("");
    if (!file || !file.type.startsWith("image/")) {
      setError("Selecciona una imagen válida.");
      return;
    }
    if (file.size > 8_000_000) {
      setError("La imagen original no puede superar 8 MB.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setCropSource(String(reader.result || ""));
    reader.onerror = () => setError("No pude leer esa imagen.");
    reader.readAsDataURL(file);
  }

  function handlePaste(event) {
    const file = Array.from(event.clipboardData?.items || [])
      .find((item) => item.type.startsWith("image/"))
      ?.getAsFile();
    if (file) {
      event.preventDefault();
      loadFile(file);
    } else {
      setError("El portapapeles no contiene una imagen.");
    }
  }

  async function pasteFromClipboard() {
    setError("");
    try {
      const clipboardItems = await navigator.clipboard.read();
      const imageType = clipboardItems.flatMap((item) => item.types).find((type) => type.startsWith("image/"));
      const source = clipboardItems.find((item) => item.types.includes(imageType));
      if (!source || !imageType) throw new Error();
      const blob = await source.getType(imageType);
      loadFile(new File([blob], "portapapeles", { type: imageType }));
    } catch {
      setError("No pude leer una imagen del portapapeles.");
    }
  }

  return (
    <div className="image-picker field-block">
      <span>Imagen</span>
      <div className="image-picker-row" tabIndex="0" onPaste={handlePaste}>
        <div className={value ? "image-preview has-image" : "image-preview"}>
          {value ? <img src={value} alt="Vista previa de la canción" /> : <MusicPlaceholder size={36} />}
        </div>
        <div className="image-picker-copy">
          <strong>{value ? "Imagen lista" : "Portada de la canción"}</strong>
          <small>Elige o pega una imagen para la tarjeta.</small>
          <div>
            <button type="button" onClick={() => inputRef.current?.click()}><Upload size={15} /> Subir imagen</button>
            <button type="button" onClick={pasteFromClipboard}><ClipboardPaste size={15} /> Pegar desde portapapeles</button>
            {value ? <button type="button" onClick={() => setCropSource(value)}><ImagePlus size={15} /> Ajustar</button> : null}
            {value ? <button type="button" className="remove-image" onClick={() => onChange("")}><Trash2 size={15} /> Quitar</button> : null}
          </div>
        </div>
      </div>
      <input ref={inputRef} className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => loadFile(event.target.files?.[0])} />
      {error ? <p className="form-error">{error}</p> : null}
      <AnimatePresence>
        {cropSource ? (
          <ImageCropEditor
            source={cropSource}
            onCancel={() => setCropSource("")}
            onConfirm={(image) => { onChange(image); setCropSource(""); }}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}

function ImageCropEditor({ source, onCancel, onConfirm }) {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef(null);
  const [saving, setSaving] = useState(false);

  function move(event) {
    if (!drag.current) return;
    const nextX = drag.current.offsetX + event.clientX - drag.current.x;
    const nextY = drag.current.offsetY + event.clientY - drag.current.y;
    setOffset({ x: Math.max(-140, Math.min(140, nextX)), y: Math.max(-140, Math.min(140, nextY)) });
  }

  async function confirm() {
    setSaving(true);
    try {
      onConfirm(await cropImage(source, zoom, offset));
    } finally {
      setSaving(false);
    }
  }

  return (
    <motion.div className="crop-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.section className="crop-dialog" initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 14, opacity: 0 }}>
        <div className="crop-title"><div><p>Encuadre</p><h3>Ajusta tu imagen</h3></div><button type="button" onClick={onCancel} title="Cerrar"><X size={18} /></button></div>
        <div
          className="crop-viewport"
          onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); drag.current = { x: event.clientX, y: event.clientY, offsetX: offset.x, offsetY: offset.y }; }}
          onPointerMove={move}
          onPointerUp={() => { drag.current = null; }}
          onPointerCancel={() => { drag.current = null; }}
        >
          <img src={source} alt="Imagen para recortar" draggable="false" style={{ transform: `translate3d(${offset.x}px, ${offset.y}px, 0) scale(${zoom})` }} />
          <span className="crop-frame" />
        </div>
        <label className="zoom-control"><span>Ampliar</span><input type="range" min="1" max="3" step="0.05" value={zoom} onChange={(event) => setZoom(Number(event.target.value))} /></label>
        <p className="crop-hint">Arrastra la imagen para moverla dentro del marco.</p>
        <div className="crop-actions"><button type="button" onClick={onCancel}>Cancelar</button><button type="button" className="save-button" disabled={saving} onClick={confirm}>{saving ? "Preparando..." : "Usar imagen"}</button></div>
      </motion.section>
    </motion.div>
  );
}

async function cropImage(source, zoom, offset) {
  const image = await loadImage(source);
  const viewport = 280;
  const output = 720;
  const baseScale = Math.max(viewport / image.naturalWidth, viewport / image.naturalHeight);
  const sourceSize = viewport / (baseScale * zoom);
  const sourceX = Math.max(0, Math.min(image.naturalWidth - sourceSize, (image.naturalWidth - sourceSize) / 2 - offset.x / (baseScale * zoom)));
  const sourceY = Math.max(0, Math.min(image.naturalHeight - sourceSize, (image.naturalHeight - sourceSize) / 2 - offset.y / (baseScale * zoom)));
  const canvas = document.createElement("canvas");
  canvas.width = output;
  canvas.height = output;
  const context = canvas.getContext("2d");
  context.fillStyle = getComputedStyle(document.documentElement).getPropertyValue("--color-surface").trim();
  context.fillRect(0, 0, output, output);
  context.drawImage(image, sourceX, sourceY, sourceSize, sourceSize, 0, 0, output, output);
  return canvas.toDataURL("image/jpeg", 0.86);
}

function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = source;
  });
}

function Sheet({ title, onClose, reduceMotion, children }) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  return (
    <motion.div className="sheet-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.16 }}>
      <motion.div
        className="sheet-panel"
        initial={reduceMotion ? { opacity: 0 } : { y: "102%" }}
        animate={reduceMotion ? { opacity: 1 } : { y: 0 }}
        exit={reduceMotion ? { opacity: 0 } : { y: "104%" }}
        transition={reduceMotion ? { duration: 0.16 } : spring.soft}
      >
        <div className="sheet-grip" />
        <div className="sheet-title-row"><h2>{title}</h2><button onClick={onClose} title="Cerrar"><X size={18} /></button></div>
        {children}
      </motion.div>
    </motion.div>
  );
}

function Field({ label, value, onChange, placeholder = "", invalid = false }) {
  return <label className={invalid ? "field-block invalid" : "field-block"}><span>{label}</span><input value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} /></label>;
}

function SongNameAutocomplete({ value, onChange, onSelect, invalid = false }) {
  const inputId = useId();
  const [results, setResults] = useState([]);
  const [status, setStatus] = useState("idle");
  const [open, setOpen] = useState(false);
  const [hasTyped, setHasTyped] = useState(false);

  useEffect(() => {
    const query = value.trim();
    if (!hasTyped || query.length < 2) {
      setResults([]);
      setStatus("idle");
      setOpen(false);
      return undefined;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setStatus("loading");
      setOpen(true);
      try {
        const songs = await searchSongs(query, { signal: controller.signal });
        setResults(songs);
        setStatus(songs.length ? "ready" : "empty");
      } catch (error) {
        if (error.name === "AbortError") return;
        setResults([]);
        setStatus("idle");
        setOpen(false);
      }
    }, 400);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [value, hasTyped]);

  function choose(result) {
    setHasTyped(false);
    setOpen(false);
    setResults([]);
    setStatus("idle");
    onSelect(result);
  }

  return (
    <div className={invalid ? "field-block song-autocomplete invalid" : "field-block song-autocomplete"}>
      <label htmlFor={inputId}>Nombre de la cancion *</label>
      <input
        id={inputId}
        value={value}
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        onChange={(event) => {
          setHasTyped(true);
          onChange(event.target.value);
        }}
        onFocus={() => {
          if (status === "ready" || status === "empty") setOpen(true);
        }}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        onKeyDown={(event) => {
          if (event.key === "Escape") setOpen(false);
        }}
      />

      {open ? (
        <div className="song-suggestions" role="listbox" aria-label="Resultados de canciones">
          {status === "loading" ? <p className="suggestion-message">Buscando canciones...</p> : null}
          {status === "empty" ? <p className="suggestion-message">No se encontraron resultados.</p> : null}
          {status === "ready" ? results.map((result) => (
            <button
              type="button"
              role="option"
              key={result.id}
              onPointerDown={(event) => event.preventDefault()}
              onClick={() => choose(result)}
            >
              <span className="suggestion-artwork">
                <MusicPlaceholder size={22} />
                {result.artwork ? <img src={result.artwork} alt="" loading="lazy" /> : null}
              </span>
              <span className="suggestion-copy">
                <strong>{result.name}</strong>
                <small>{result.artist}</small>
              </span>
            </button>
          )) : null}
        </div>
      ) : null}
    </div>
  );
}

function getItemStatus(item) {
  if (item?.es_wishlist) return "wishlist";
  return "dominada";
}

function EmptyState({ text }) {
  return (
    <div className="empty-state">
      <div className="empty-thumbnail" aria-hidden="true"><MusicPlaceholder size={36} /></div>
      <div className="empty-copy">
        <span className="empty-line wide" />
        <span className="empty-line" />
        <p>{text}</p>
      </div>
      <MoreHorizontal size={18} />
    </div>
  );
}

function MusicPlaceholder({ size }) {
  return <span className="music-placeholder" aria-hidden="true"><Music2 size={size} /></span>;
}

function CelebrationDialog({ song, onClose, reduceMotion }) {
  return (
    <motion.div className="celebration-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <motion.section
        className="celebration-dialog"
        initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.98 }}
        transition={reduceMotion ? { duration: 0.15 } : spring.soft}
        role="dialog"
        aria-modal="true"
        aria-labelledby="celebration-title"
      >
        <button className="celebration-close" onClick={onClose} title="Cerrar"><X size={18} /></button>
        <div className="celebration-check"><Check size={28} /></div>
        <p className="celebration-kicker">Nueva dominada</p>
        <h2 id="celebration-title">¡Ya te la sabes!</h2>
        <p><strong>{song.nombre}</strong> ahora forma parte de tus canciones dominadas.</p>
        <motion.button className="celebration-action" whileTap={reduceMotion ? undefined : press} onClick={onClose}>Continuar</motion.button>
      </motion.section>
    </motion.div>
  );
}

function formatCapoFilter(value) {
  if (value === "Todos" || value === "Sin capo") return value;
  return `Traste ${value}`;
}

function formatSongDetail(song) {
  return [...(song.categorias || []).slice(0, 2), song.tecnica].filter(Boolean).join(" · ");
}

function sortByOrder(items) {
  return [...items].sort((a, b) => Number(a.orden ?? 0) - Number(b.orden ?? 0) || Number(a.id) - Number(b.id));
}

function sortByIds(items, orderedIds) {
  const positions = new Map(orderedIds.map((id, index) => [id, index]));
  return [...items].sort((a, b) => (positions.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (positions.get(b.id) ?? Number.MAX_SAFE_INTEGER));
}

createRoot(document.getElementById("root")).render(<App />);
