# Mi Repertorio V2

## Decision de producto

La app deja de ser una herramienta grande de acordes y vuelve a su trabajo principal:

> Saber que canciones me se, en que tono van, y cuales quiero aprender.

Esta V2 es una libreta digital personal. No es dashboard, no es editor completo de acordes, no es app de aprendizaje ni producto para escalar.

## Estado congelado

La version actual queda congelada como prototipo viejo en:

`outputs/mi-repertorio-prototipo-viejo.zip`

No se sigue puliendo esa direccion visual ni el flujo centrado en secciones/acordes.

## Alcance de V2

### Repertorio

Campos visibles y editables:

- `nombre`
- `artista`
- `tono_original`, mostrado en UI como "tono"
- `tiene_capo`
- `traste_capo`, solo si `tiene_capo` es true
- `me_la_se`
- `notas`

### Wishlist

Campos visibles y editables en esta fase:

- `nombre`
- `artista`
- `nota`

Accion principal:

- "Pasar a repertorio": abre el formulario de cancion con nombre/artista prellenados, pide tono/capo y al guardar crea la cancion y elimina el item de wishlist.

## Lo que queda oculto

No borrar todavia, pero no mostrar en la V2:

- `sections`
- editor de acordes
- transporte de acordes
- chips de acordes
- gestos complejos
- animaciones pesadas
- filtros avanzados

## Auditoria backend / SQLite

### Base de datos

La tabla `songs` ya sirve para V2:

- `id`
- `nombre`
- `artista`
- `tono_original`
- `tiene_capo`
- `traste_capo`
- `me_la_se`
- `notas`
- `fecha_creada`
- `fecha_actualizada`

La tabla `wishlist` ya sirve para V2:

- `id`
- `nombre`
- `artista`
- `nota`
- `fecha_agregada`

La tabla `sections` queda intacta para una posible fase futura.

### Endpoints que se reutilizan

- `GET /songs`: lista canciones. Trae `sections`, pero la V2 las ignora.
- `POST /songs`: crea cancion con los campos necesarios.
- `PATCH /songs/:id`: edita cancion y permite marcar `me_la_se`.
- `DELETE /songs/:id`: elimina cancion.
- `GET /wishlist`: lista wishlist.
- `POST /wishlist`: crea item de wishlist.
- `PATCH /wishlist/:id`: edita item de wishlist.
- `DELETE /wishlist/:id`: elimina item de wishlist.

### Flujo "Pasar a repertorio"

No hace falta un endpoint nuevo por ahora. El frontend puede hacerlo en dos pasos:

1. `POST /songs` con nombre/artista de wishlist y tono/capo completados.
2. `DELETE /wishlist/:id` cuando la cancion se creo bien.

Si en el futuro se quiere atomicidad completa, se puede agregar un endpoint dedicado, pero no es necesario para esta app personal.

## Direccion visual para V2

Concepto: libreta musical movil.

Principios:

- Lista numerada, no tarjetas tipo dashboard.
- Mucho aire y lectura rapida.
- La cancion es protagonista.
- Tono y capo deben leerse en menos de tres segundos.
- Acciones secundarias discretas.
- Wishlist como segunda libreta, no como modulo corporativo.

Referencia de composicion:

```text
Mi Repertorio

Buscar cancion o artista

[ Repertorio ] [ Wishlist ]

01  Blackbird
    The Beatles
    G · Capo 2

02  Lamento Boliviano
    Enanitos Verdes
    Am
```

## Fases restantes

### Fase 2 - Frontend V2

- Rehacer `client/src/main.jsx` como pantalla unica.
- Rehacer `client/src/styles.css` con direccion "libreta musical".
- Mantener backend sin cambios salvo bug real.
- Formularios simples para cancion y wishlist.
- No agregar dependencias nuevas.

### Fase 3 - Flujo funcional

Probar manual y tecnicamente:

- agregar cancion
- editar cancion
- marcar/desmarcar "me la se"
- agregar a wishlist
- pasar wishlist a repertorio
- revisar en mobile

### Fase 4 - Pulido visual

- Refinar tipografia, ritmo, contraste y estados vacios.
- Ajustar mobile primero.
- Evitar decoracion que no ayude a usar la app.

### Fase 5 - Evaluar despues

Decidir si acordes/transporte vuelven como funcion secundaria, no como centro.
