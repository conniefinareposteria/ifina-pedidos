-- ===== 044 Compras: un ticket puede tener varias fotos (ticket largo en 2 o más partes) =====
-- Se puede volver a correr sin riesgo.
alter table compras_tickets add column if not exists fotos text[] not null default '{}';
-- Los tickets que ya tenían una foto la pasan a la lista
update compras_tickets set fotos = array[foto] where foto is not null and fotos = '{}';
