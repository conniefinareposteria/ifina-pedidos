-- Connie Repostería Fina — Encuadre de cada foto del catálogo
-- Se puede correr varias veces sin riesgo.
-- Desde Catálogo → "Encuadrar" se mueve y acerca la foto dentro del recuadro de la tarjeta.
-- pos_x / pos_y: punto de la foto que queda al centro del recuadro (0 a 100). zoom: 1 = sin acercar.
-- Vacío = como se ve hoy (centrada, sin acercar).

alter table fotos_catalogo add column if not exists pos_x numeric;
alter table fotos_catalogo add column if not exists pos_y numeric;
alter table fotos_catalogo add column if not exists zoom numeric;

-- Revisión: deben salir pos_x, pos_y y zoom
select column_name from information_schema.columns where table_name = 'fotos_catalogo' and column_name in ('pos_x','pos_y','zoom') order by column_name;
