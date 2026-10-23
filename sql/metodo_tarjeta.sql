-- Connie Repostería Fina — Cambiar el método de pago "terminal" por "tarjeta"
-- Cambia todo lo ya guardado (ventas, pedidos, pagos y cortes de caja).
-- Se puede correr varias veces sin riesgo.

-- 1) Ventas del punto de venta: permitir 'tarjeta' (se deja 'terminal' permitido solo por compatibilidad)
alter table ventas drop constraint if exists ventas_metodo_pago_check;
update ventas set metodo_pago = 'tarjeta' where metodo_pago = 'terminal';
alter table ventas add constraint ventas_metodo_pago_check
  check (metodo_pago in ('efectivo','transferencia','tarjeta','terminal'));

-- 2) Pedidos: anticipo y pago al entregar
update pedidos set metodo_pago = 'tarjeta' where metodo_pago = 'terminal';
update pedidos set metodo_entrega = 'tarjeta' where metodo_entrega = 'terminal';

-- 3) Pedidos: pagos registrados después (lista de pagos)
update pedidos
set pagos = (
  select jsonb_agg(case when x->>'metodo' = 'terminal' then jsonb_set(x, '{metodo}', '"tarjeta"') else x end)
  from jsonb_array_elements(pagos) x
)
where jsonb_typeof(pagos) = 'array' and pagos::text like '%"terminal"%';

-- 4) Cortes de caja guardados: anticipos por método
update cierres_dia
set corte_caja = jsonb_set(
  corte_caja, '{anticipos}',
  ((corte_caja->'anticipos') - 'terminal')
    || jsonb_build_object('tarjeta', coalesce((corte_caja->'anticipos'->>'tarjeta')::numeric, 0) + coalesce((corte_caja->'anticipos'->>'terminal')::numeric, 0))
)
where jsonb_typeof(corte_caja->'anticipos') = 'object' and (corte_caja->'anticipos') ? 'terminal';

-- Revisión: todo debe salir en 0
select
  (select count(*) from ventas where metodo_pago = 'terminal') as ventas_terminal,
  (select count(*) from pedidos where metodo_pago = 'terminal' or metodo_entrega = 'terminal' or pagos::text like '%"terminal"%') as pedidos_terminal;
