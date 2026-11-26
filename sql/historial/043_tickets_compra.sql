-- ===== 043 Compras: tickets de compra (gastos) leídos con IA =====
-- Cada ticket se guarda con su foto, tienda, fecha, folio, forma de pago y total (es el registro de gastos).
-- Cada producto del ticket se liga a un insumo de Finanzas con lo que trae cada pieza, para tener
-- el historial de precios por mes. El sistema se acuerda de qué insumo es cada descripción del ticket.
-- Solo la directora. Se puede volver a correr sin riesgo.

create table if not exists compras_tickets (
  id bigint generated always as identity primary key,
  created_at timestamptz default now(),
  subido_por uuid default auth.uid() references auth.users(id),
  tienda_id bigint references compras_tiendas(id) on delete set null,
  tienda_nombre text,                      -- como viene en el ticket (por si la tienda se borra)
  fecha date not null,
  hora text,
  folio text,
  forma_pago text,
  total numeric not null check (total >= 0),
  foto text,                               -- ruta en el almacenamiento "tickets"
  lectura jsonb                            -- lo que leyó la IA, tal cual
);
create index if not exists compras_tickets_fecha on compras_tickets (fecha);

create table if not exists compras_ticket_items (
  id bigint generated always as identity primary key,
  ticket_id bigint not null references compras_tickets(id) on delete cascade,
  fecha date not null,                     -- la del ticket (para el historial de precios)
  descripcion text,
  cantidad numeric check (cantidad is null or cantidad > 0),
  importe numeric check (importe is null or importe >= 0),
  insumo_id bigint references insumos(id) on delete set null,     -- vacío = no es insumo
  contenido numeric check (contenido is null or contenido > 0)     -- lo que trae cada pieza, en g / ml / piezas
);
create index if not exists compras_ticket_items_insumo on compras_ticket_items (insumo_id, fecha);
create index if not exists compras_ticket_items_ticket on compras_ticket_items (ticket_id);

-- Memoria: "LECHERA 48/375GR" = Lechera, trae 18,000 g
create table if not exists compras_equivalencias (
  id bigint generated always as identity primary key,
  clave text not null unique,              -- descripción del ticket, normalizada
  insumo_id bigint references insumos(id) on delete cascade,      -- vacío = no es insumo
  contenido numeric check (contenido is null or contenido > 0)
);

alter table compras_tickets enable row level security;
alter table compras_ticket_items enable row level security;
alter table compras_equivalencias enable row level security;
drop policy if exists "compras tickets directora" on compras_tickets;
drop policy if exists "compras ticket items directora" on compras_ticket_items;
drop policy if exists "compras equivalencias directora" on compras_equivalencias;
create policy "compras tickets directora" on compras_tickets for all to authenticated
  using (exists (select 1 from perfiles where user_id = auth.uid() and rol = 'director'))
  with check (exists (select 1 from perfiles where user_id = auth.uid() and rol = 'director'));
create policy "compras ticket items directora" on compras_ticket_items for all to authenticated
  using (exists (select 1 from perfiles where user_id = auth.uid() and rol = 'director'))
  with check (exists (select 1 from perfiles where user_id = auth.uid() and rol = 'director'));
create policy "compras equivalencias directora" on compras_equivalencias for all to authenticated
  using (exists (select 1 from perfiles where user_id = auth.uid() and rol = 'director'))
  with check (exists (select 1 from perfiles where user_id = auth.uid() and rol = 'director'));

-- Carpeta privada "tickets" para las fotos (solo la directora las ve)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tickets', 'tickets', false, 15728640, array['image/jpeg','image/png','application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "tickets ver director" on storage.objects;
drop policy if exists "tickets subir director" on storage.objects;
drop policy if exists "tickets borrar director" on storage.objects;
create policy "tickets ver director" on storage.objects for select to authenticated using (
  bucket_id = 'tickets' and exists (select 1 from public.perfiles where user_id = auth.uid() and rol = 'director'));
create policy "tickets subir director" on storage.objects for insert to authenticated with check (
  bucket_id = 'tickets' and exists (select 1 from public.perfiles where user_id = auth.uid() and rol = 'director'));
create policy "tickets borrar director" on storage.objects for delete to authenticated using (
  bucket_id = 'tickets' and exists (select 1 from public.perfiles where user_id = auth.uid() and rol = 'director'));
