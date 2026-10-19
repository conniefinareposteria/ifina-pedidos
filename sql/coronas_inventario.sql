-- Connie Repostería Fina — Inventario de coronas y meta general de coronas
-- Se puede correr completo varias veces sin riesgo.

-- 1) Coronas en Productos del día (mini y normal)
alter table cierres_dia add column if not exists coronas jsonb default '{}'::jsonb;
alter table cierres_dia add column if not exists coronas_listo boolean default false;

-- 2) Meta general de coronas (se guarda en la fila 7 de metas, no depende del día)
alter table metas_produccion add column if not exists coronas jsonb not null default '{}'::jsonb;
alter table metas_produccion drop constraint if exists metas_produccion_dia_check;
alter table metas_produccion add constraint metas_produccion_dia_check check (dia between 0 and 7);
