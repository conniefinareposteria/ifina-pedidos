-- Connie Repostería Fina — Venta del día: los pagos de cada pedido cuentan el día en que se ENTREGA
-- Se puede correr varias veces sin riesgo. No cambia ningún dato: solo agrega una función de lectura.
--
-- El corte de caja, el Historial y el Resumen la usan para que, si el 15 se entregan 10 pasteles y 5 se
-- pagaron por transferencia un mes antes, ese dinero salga el 15 (con su método de pago).
-- Devuelve solo lo necesario para las cuentas (no nombres ni teléfonos).
-- Colaborador: hasta 2 días (el corte de hoy). Directora: hasta 400 días (Historial y Resumen).

create or replace function pedidos_pagos_por_entrega(desde timestamptz, hasta timestamptz)
returns table (id bigint, fecha_entrega timestamptz, created_at timestamptz, precio numeric, anticipo numeric, metodo_pago text,
               pagos jsonb, pago_entrega numeric, metodo_entrega text, descuento_entrega numeric, entregado boolean, entregado_at timestamptz)
language plpgsql security definer set search_path = public as $$
declare v_rol text;
begin
  select rol into v_rol from perfiles where user_id = auth.uid();
  if v_rol is null then raise exception 'Sin permiso'; end if;
  if hasta - desde > (case when v_rol = 'director' then interval '400 days' else interval '2 days' end) then
    raise exception 'Rango no permitido';
  end if;
  return query
    select p.id, p.fecha_entrega, p.created_at, p.precio, p.anticipo, p.metodo_pago,
           coalesce(p.pagos, '[]'::jsonb), p.pago_entrega, p.metodo_entrega, p.descuento_entrega, p.entregado, p.entregado_at
    from pedidos p
    where p.fecha_entrega >= desde and p.fecha_entrega < hasta;
end $$;
revoke execute on function pedidos_pagos_por_entrega(timestamptz, timestamptz) from public, anon;
grant execute on function pedidos_pagos_por_entrega(timestamptz, timestamptz) to authenticated;
