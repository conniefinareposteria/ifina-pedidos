-- Connie Repostería Fina — Varios productos en un mismo pedido
-- Se puede correr varias veces sin riesgo.
-- Al agendar se pueden agregar varios productos; cada uno se guarda como un pedido aparte
-- y quedan ligados con el mismo "grupo" (Pedido 1 de 3, 2 de 3…).

alter table pedidos add column if not exists grupo text;          -- mismo valor en los pedidos que se agendaron juntos
alter table pedidos add column if not exists grupo_parte int;     -- 1, 2, 3…
alter table pedidos add column if not exists grupo_total int;     -- cuántos son en total
create index if not exists pedidos_grupo on pedidos (grupo) where grupo is not null;

-- Revisión: deben salir las 3 columnas nuevas
select column_name from information_schema.columns where table_name = 'pedidos' and column_name like 'grupo%' order by column_name;
