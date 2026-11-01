-- Connie Repostería Fina — "Lo que hay hoy en el local" (página web)
-- Se puede correr varias veces sin riesgo.
-- El punto de venta guarda aquí lo disponible cada vez que se actualiza (abrir, vender, merma, cortesía).
-- La página lo muestra solo para consultar. No guarda precios ni dinero.

create table if not exists existencias_local (
  id int primary key default 1 check (id = 1),   -- un solo renglón
  datos jsonb,
  updated_at timestamptz default now()
);

alter table existencias_local enable row level security;
drop policy if exists "existencias ver publico" on existencias_local;
drop policy if exists "existencias crear personal" on existencias_local;
drop policy if exists "existencias editar personal" on existencias_local;
create policy "existencias ver publico" on existencias_local for select to anon, authenticated using (true);
create policy "existencias crear personal" on existencias_local for insert to authenticated with check (exists (select 1 from perfiles where user_id = auth.uid()));
create policy "existencias editar personal" on existencias_local for update to authenticated using (exists (select 1 from perfiles where user_id = auth.uid()));

-- Revisión: debe salir 0 (se llena sola cuando se abre el punto de venta)
select count(*) from existencias_local;
