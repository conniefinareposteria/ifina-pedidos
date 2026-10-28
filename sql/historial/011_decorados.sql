-- Connie Repostería Fina — Pasteles decorados en los pedidos
-- Se puede correr varias veces sin riesgo.
alter table pedidos add column if not exists decorado boolean default false;
alter table pedidos add column if not exists decorado_descripcion text;
