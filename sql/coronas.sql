-- Connie Repostería Fina — Coronas para pasteles
-- Se puede correr completo varias veces sin riesgo.

-- 1) Catálogo de coronas (los precios se cambian aquí)
create table if not exists coronas (
  id bigint generated always as identity primary key,
  tipo text not null,      -- 'ambar' o 'color'
  tamano text not null,    -- 'mini' o 'normal'
  precio numeric not null,
  unique (tipo, tamano)
);
alter table coronas enable row level security;
drop policy if exists "catalogo lectura coronas" on coronas;
create policy "catalogo lectura coronas" on coronas for select to authenticated using (true);

insert into coronas (tipo, tamano, precio) values
  ('ambar', 'mini',   30),
  ('ambar', 'normal', 50),
  ('color', 'mini',  100),
  ('color', 'normal', 150)
on conflict (tipo, tamano) do update set precio = excluded.precio;

-- 2) Sabores que ya incluyen corona
alter table sabores_pasteles add column if not exists incluye_corona boolean default false;
update sabores_pasteles
set incluye_corona = true
where regexp_replace(translate(lower(nombre), 'áéíóú', 'aeiou'), '[^a-z]', '', 'g')
  in ('whitevelvet','pistache','bicajeta','bichocolate','marmoleado','vintage','zanahoria');

-- 3) Pedidos: guardar la corona elegida
alter table pedidos add column if not exists corona_tipo text;
alter table pedidos add column if not exists corona_tamano text;
alter table pedidos add column if not exists corona_color text;
alter table pedidos add column if not exists corona_precio numeric;

-- Para revisar qué sabores quedaron con corona incluida:
select nombre, incluye_corona from sabores_pasteles order by nombre;
