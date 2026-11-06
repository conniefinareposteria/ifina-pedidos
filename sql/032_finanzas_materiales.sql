-- Connie Repostería Fina — Finanzas › Costeo: empaques y desechables (velas, capacillos, cajas…)
-- Se puede correr varias veces sin riesgo.
-- Se guardan en la misma tabla de insumos (con su historial de precios), separados por "tipo".
-- También agrega la unidad kilos (kg).

alter table insumos add column if not exists tipo text not null default 'insumo';
alter table insumos drop constraint if exists insumos_tipo_check;
alter table insumos add constraint insumos_tipo_check check (tipo in ('insumo','material'));

-- Unidades: g, kg, ml, piezas
alter table insumos drop constraint if exists insumos_unidad_check;
alter table insumos add constraint insumos_unidad_check check (unidad in ('g','kg','ml','pza'));

-- El historial solo guarda precios completos (cantidad y precio llenos), no los pasos a medias al escribir
create or replace function insumos_guardar_historial() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.cantidad is not null and new.precio is not null
     and (tg_op = 'INSERT' or new.cantidad is distinct from old.cantidad or new.precio is distinct from old.precio or new.unidad is distinct from old.unidad) then
    insert into insumos_historial (insumo_id, cantidad, unidad, precio) values (new.id, new.cantidad, new.unidad, new.precio);
  end if;
  return new;
end $$;

-- Revisión: debe salir la columna tipo
select column_name, column_default from information_schema.columns where table_name = 'insumos' and column_name = 'tipo';
