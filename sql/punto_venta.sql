-- Connie Repostería Fina — Punto de venta
-- Se puede correr completo varias veces sin riesgo.

-- 1) Pedidos: cobro y entrega desde el punto de venta
alter table pedidos add column if not exists pago_entrega numeric default 0;
alter table pedidos add column if not exists metodo_entrega text;
alter table pedidos add column if not exists descuento_entrega numeric default 0;
alter table pedidos add column if not exists entregado boolean default false;
alter table pedidos add column if not exists entregado_at timestamptz;

-- 2) Ventas: una fila por cada cobro del punto de venta
create table if not exists ventas (
  id bigint generated always as identity primary key,
  created_at timestamptz default now(),
  fecha date not null,
  vendedor uuid default auth.uid(),
  items jsonb not null,
  subtotal numeric not null default 0,
  descuento numeric not null default 0,
  total numeric not null default 0,
  monto_local numeric not null default 0,
  monto_pedidos numeric not null default 0,
  metodo_pago text check (metodo_pago in ('efectivo','transferencia','terminal'))
);
alter table ventas enable row level security;
drop policy if exists "ventas ver" on ventas;
create policy "ventas ver" on ventas for select to authenticated using (true);
-- Las ventas solo se crean con la función registrar_venta (no hay insert directo)

-- 3) Pedidos que se recogen hoy en el local (el colaborador solo ve estos)
create or replace function pedidos_entrega_hoy(desde timestamptz, hasta timestamptz)
returns setof pedidos language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from perfiles where user_id = auth.uid()) then
    raise exception 'Sin permiso';
  end if;
  if hasta - desde > interval '2 days' then
    raise exception 'Rango no permitido';
  end if;
  return query
    select * from pedidos
    where fecha_entrega >= desde and fecha_entrega < hasta
      and coalesce(entrega, 'recoger') in ('recoger', 'local')
    order by fecha_entrega;
end $$;
revoke execute on function pedidos_entrega_hoy(timestamptz, timestamptz) from public, anon;
grant execute on function pedidos_entrega_hoy(timestamptz, timestamptz) to authenticated;

-- 4) Registrar una venta (y entregar los pedidos que vengan en ella) en un solo paso
create or replace function registrar_venta(
  p_fecha date, p_items jsonb, p_subtotal numeric, p_descuento numeric,
  p_total numeric, p_monto_local numeric, p_metodo text)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  it jsonb; v_id bigint; v_ped pedidos%rowtype; v_cobrado numeric; v_falta numeric;
begin
  if not exists (select 1 from perfiles where user_id = auth.uid()) then
    raise exception 'Sin permiso';
  end if;
  if p_total > 0 and p_metodo is null then
    raise exception 'Falta el método de pago';
  end if;
  for it in select * from jsonb_array_elements(p_items) loop
    if it->>'tipo' = 'pedido' then
      select * into v_ped from pedidos where id = (it->>'pedido_id')::bigint for update;
      if not found then raise exception 'El pedido ya no existe'; end if;
      if v_ped.entregado then raise exception 'El pedido de % ya estaba entregado', v_ped.nombre_cliente; end if;
      v_cobrado := coalesce((it->>'cobrado')::numeric, 0);
      v_falta := greatest(0, coalesce(v_ped.precio,0) - coalesce(v_ped.anticipo,0)
                 - coalesce(v_ped.pago_entrega,0) - coalesce(v_ped.descuento_entrega,0));
      update pedidos set
        pago_entrega = coalesce(pago_entrega,0) + v_cobrado,
        metodo_entrega = case when v_cobrado > 0 then p_metodo else metodo_entrega end,
        descuento_entrega = coalesce(descuento_entrega,0) + greatest(0, v_falta - v_cobrado),
        entregado = true,
        entregado_at = now()
      where id = v_ped.id;
    end if;
  end loop;
  insert into ventas (fecha, items, subtotal, descuento, total, monto_local, monto_pedidos, metodo_pago)
  values (p_fecha, p_items, p_subtotal, p_descuento, p_total, p_monto_local, p_total - p_monto_local, p_metodo)
  returning id into v_id;
  return v_id;
end $$;
revoke execute on function registrar_venta(date, jsonb, numeric, numeric, numeric, numeric, text) from public, anon;
grant execute on function registrar_venta(date, jsonb, numeric, numeric, numeric, numeric, text) to authenticated;
