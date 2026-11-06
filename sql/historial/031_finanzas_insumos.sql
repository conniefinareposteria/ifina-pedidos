-- Connie Repostería Fina — Finanzas: insumos (solo la directora)
-- Se puede correr varias veces sin riesgo.
-- Cada insumo guarda su presentación de compra (ej. 1000 g por $45). Cada vez que se crea o cambia
-- la cantidad o el precio, se guarda una línea en el historial (para ver cómo suben los precios).
-- Más adelante: tickets de compra, recetas, costos por pastel y estado de resultados.

create table if not exists insumos (
  id bigint generated always as identity primary key,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  nombre text not null unique,
  unidad text not null default 'g' check (unidad in ('g','ml','pza')),
  cantidad numeric check (cantidad is null or cantidad > 0),   -- cuánto trae la presentación
  precio numeric check (precio is null or precio >= 0)         -- lo que cuesta esa presentación
);

create table if not exists insumos_historial (
  id bigint generated always as identity primary key,
  insumo_id bigint not null references insumos(id) on delete cascade,
  fecha timestamptz default now(),
  cantidad numeric,
  unidad text,
  precio numeric,
  origen text default 'manual'      -- manual / ticket (más adelante)
);
create index if not exists insumos_historial_insumo on insumos_historial (insumo_id, fecha);

-- Historial automático
-- (security definer: el historial no se escribe directo desde la página, solo por aquí)
create or replace function insumos_guardar_historial() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.cantidad is distinct from old.cantidad or new.precio is distinct from old.precio or new.unidad is distinct from old.unidad then
    insert into insumos_historial (insumo_id, cantidad, unidad, precio) values (new.id, new.cantidad, new.unidad, new.precio);
  end if;
  return new;
end $$;
drop trigger if exists insumos_historial_trg on insumos;
create trigger insumos_historial_trg after insert or update on insumos for each row execute function insumos_guardar_historial();

-- Solo la directora ve y cambia todo lo de finanzas
alter table insumos enable row level security;
alter table insumos_historial enable row level security;
drop policy if exists "insumos directora" on insumos;
drop policy if exists "insumos historial directora" on insumos_historial;
create policy "insumos directora" on insumos for all to authenticated
  using (exists (select 1 from perfiles where user_id = auth.uid() and rol = 'director'))
  with check (exists (select 1 from perfiles where user_id = auth.uid() and rol = 'director'));
create policy "insumos historial directora" on insumos_historial for select to authenticated
  using (exists (select 1 from perfiles where user_id = auth.uid() and rol = 'director'));

-- Revisión: deben salir las dos tablas
select table_name from information_schema.tables where table_name in ('insumos','insumos_historial') order by 1;
