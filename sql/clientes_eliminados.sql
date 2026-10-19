-- Connie Repostería Fina — Pestaña Clientes + Pedidos eliminados
-- Se puede correr completo varias veces sin riesgo.

-- 1) Clientes: apellido por separado y permiso para que la directora los edite
alter table clientes add column if not exists apellido text;
drop policy if exists "clientes editar director" on clientes;
create policy "clientes editar director" on clientes for update to authenticated using (
  exists (select 1 from perfiles where perfiles.user_id = auth.uid() and perfiles.rol = 'director'));

-- 2) Papelera de pedidos: cada pedido que se borra se guarda aquí automáticamente
create table if not exists pedidos_eliminados (
  id bigint generated always as identity primary key,
  eliminado_at timestamptz default now(),
  eliminado_por uuid,
  pedido jsonb not null
);
alter table pedidos_eliminados enable row level security;
drop policy if exists "eliminados ver director" on pedidos_eliminados;
create policy "eliminados ver director" on pedidos_eliminados for select to authenticated using (
  exists (select 1 from perfiles where perfiles.user_id = auth.uid() and perfiles.rol = 'director'));

create or replace function guardar_pedido_eliminado() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into pedidos_eliminados (eliminado_por, pedido) values (auth.uid(), to_jsonb(old));
  return old;
end $$;

drop trigger if exists trg_pedido_eliminado on pedidos;
create trigger trg_pedido_eliminado before delete on pedidos
  for each row execute function guardar_pedido_eliminado();

-- 3) Recuperar: regresa el pedido a "pedidos" tal como estaba (mismo número)
create or replace function recuperar_pedido(eliminado_id bigint) returns void
language plpgsql security definer set search_path = public as $$
declare r jsonb;
begin
  if not exists (select 1 from perfiles where user_id = auth.uid() and rol = 'director') then
    raise exception 'Solo la directora puede recuperar pedidos';
  end if;
  select pedido into r from pedidos_eliminados where id = eliminado_id;
  if r is null then raise exception 'No se encontró el pedido eliminado'; end if;
  insert into pedidos overriding system value
    select * from jsonb_populate_record(null::pedidos, r);
  delete from pedidos_eliminados where id = eliminado_id;
end $$;
revoke execute on function recuperar_pedido(bigint) from public, anon;
grant execute on function recuperar_pedido(bigint) to authenticated;
