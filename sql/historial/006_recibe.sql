-- Persona que recibe el pedido (cuando no es el mismo cliente)
alter table pedidos add column if not exists recibe_nombre text;
alter table pedidos add column if not exists recibe_telefono text;
