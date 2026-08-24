# Mi Repertorio

Libreta musical personal para organizar canciones dominadas, favoritas y por aprender.

## Datos y sincronizacion

- La app entra directamente, sin ningún inicio de sesión.
- Supabase Postgres guarda un unico repertorio compartido y la foto de perfil.
- Computadora y celular leen y escriben el mismo repertorio, con actualizacion en tiempo real.
- Al abrir esta version por primera vez, los datos anteriores de IndexedDB se importan automaticamente.
- El backend Express + SQLite se conserva como referencia, pero la app publicada no depende de la computadora.

Como no existe inicio de sesion, cualquier persona que obtenga la URL publicada puede modificar este repertorio personal.

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
