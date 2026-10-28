-- Connie Repostería Fina — Pago diferido en el punto de venta
-- Una venta se puede pagar con varios métodos (ej. $100 efectivo + $100 tarjeta).
-- Se guarda metodo_pago = 'mixto' y el detalle en la columna "pagos": [{metodo, monto}].
-- Se puede correr varias veces sin riesgo.

alter table ventas add column if not exists pagos jsonb;

alter table ventas drop constraint if exists ventas_metodo_pago_check;
alter table ventas add constraint ventas_metodo_pago_check
  check (metodo_pago in ('efectivo','transferencia','tarjeta','terminal','mixto'));

-- registrar_venta: mismo funcionamiento + parámetro opcional p_pagos
drop function if exists registrar_venta(date, jsonb, numeric, numeric, numeric, numeric, text);
create or replace function registrar_venta(
  p_fecha date, p_items jsonb, p_subtotal numeric, p_descuento numeric,
  p_total numeric, p_monto_local numeric, p_metodo text, p_pagos jsonb default null)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  it jsonb; v_id bigint; v_ped pedidos%rowtype; v_cobrado numeric; v_falta numeric; v_entregar boolean; v_pagos numeric; v_anticipo boolean;
  v_suma numeric;
begin
  if not exists (select 1 from perfiles where user_id = auth.uid()) then
    raise exception 'Sin permiso';
  end if;
  if p_total > 0 and p_metodo is null then
    raise exception 'Falta el método de pago';
  end if;
  if p_metodo = 'mixto' then
    if p_pagos is null or jsonb_typeof(p_pagos) <> 'array' or jsonb_array_length(p_pagos) < 2 then
      raise exception 'Faltan los montos del pago diferido';
    end if;
    select coalesce(sum((x->>'monto')::numeric), 0) into v_suma from jsonb_array_elements(p_pagos) x;
    if abs(v_suma - p_total) > 0.01 then raise exception 'Los montos del pago diferido no suman el total'; end if;
  end if;
  for it in select * from jsonb_array_elements(p_items) loop
    if it->>'tipo' = 'pedido' then
      select * into v_ped from pedidos where id = (it->>'pedido_id')::bigint for update;
      if not found then raise exception 'El pedido ya no existe'; end if;
      if v_ped.entregado then raise exception 'El pedido de % ya estaba entregado', v_ped.nombre_cliente; end if;
      v_cobrado := coalesce((it->>'cobrado')::numeric, 0);
      v_anticipo := coalesce((it->>'anticipo')::boolean, false);
      v_entregar := coalesce((it->>'entregar')::boolean, true);
      if v_anticipo then
        update pedidos set
          pagos = coalesce(pagos, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
            'monto', v_cobrado, 'metodo', p_metodo, 'fecha', now(), 'origen', 'punto de venta', 'tipo', 'anticipo'))
        where id = v_ped.id;
      else
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
    end if;
  end loop;
  insert into ventas (fecha, items, subtotal, descuento, total, monto_local, monto_pedidos, metodo_pago, pagos)
  values (p_fecha, p_items, p_subtotal, p_descuento, p_total, p_monto_local, p_total - p_monto_local, p_metodo,
          case when p_metodo = 'mixto' then p_pagos else null end)
  returning id into v_id;
  return v_id;
end $$;
revoke execute on function registrar_venta(date, jsonb, numeric, numeric, numeric, numeric, text, jsonb) from public, anon;
grant execute on function registrar_venta(date, jsonb, numeric, numeric, numeric, numeric, text, jsonb) to authenticated;
