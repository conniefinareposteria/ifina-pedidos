-- ===== 042 Compras: inventario, lista de compras por tienda y lo que se compró =====
-- Toma como base los insumos de Finanzas (tabla insumos). Solo la directora ve y usa Compras.
-- Se puede volver a correr sin riesgo.

-- Tiendas o proveedores
create table if not exists compras_tiendas (
  id bigint generated always as identity primary key,
  created_at timestamptz default now(),
  nombre text not null unique,
  orden int not null default 0
);

-- Cómo se compra cada insumo: en qué se cuenta, cuánto trae, cuántos quiero tener y en qué tiendas
create table if not exists compras_articulos (
  insumo_id bigint primary key references insumos(id) on delete cascade,
  activo boolean not null default false,                         -- sale en el inventario (lo compro seguido)
  unidad_conteo text,                                            -- ej. costal, caja, cartera
  contenido numeric check (contenido is null or contenido > 0),  -- cuánto trae, en g / ml / piezas
  objetivo numeric check (objetivo is null or objetivo >= 0),    -- cuántas quiero tener
  tiendas bigint[] not null default '{}'                         -- tiendas donde lo compro
);

-- Otras presentaciones de un mismo insumo (ej. Lechera: caja de 48 latas, bolsa de 900 g, bolsa de 11 kg)
create table if not exists compras_presentaciones (
  id bigint generated always as identity primary key,
  insumo_id bigint not null references insumos(id) on delete cascade,
  nombre text not null,
  contenido numeric not null check (contenido > 0),              -- g / ml / piezas
  unique (insumo_id, nombre)
);

-- Cada vez que se cuenta el inventario se abre una lista; se cierra al terminar de comprar
create table if not exists compras_listas (
  id bigint generated always as identity primary key,
  created_at timestamptz default now(),
  fecha date not null default current_date,
  creada_por uuid default auth.uid() references auth.users(id),
  ruta bigint[] not null default '{}',                           -- tiendas del día, en orden
  cerrada boolean not null default false,
  cerrada_at timestamptz
);

-- Lo que se contó y lo que hay que comprar (en la unidad de conteo)
create table if not exists compras_lista_items (
  id bigint generated always as identity primary key,
  lista_id bigint not null references compras_listas(id) on delete cascade,
  insumo_id bigint not null references insumos(id) on delete cascade,
  tengo numeric check (tengo is null or tengo >= 0),
  comprar numeric check (comprar is null or comprar >= 0),
  unique (lista_id, insumo_id)
);

-- Lo que pasó en cada tienda: se compró (con presentación, cantidad y precio) o no había
create table if not exists compras_movimientos (
  id bigint generated always as identity primary key,
  created_at timestamptz default now(),
  lista_id bigint not null references compras_listas(id) on delete cascade,
  insumo_id bigint not null references insumos(id) on delete cascade,
  tienda_id bigint references compras_tiendas(id) on delete set null,
  estado text not null check (estado in ('comprado','no_habia')),
  presentacion text,
  contenido numeric check (contenido is null or contenido > 0),  -- g / ml / piezas de la presentación
  cantidad numeric check (cantidad is null or cantidad > 0),     -- cuántas presentaciones
  precio numeric check (precio is null or precio >= 0)           -- precio de UNA presentación
);
create index if not exists compras_movimientos_insumo on compras_movimientos (insumo_id, created_at);
create index if not exists compras_movimientos_lista on compras_movimientos (lista_id);

-- Solo la directora
alter table compras_tiendas enable row level security;
alter table compras_articulos enable row level security;
alter table compras_presentaciones enable row level security;
alter table compras_listas enable row level security;
alter table compras_lista_items enable row level security;
alter table compras_movimientos enable row level security;
drop policy if exists "compras tiendas directora" on compras_tiendas;
drop policy if exists "compras articulos directora" on compras_articulos;
drop policy if exists "compras presentaciones directora" on compras_presentaciones;
drop policy if exists "compras listas directora" on compras_listas;
drop policy if exists "compras lista items directora" on compras_lista_items;
drop policy if exists "compras movimientos directora" on compras_movimientos;
create policy "compras tiendas directora" on compras_tiendas for all to authenticated
  using (exists (select 1 from perfiles where user_id = auth.uid() and rol = 'director'))
  with check (exists (select 1 from perfiles where user_id = auth.uid() and rol = 'director'));
create policy "compras articulos directora" on compras_articulos for all to authenticated
  using (exists (select 1 from perfiles where user_id = auth.uid() and rol = 'director'))
  with check (exists (select 1 from perfiles where user_id = auth.uid() and rol = 'director'));
create policy "compras presentaciones directora" on compras_presentaciones for all to authenticated
  using (exists (select 1 from perfiles where user_id = auth.uid() and rol = 'director'))
  with check (exists (select 1 from perfiles where user_id = auth.uid() and rol = 'director'));
create policy "compras listas directora" on compras_listas for all to authenticated
  using (exists (select 1 from perfiles where user_id = auth.uid() and rol = 'director'))
  with check (exists (select 1 from perfiles where user_id = auth.uid() and rol = 'director'));
create policy "compras lista items directora" on compras_lista_items for all to authenticated
  using (exists (select 1 from perfiles where user_id = auth.uid() and rol = 'director'))
  with check (exists (select 1 from perfiles where user_id = auth.uid() and rol = 'director'));
create policy "compras movimientos directora" on compras_movimientos for all to authenticated
  using (exists (select 1 from perfiles where user_id = auth.uid() and rol = 'director'))
  with check (exists (select 1 from perfiles where user_id = auth.uid() and rol = 'director'));
