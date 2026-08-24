-- Un unico repertorio personal, accesible sin iniciar sesion desde los dispositivos del propietario.

drop policy if exists "Usuarios leen sus canciones" on public.canciones;
drop policy if exists "Usuarios crean sus canciones" on public.canciones;
drop policy if exists "Usuarios actualizan sus canciones" on public.canciones;
drop policy if exists "Usuarios borran sus canciones" on public.canciones;
drop policy if exists "Usuarios leen sus ajustes" on public.ajustes;
drop policy if exists "Usuarios crean sus ajustes" on public.ajustes;
drop policy if exists "Usuarios actualizan sus ajustes" on public.ajustes;
drop policy if exists "Usuarios borran sus ajustes" on public.ajustes;

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

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'canciones'
  ) then
    alter publication supabase_realtime add table public.canciones;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'ajustes'
  ) then
    alter publication supabase_realtime add table public.ajustes;
  end if;
end $$;
