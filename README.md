# Repertorio de Guitarra

App web personal para guardar canciones de guitarra por secciones, con persistencia real en SQLite.

## Fase actual

Fase 1:

- CRUD de canciones del repertorio.
- CRUD de secciones por cancion.
- Reordenamiento de secciones con botones subir/bajar.
- Guardado automatico con debounce en campos de texto.
- Persistencia real en `server/database.sqlite`.

Fase 2 lista para revision:

- Transporte temporal de tono en la vista de cancion.
- Acordes visibles recalculados sin modificar los datos guardados.
- Tono actual calculado desde `tono_original`.
- Indicador de capo con aclaracion: el capo no transforma los acordes mostrados.
- Tests unitarios de `transponerAcorde` y `transponerLineaDeAcordes`.

Fase 3 lista para revision:

- Checkbox "me la se" funcional en tarjetas de biblioteca y vista de cancion.
- Filtros "Me las se" y "Por repasar" conectados a datos reales.
- Wishlist completa: listar, crear y eliminar ideas.
- Flujo "Empezar a anotar": prellena el modal de cancion, crea repertorio y elimina el item de wishlist.
- Tests HTTP para checklist y wishlist.

## Correr

```bash
npm install
npm run dev
```

Frontend: `http://localhost:5173`
Backend: `http://localhost:4000`

## Probar

```bash
npm test
```
