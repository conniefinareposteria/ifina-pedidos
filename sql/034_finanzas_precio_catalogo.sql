-- Connie Repostería Fina — Finanzas: el precio de venta sale del catálogo (no del Excel)
-- Se puede correr varias veces sin riesgo.
-- Cada producto de Finanzas apunta a su precio en el catálogo que ya usa el sistema:
--   'tamanos_pastel:chico', 'tamanos_pastel:cheesecake', 'individuales:galletas_coco', 'panques:panque_platano'…
-- Si cambias un precio en el catálogo, Finanzas lo toma solo. El precio a mano solo queda para lo que no está en el catálogo.

alter table fin_recetas add column if not exists precio_catalogo text;

-- Pasteles por tamaño → precio de ese tamaño
update fin_recetas f set precio_catalogo = 'tamanos_pastel:' || t.tamano
from tamanos_pastel t
where f.tipo = 'producto' and f.precio_catalogo is null and f.categoria = 'Pastel' and lower(t.tamano) = lower(f.tamano);

-- Cheesecakes → precio de cheesecake
update fin_recetas f set precio_catalogo = 'tamanos_pastel:' || t.tamano
from tamanos_pastel t
where f.tipo = 'producto' and f.precio_catalogo is null and f.categoria = 'Cheesecake' and lower(t.tamano) = 'cheesecake';

-- Revisión: cuáles quedaron ligados al catálogo y cuáles siguen con precio a mano
select coalesce(precio_catalogo, '(a mano)') precio_de, count(*) productos
from fin_recetas where tipo = 'producto' group by 1 order by 1;
