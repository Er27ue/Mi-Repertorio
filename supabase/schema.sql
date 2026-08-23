-- Esquema de referencia de Mi Repertorio.
-- La base remota usa estas tablas con RLS y politicas por auth.uid().

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

grant select, insert, update, delete on public.canciones to authenticated;
grant select, insert, update, delete on public.ajustes to authenticated;
revoke all on public.canciones from anon;
revoke all on public.ajustes from anon;

create policy "Usuarios leen sus canciones" on public.canciones for select to authenticated
using ((select auth.uid()) = user_id);
create policy "Usuarios crean sus canciones" on public.canciones for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy "Usuarios actualizan sus canciones" on public.canciones for update to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Usuarios borran sus canciones" on public.canciones for delete to authenticated
using ((select auth.uid()) = user_id);

create policy "Usuarios leen sus ajustes" on public.ajustes for select to authenticated
using ((select auth.uid()) = user_id);
create policy "Usuarios crean sus ajustes" on public.ajustes for insert to authenticated
with check ((select auth.uid()) = user_id);
create policy "Usuarios actualizan sus ajustes" on public.ajustes for update to authenticated
using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Usuarios borran sus ajustes" on public.ajustes for delete to authenticated
using ((select auth.uid()) = user_id);
