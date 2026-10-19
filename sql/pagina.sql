-- Connie Repostería Fina — Página pública (conniereposteria.com)
-- Se puede correr completo varias veces sin riesgo.

-- 1) Personas por tamaño (para la lista de precios)
alter table tamanos_pastel add column if not exists personas int;
update tamanos_pastel set personas = 7  where tamano = 'mini';
update tamanos_pastel set personas = 15 where tamano = 'chico';
update tamanos_pastel set personas = 25 where tamano = 'mediano';
update tamanos_pastel set personas = 35 where tamano = 'grande';
update tamanos_pastel set personas = 50 where regexp_replace(lower(tamano),'[^a-z0-9]','','g') in ('extragrande','plancha50');
update tamanos_pastel set personas = 60 where regexp_replace(lower(tamano),'[^a-z0-9]','','g') = 'plancha60';
update tamanos_pastel set personas = 16 where regexp_replace(lower(tamano),'[^a-z0-9]','','g') = 'tresleches';
update tamanos_pastel set personas = 12 where regexp_replace(lower(tamano),'[^a-z0-9]','','g') like 'cheesecake%';

-- 2) Foto y descripción en cada producto (se llenan después)
alter table sabores_pasteles add column if not exists foto_url text;
alter table sabores_pasteles add column if not exists descripcion text;
alter table sabores_cupcakes add column if not exists foto_url text;
alter table individuales     add column if not exists foto_url text;
alter table panques          add column if not exists foto_url text;

-- 3) Lista de decoración ("Hazlo especial"). precio vacío = "Cotizar"
create table if not exists decoraciones (
  id bigint generated always as identity primary key,
  nombre text not null unique,
  precio numeric,
  orden int default 99,
  foto_url text
);
alter table decoraciones enable row level security;
insert into decoraciones (nombre, precio, orden) values
  ('Base blanca', 50, 1),
  ('Corona de color', 100, 2),
  ('Decorado simple', 100, 3),
  ('Decorado de evento', null, 4)
on conflict (nombre) do nothing;

-- 4) La página puede LEER el catálogo sin iniciar sesión (solo lectura)
drop policy if exists "publico lee tamanos"      on tamanos_pastel;
drop policy if exists "publico lee sabores_p"    on sabores_pasteles;
drop policy if exists "publico lee sabores_c"    on sabores_cupcakes;
drop policy if exists "publico lee individuales" on individuales;
drop policy if exists "publico lee panques"      on panques;
drop policy if exists "publico lee coronas"      on coronas;
drop policy if exists "publico lee decoraciones" on decoraciones;
create policy "publico lee tamanos"      on tamanos_pastel   for select to anon, authenticated using (true);
create policy "publico lee sabores_p"    on sabores_pasteles for select to anon, authenticated using (true);
create policy "publico lee sabores_c"    on sabores_cupcakes for select to anon, authenticated using (true);
create policy "publico lee individuales" on individuales     for select to anon, authenticated using (true);
create policy "publico lee panques"      on panques          for select to anon, authenticated using (true);
create policy "publico lee coronas"      on coronas          for select to anon, authenticated using (true);
create policy "publico lee decoraciones" on decoraciones     for select to anon, authenticated using (true);

-- 5) Solicitudes de pedido que llegan desde la página
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
  estado text not null default 'nueva'
);
alter table solicitudes enable row level security;
drop policy if exists "publico crea solicitudes"   on solicitudes;
drop policy if exists "director ve solicitudes"    on solicitudes;
drop policy if exists "director edita solicitudes" on solicitudes;
-- Cualquiera puede ENVIAR una solicitud, pero nadie de afuera puede leerlas
create policy "publico crea solicitudes" on solicitudes for insert to anon, authenticated with check (estado = 'nueva');
-- Solo la directora las ve y las maneja
create policy "director ve solicitudes" on solicitudes for select to authenticated using (
  exists (select 1 from perfiles where perfiles.user_id = auth.uid() and perfiles.rol = 'director'));
create policy "director edita solicitudes" on solicitudes for update to authenticated using (
  exists (select 1 from perfiles where perfiles.user_id = auth.uid() and perfiles.rol = 'director'));

-- Para revisar los tamaños con sus personas:
select tamano, personas, precio from tamanos_pastel order by precio;
