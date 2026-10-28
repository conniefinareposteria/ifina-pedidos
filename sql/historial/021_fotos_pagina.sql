-- Connie Repostería Fina — Fotos de la página web (portada, Visítanos y galería de decorados)
-- Se puede correr varias veces sin riesgo.
-- Permite guardar en fotos_catalogo las fotos que no son de un producto: tabla = 'pagina'
-- y producto = 'portada' / 'visitanos' / 'galeria_decorados'.

alter table fotos_catalogo drop constraint if exists fotos_catalogo_tabla_check;
alter table fotos_catalogo add constraint fotos_catalogo_tabla_check
  check (tabla in ('sabores_pasteles','sabores_cupcakes','individuales','panques','decoraciones','pagina'));

-- Revisión: debe salir la regla con 'pagina' al final
select pg_get_constraintdef(oid) from pg_constraint where conname = 'fotos_catalogo_tabla_check';
