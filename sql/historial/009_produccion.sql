-- Connie Repostería Fina — Usuario Producción, metas de producción y anticipos del día
-- Se puede correr completo varias veces sin riesgo.
-- ANTES: crea el usuario produccion@conniereposteria.com en Authentication → Users → Add user.

-- 1) Rol Producción para ese correo (se permite el rol 'produccion')
alter table perfiles drop constraint if exists rol_valido;
alter table perfiles add constraint rol_valido check (rol in ('director','colaborador','produccion'));
insert into perfiles (user_id, rol)
select id, 'produccion' from auth.users where email = 'produccion@conniereposteria.com'
on conflict (user_id) do update set rol = excluded.rol;

-- 2) Producción puede VER pedidos (no editar ni borrar)
drop policy if exists "pedidos ver produccion" on pedidos;
create policy "pedidos ver produccion" on pedidos for select to authenticated using (
  exists (select 1 from perfiles where perfiles.user_id = auth.uid() and perfiles.rol = 'produccion'));

-- 3) Metas: cuántos debe haber cada día (2 = martes ... 6 = sábado)
create table if not exists metas_produccion (
  dia int primary key check (dia between 0 and 6),
  pasteles jsonb not null default '{}'::jsonb,
  cupcakes jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);
alter table metas_produccion enable row level security;
drop policy if exists "metas ver" on metas_produccion;
drop policy if exists "metas crear director" on metas_produccion;
drop policy if exists "metas editar director" on metas_produccion;
create policy "metas ver" on metas_produccion for select to authenticated using (
  exists (select 1 from perfiles where perfiles.user_id = auth.uid()));
create policy "metas crear director" on metas_produccion for insert to authenticated with check (
  exists (select 1 from perfiles where perfiles.user_id = auth.uid() and perfiles.rol = 'director'));
create policy "metas editar director" on metas_produccion for update to authenticated using (
  exists (select 1 from perfiles where perfiles.user_id = auth.uid() and perfiles.rol = 'director'));

-- 4) Anticipos recibidos en el día (nota del corte de caja; no cuentan como venta)
create or replace function anticipos_del_dia(desde timestamptz, hasta timestamptz)
returns table (metodo text, monto numeric) language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from perfiles where user_id = auth.uid()) then raise exception 'Sin permiso'; end if;
  if hasta - desde > interval '2 days' then raise exception 'Rango no permitido'; end if;
  return query
    select p.metodo_pago, sum(coalesce(p.anticipo,0))
    from pedidos p
    where p.created_at >= desde and p.created_at < hasta and coalesce(p.anticipo,0) > 0
    group by p.metodo_pago;
end $$;
revoke execute on function anticipos_del_dia(timestamptz, timestamptz) from public, anon;
grant execute on function anticipos_del_dia(timestamptz, timestamptz) to authenticated;

-- Revisión: debe salir el correo con rol produccion
select u.email, p.rol from perfiles p join auth.users u on u.id = p.user_id order by p.rol;
