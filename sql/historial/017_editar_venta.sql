-- Connie Repostería Fina — Editar un ticket del punto de venta (devolución o cambio)
-- Mantiene el mismo folio. Lo que se quita regresa a existencia y lo que se agrega se descuenta
-- (las existencias se calculan con los productos de cada ticket).
-- Guarda cómo estaba el ticket antes de cada cambio en la columna "ediciones".
-- Solo tickets de hoy, sin pedidos y que no sean merma.
-- Se puede correr varias veces sin riesgo.

alter table ventas add column if not exists editado_at timestamptz;
alter table ventas add column if not exists ediciones jsonb default '[]'::jsonb;

create or replace function editar_venta(
  p_id bigint, p_items jsonb, p_subtotal numeric, p_descuento numeric,
  p_total numeric, p_monto_local numeric, p_metodo text)
returns bigint language plpgsql security definer set search_path = public as $$
declare v ventas%rowtype;
begin
  if not exists (select 1 from perfiles where user_id = auth.uid()) then
    raise exception 'Sin permiso';
  end if;
  select * into v from ventas where id = p_id for update;
  if not found then raise exception 'El ticket ya no existe'; end if;
  if v.fecha <> (now() at time zone 'America/Mazatlan')::date then
    raise exception 'Solo se pueden editar tickets de hoy';
  end if;
  if exists (select 1 from jsonb_array_elements(coalesce(v.items, '[]'::jsonb)) x
             where coalesce(x->>'tipo', '') <> 'local' or coalesce((x->>'merma')::boolean, false)) then
    raise exception 'Este ticket tiene pedidos o merma y no se puede editar aquí';
  end if;
  if jsonb_typeof(p_items) <> 'array' then raise exception 'Productos no válidos'; end if;
  if exists (select 1 from jsonb_array_elements(p_items) x
             where coalesce(x->>'tipo', '') <> 'local' or coalesce((x->>'merma')::boolean, false)) then
    raise exception 'Al editar solo se pueden poner productos del local';
  end if;
  if p_total > 0 and p_metodo is null then
    raise exception 'Falta el método de pago';
  end if;
  update ventas set
    ediciones = coalesce(ediciones, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
      'fecha', now(), 'por', auth.uid(), 'items', v.items, 'subtotal', v.subtotal,
      'descuento', v.descuento, 'total', v.total, 'metodo_pago', v.metodo_pago)),
    editado_at = now(),
    items = p_items,
    subtotal = p_subtotal,
    descuento = p_descuento,
    total = p_total,
    monto_local = p_monto_local,
    monto_pedidos = p_total - p_monto_local,
    metodo_pago = case when p_total > 0 then p_metodo else null end
  where id = p_id;
  return p_id;
end $$;
revoke execute on function editar_venta(bigint, jsonb, numeric, numeric, numeric, numeric, text) from public, anon;
grant execute on function editar_venta(bigint, jsonb, numeric, numeric, numeric, numeric, text) to authenticated;
