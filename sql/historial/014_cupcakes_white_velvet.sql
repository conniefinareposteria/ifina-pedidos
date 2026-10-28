-- Connie Repostería Fina — Agregar cupcakes White velvet y Cajeta al catálogo
-- (el orden de los cupcakes lo pone el sistema). Se puede correr varias veces sin riesgo.
insert into sabores_cupcakes (nombre)
select v.nombre from (values ('White velvet'), ('Cajeta')) as v(nombre)
where not exists (
  select 1 from sabores_cupcakes s
  where regexp_replace(lower(s.nombre), '[^a-z]', '', 'g') = regexp_replace(lower(v.nombre), '[^a-z]', '', 'g')
);

-- Revisión: lista de sabores de cupcake
select nombre from sabores_cupcakes order by nombre;
