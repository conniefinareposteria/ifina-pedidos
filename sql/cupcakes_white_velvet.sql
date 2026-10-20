-- Connie Repostería Fina — Agregar cupcake White velvet al catálogo
-- (el orden de los cupcakes ya lo pone el sistema; esto solo agrega el sabor nuevo)
-- Se puede correr varias veces sin riesgo.
insert into sabores_cupcakes (nombre)
select 'White velvet'
where not exists (
  select 1 from sabores_cupcakes
  where regexp_replace(lower(nombre), '[^a-z]', '', 'g') = 'whitevelvet'
);

-- Revisión: lista de sabores de cupcake
select nombre from sabores_cupcakes order by nombre;
