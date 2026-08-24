-- Esquema de referencia de Mi Repertorio.
-- La base remota usa un unico repertorio compartido por computadora y celular.

create table public.canciones (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  nombre text not null check (char_length(btrim(nombre)) > 0),
  artista text not null check (char_length(btrim(artista)) > 0),
  tono text not null default '',
  tono_original text not null default '',
  tiene_capo boolean not null default false,
  traste_capo smallint,
  me_la_se boolean not null default true,
  notas text not null default '',
  favorito boolean not null default false,
  es_wishlist boolean not null default false,
  estado text not null default 'dominada' check (estado in ('dominada', 'wishlist')),
  categorias text[] not null default '{}',
  tecnica text not null default 'Rasgueo' check (tecnica in ('Fingerstyle', 'Rasgueo', 'Ambas')),
  imagen text not null default '',
  orden integer not null default 0,
  origen_local_id text,
  fecha_creado timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((not tiene_capo and traste_capo is null) or (tiene_capo and traste_capo between 1 and 11)),
  check ((estado = 'wishlist' and es_wishlist and not me_la_se) or (estado = 'dominada' and not es_wishlist and me_la_se)),
  unique (user_id, origen_local_id)
);

create table public.ajustes (
  user_id uuid not null references auth.users(id) on delete cascade,
  clave text not null,
  valor text not null default '',
  updated_at timestamptz not null default now(),
  primary key (user_id, clave)
);

alter table public.canciones enable row level security;
alter table public.ajustes enable row level security;

grant select, insert, update, delete on public.canciones to anon, authenticated;
grant select, insert, update, delete on public.ajustes to anon, authenticated;

create policy "Repertorio compartido lee canciones" on public.canciones for select to anon, authenticated
using (user_id = '2f0900d7-e8ed-419c-a03e-6812dd54e13d'::uuid);
create policy "Repertorio compartido crea canciones" on public.canciones for insert to anon, authenticated
with check (user_id = '2f0900d7-e8ed-419c-a03e-6812dd54e13d'::uuid);
create policy "Repertorio compartido actualiza canciones" on public.canciones for update to anon, authenticated
using (user_id = '2f0900d7-e8ed-419c-a03e-6812dd54e13d'::uuid)
with check (user_id = '2f0900d7-e8ed-419c-a03e-6812dd54e13d'::uuid);
create policy "Repertorio compartido borra canciones" on public.canciones for delete to anon, authenticated
using (user_id = '2f0900d7-e8ed-419c-a03e-6812dd54e13d'::uuid);

create policy "Repertorio compartido lee ajustes" on public.ajustes for select to anon, authenticated
using (user_id = '2f0900d7-e8ed-419c-a03e-6812dd54e13d'::uuid);
create policy "Repertorio compartido crea ajustes" on public.ajustes for insert to anon, authenticated
with check (user_id = '2f0900d7-e8ed-419c-a03e-6812dd54e13d'::uuid);
create policy "Repertorio compartido actualiza ajustes" on public.ajustes for update to anon, authenticated
using (user_id = '2f0900d7-e8ed-419c-a03e-6812dd54e13d'::uuid)
with check (user_id = '2f0900d7-e8ed-419c-a03e-6812dd54e13d'::uuid);
create policy "Repertorio compartido borra ajustes" on public.ajustes for delete to anon, authenticated
using (user_id = '2f0900d7-e8ed-419c-a03e-6812dd54e13d'::uuid);
