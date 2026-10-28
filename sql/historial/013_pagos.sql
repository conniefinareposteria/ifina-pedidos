-- Connie Repostería Fina — Pagos de pedidos registrados a mano (transferencias por WhatsApp, etc.)
-- Se puede correr varias veces sin riesgo.

-- 1) Lista de pagos de cada pedido: [{monto, metodo, fecha}]
alter table pedidos add column if not exists pagos jsonb not null default '[]'::jsonb;

-- 2) El punto de venta toma en cuenta esos pagos al calcular lo que falta
create or replace function registrar_venta(
  p_fecha date, p_items jsonb, p_subtotal numeric, p_descuento numeric,
  p_total numeric, p_monto_local numeric, p_metodo text)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  it jsonb; v_id bigint; v_ped pedidos%rowtype; v_cobrado numeric; v_falta numeric; v_entregar boolean; v_pagos numeric;
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
      v_entregar := coalesce((it->>'entregar')::boolean, true);
      select coalesce(sum((x->>'monto')::numeric), 0) into v_pagos from jsonb_array_elements(coalesce(v_ped.pagos, '[]'::jsonb)) x;
      v_falta := greatest(0, coalesce(v_ped.precio,0) - coalesce(v_ped.anticipo,0)
                 - coalesce(v_ped.pago_entrega,0) - coalesce(v_ped.descuento_entrega,0) - v_pagos);
      update pedidos set
        pago_entrega = coalesce(pago_entrega,0) + v_cobrado,
        metodo_entrega = case when v_cobrado > 0 then p_metodo else metodo_entrega end,
        descuento_entrega = coalesce(descuento_entrega,0) + greatest(0, v_falta - v_cobrado),
        entregado = case when v_entregar then true else entregado end,
        entregado_at = case when v_entregar then now() else entregado_at end
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
