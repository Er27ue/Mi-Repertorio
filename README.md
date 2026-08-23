# Mi Repertorio

Libreta musical personal para organizar canciones dominadas, favoritas y por aprender.

## Datos y sincronizacion

- Supabase Auth identifica al usuario por correo y contrasena.
- Supabase Postgres guarda canciones y la foto de perfil.
- Las politicas RLS limitan cada fila a su propietario.
- Al iniciar sesion por primera vez, los datos anteriores de IndexedDB se importan automaticamente.
- El backend Express + SQLite se conserva como referencia, pero la app publicada no depende de la computadora.

## Desarrollo

```bash
npm install
npm run dev --workspace client
```

## Verificacion

```bash
npm test
npm run build
```

## Publicacion

Cada push a `main` ejecuta `.github/workflows/deploy-pages.yml` y publica en:

`https://er27ue.github.io/Mi-Repertorio/`
