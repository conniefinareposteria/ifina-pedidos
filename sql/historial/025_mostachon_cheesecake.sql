-- Connie Repostería Fina — El mostachón pasa de Pasteles a Cheesecakes
-- Se puede correr varias veces sin riesgo.
-- En el sistema los cheesecakes son los sabores que empiezan con "cc_" (en pantalla no se ve el "cc_").
-- Se renombra también en las fotos y en la lista de ocultos para que no se pierdan.

update fotos_catalogo set producto = 'cc_' || producto
where tabla = 'sabores_pasteles' and translate(lower(producto),'áéíóú','aeiou') like '%mostachon%' and producto not ilike 'cc\_%';

update productos_ocultos set producto = 'cc_' || producto
where tabla = 'sabores_pasteles' and translate(lower(producto),'áéíóú','aeiou') like '%mostachon%' and producto not ilike 'cc\_%';

update sabores_pasteles set nombre = 'cc_' || nombre
where translate(lower(nombre),'áéíóú','aeiou') like '%mostachon%' and nombre not ilike 'cc\_%';

-- Revisión: debe salir el mostachón con "cc_" al principio
select nombre from sabores_pasteles where translate(lower(nombre),'áéíóú','aeiou') like '%mostachon%';
