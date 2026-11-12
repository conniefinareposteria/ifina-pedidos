-- Connie Repostería Fina — Finanzas: poder acomodar insumos y empaques en el orden que quieras (flechas ↑ ↓)
-- Se puede correr varias veces sin riesgo.
-- La primera vez los acomoda por el número del nombre (Caja 12, 14, 16 pulgadas) y luego por nombre.

alter table insumos add column if not exists orden int not null default 0;

update insumos i set orden = x.n
from (
  select id, row_number() over (partition by tipo, categoria, (base_id is null)
           order by coalesce(substring(nombre from '([0-9]+)')::int, 0), nombre) as n
  from insumos
) x
where i.id = x.id and not exists (select 1 from insumos where orden <> 0);

-- Revisión: las cajas deben salir 12, 14, 16
select nombre, orden from insumos where categoria in ('Caja','Base') order by categoria, orden;
