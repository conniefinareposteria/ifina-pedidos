-- Connie Repostería Fina — Catálogo público (conniereposteria.com)
-- Se puede correr completo varias veces sin riesgo.

-- 1) Campo de foto en cada producto (la URL de la foto se pone después)
alter table sabores_pasteles add column if not exists foto_url text;
alter table sabores_cupcakes add column if not exists foto_url text;
alter table individuales     add column if not exists foto_url text;
alter table panques          add column if not exists foto_url text;

-- 2) El catálogo se puede LEER sin iniciar sesión (solo lectura)
drop policy if exists "publico lee tamanos"     on tamanos_pastel;
drop policy if exists "publico lee sabores_p"   on sabores_pasteles;
drop policy if exists "publico lee sabores_c"   on sabores_cupcakes;
drop policy if exists "publico lee individuales" on individuales;
drop policy if exists "publico lee panques"     on panques;
drop policy if exists "publico lee coronas"     on coronas;
create policy "publico lee tamanos"      on tamanos_pastel   for select to anon using (true);
create policy "publico lee sabores_p"    on sabores_pasteles for select to anon using (true);
create policy "publico lee sabores_c"    on sabores_cupcakes for select to anon using (true);
create policy "publico lee individuales" on individuales     for select to anon using (true);
create policy "publico lee panques"      on panques          for select to anon using (true);
create policy "publico lee coronas"      on coronas          for select to anon using (true);

-- 3) Solicitudes de pedido que llegan desde la página
create table if not exists solicitudes (
  id bigint generated always as identity primary key,
  created_at timestamptz default now(),
  nombre text not null check (char_length(nombre) <= 80),
  telefono text not null check (char_length(telefono) <= 20),
  fecha_deseada date,
  entrega text,
  direccion text check (char_length(direccion) <= 300),
  comentarios text check (char_length(comentarios) <= 500),
  items jsonb not null,
  total numeric,
  estado text not null default 'nueva'   -- nueva / aceptada / descartada
);
alter table solicitudes enable row level security;
drop policy if exists "publico crea solicitudes" on solicitudes;
drop policy if exists "director ve solicitudes" on solicitudes;
drop policy if exists "director edita solicitudes" on solicitudes;
-- Cualquiera puede ENVIAR una solicitud, pero no leer las de otros
create policy "publico crea solicitudes" on solicitudes for insert to anon, authenticated with check (estado = 'nueva');
-- Solo la directora las ve y las acepta
create policy "director ve solicitudes" on solicitudes for select to authenticated using (
  exists (select 1 from perfiles where perfiles.user_id = auth.uid() and perfiles.rol = 'director'));
create policy "director edita solicitudes" on solicitudes for update to authenticated using (
  exists (select 1 from perfiles where perfiles.user_id = auth.uid() and perfiles.rol = 'director'));
