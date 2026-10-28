-- Connie Repostería Fina — Punto de venta: botón Editar en pedidos
-- 1) Cambiar un pedido de "recoge en local" a "domicilio" (o regresarlo a local)
-- 2) Quitar el "Finalizado" a un pedido entregado por error (vuelve a pendiente por entregar)
-- Lo puede usar cualquier usuario con perfil (colaborador incluido). No toca pagos.
-- Se puede correr varias veces sin riesgo.

create or replace function pos_cambiar_entrega(p_id bigint, p_entrega text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from perfiles where user_id = auth.uid()) then raise exception 'Sin permiso'; end if;
  if p_entrega not in ('domicilio', 'local') then raise exception 'Tipo de entrega no válido'; end if;
  update pedidos set entrega = p_entrega where id = p_id;
end $$;
revoke execute on function pos_cambiar_entrega(bigint, text) from public, anon;
grant execute on function pos_cambiar_entrega(bigint, text) to authenticated;

create or replace function pos_reabrir_pedido(p_id bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from perfiles where user_id = auth.uid()) then raise exception 'Sin permiso'; end if;
  update pedidos set entregado = false, entregado_at = null where id = p_id;
end $$;
revoke execute on function pos_reabrir_pedido(bigint) from public, anon;
grant execute on function pos_reabrir_pedido(bigint) to authenticated;
