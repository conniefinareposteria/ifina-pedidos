-- Connie Fina Repostería — Base de datos de clientes
-- Se puede correr completo varias veces sin riesgo.

-- 1) Tabla de clientes
create table if not exists clientes (
  id bigint generated always as identity primary key,
  created_at timestamptz default now(),
  nombre text not null,
  telefono text,
  calle text,
  numero_exterior text,
  numero_interior text,
  colonia text,
  codigo_postal text,
  ciudad text,
  referencias text
);

-- 2) Seguridad: cualquier usuario logueado puede buscar y dar de alta clientes.
--    Editar o borrar clientes se hace desde Supabase (Table Editor).
alter table clientes enable row level security;
drop policy if exists "clientes ver" on clientes;
drop policy if exists "clientes insertar" on clientes;
create policy "clientes ver" on clientes for select to authenticated using (true);
create policy "clientes insertar" on clientes for insert to authenticated with check (true);

-- 3) Pedidos: a qué cliente pertenece y la dirección de entrega desglosada
alter table pedidos add column if not exists cliente_id bigint references clientes(id);
alter table pedidos add column if not exists direccion_detalle jsonb;
