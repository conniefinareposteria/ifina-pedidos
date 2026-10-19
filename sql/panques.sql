-- Connie Repostería Fina — Nueva categoría: Panqués
-- Se puede correr completo varias veces sin riesgo.

-- 1) Catálogo de panqués (para agregar uno nuevo, solo agrega un renglón aquí)
create table if not exists panques (
  id bigint generated always as identity primary key,
  nombre text not null unique,
  precio numeric not null
);
alter table panques enable row level security;
drop policy if exists "catalogo lectura panques" on panques;
create policy "catalogo lectura panques" on panques for select to authenticated using (true);

insert into panques (nombre, precio) values
  ('platano', 250),
  ('zanahoria', 250)
on conflict (nombre) do update set precio = excluded.precio;

-- 2) Productos del día: nueva sección de panqués
alter table cierres_dia add column if not exists panques jsonb default '{}'::jsonb;
alter table cierres_dia add column if not exists panques_listo boolean default false;
