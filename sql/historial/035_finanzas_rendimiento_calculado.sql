-- Connie Repostería Fina — Finanzas: lo que rinde una subreceta en gramos se CALCULA (ya no es un número fijo)
-- Se puede correr varias veces sin riesgo (solo toca las subrecetas que todavía tienen el rendimiento fijo del Excel).
--
-- Antes (Excel): "rinde 600 g" escrito a mano. Si cambiabas un ingrediente, el rendimiento no se movía
-- (por eso la mezcla de chocolate decía 600 g cuando entran 1,297 g).
-- Ahora: rinde = suma de lo que entra (g y ml) × (1 − merma). La merma es lo que se pierde al cocinar o al batir.
-- Para no cambiar ningún costo que sí estaba bien, la merma de cada subreceta se ajusta a lo que el Excel ya perdía.
-- Las dos que estaban mal se corrigen:
--   · Mezcla de pan de chocolate: rendía 46% (imposible para una masa cruda) → merma 5%, como la de vainilla.
--   · Caramelo chicloso: rendía 126% (más de lo que entra, imposible) → merma 20%, como los otros caramelos.
-- Las subrecetas por pieza (panes por tamaño, coronas, cheesecake…) siguen con "cuántas piezas salen" a mano: eso sí es un dato.

with entra as (
  select r.id, r.nombre, r.rendimiento, r.merma,
         sum(p.cantidad) filter (where (i.id is not null and i.unidad in ('g','kg','ml')) or (s.id is not null and s.unidad = 'g')) as gramos
  from fin_recetas r
  join fin_receta_partes p on p.receta_id = r.id
  left join insumos i on i.id = p.insumo_id
  left join fin_recetas s on s.id = p.subreceta_id
  where r.tipo = 'subreceta' and r.unidad = 'g' and r.rendimiento is not null
  group by r.id
)
update fin_recetas f set
  merma = case
    when e.nombre = 'Mezcla de pan de chocolate' and e.rendimiento / e.gramos < 0.7 then 0.05
    when e.nombre = 'Caramelo chicloso' and e.rendimiento / e.gramos > 1 then 0.20
    when e.rendimiento / e.gramos between 0.5 and 1 then round(1 - e.rendimiento * (1 - e.merma) / e.gramos, 3)
    else f.merma end,
  rendimiento = null,
  updated_at = now()
from entra e
where f.id = e.id and e.gramos > 0;

-- Revisión: merma de cada subreceta en gramos (el rendimiento ya sale calculado en el sistema)
select nombre, round(merma * 100, 1) as merma_pct, rendimiento from fin_recetas
where tipo = 'subreceta' and unidad = 'g' order by nombre;
