-- Connie Repostería Fina — Productos ocultos en la página web
-- Se puede correr varias veces sin riesgo.
-- Si un producto está en esta lista, no aparece en conniereposteria.com (el sistema y el punto de venta no cambian).
-- Se oculta o se vuelve a mostrar desde el sistema: Catálogo → botón "Ocultar en la página".

create table if not exists productos_ocultos (
  tabla text not null,      -- sabores_pasteles / sabores_cupcakes / individuales / panques
  producto text not null,   -- el "nombre" del producto en su tabla
  created_at timestamptz default now(),
  primary key (tabla, producto)
);

alter table productos_ocultos enable row level security;
drop policy if exists "ocultos ver publico" on productos_ocultos;
drop policy if exists "ocultos crear director" on productos_ocultos;
drop policy if exists "ocultos borrar director" on productos_ocultos;
-- Cualquiera la lee (la página pública la necesita); solo la directora oculta o vuelve a mostrar
create policy "ocultos ver publico" on productos_ocultos for select to anon, authenticated using (true);
create policy "ocultos crear director" on productos_ocultos for insert to authenticated with check (
  exists (select 1 from perfiles where perfiles.user_id = auth.uid() and perfiles.rol = 'director'));
create policy "ocultos borrar director" on productos_ocultos for delete to authenticated using (
  exists (select 1 from perfiles where perfiles.user_id = auth.uid() and perfiles.rol = 'director'));

-- Revisión: debe salir 0 (la lista empieza vacía)
select count(*) from productos_ocultos;
