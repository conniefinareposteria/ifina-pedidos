-- Connie Repostería Fina — Fotos del catálogo (las sube la directora desde el sistema)
-- Se puede correr varias veces sin riesgo.
--
-- Cada producto puede tener varias fotos. La primera (orden más bajo) es la principal.
-- Se guardan dos archivos por foto en el almacenamiento de Supabase (carpeta pública "catalogo"):
--   · la original, tal cual se tomó (respaldo, sin perder calidad)
--   · una copia en alta calidad para la página (hasta 2400 px, carga más rápido)

-- 1) Lista de fotos
create table if not exists fotos_catalogo (
  id bigint generated always as identity primary key,
  created_at timestamptz default now(),
  tabla text not null check (tabla in ('sabores_pasteles','sabores_cupcakes','individuales','panques','decoraciones')),
  producto text not null,          -- el "nombre" del producto en su tabla (ej. white_velvet)
  orden int not null default 0,    -- la más baja es la principal
  ruta text not null,              -- archivo para la página
  url text not null,
  ruta_original text,              -- archivo original
  url_original text
);
create index if not exists fotos_catalogo_producto on fotos_catalogo (tabla, producto, orden);

alter table fotos_catalogo enable row level security;
drop policy if exists "fotos ver publico" on fotos_catalogo;
drop policy if exists "fotos crear director" on fotos_catalogo;
drop policy if exists "fotos editar director" on fotos_catalogo;
drop policy if exists "fotos borrar director" on fotos_catalogo;
-- Cualquiera las ve (la página pública); solo la directora sube, ordena y borra
create policy "fotos ver publico" on fotos_catalogo for select to anon, authenticated using (true);
create policy "fotos crear director" on fotos_catalogo for insert to authenticated with check (
  exists (select 1 from perfiles where perfiles.user_id = auth.uid() and perfiles.rol = 'director'));
create policy "fotos editar director" on fotos_catalogo for update to authenticated using (
  exists (select 1 from perfiles where perfiles.user_id = auth.uid() and perfiles.rol = 'director'));
create policy "fotos borrar director" on fotos_catalogo for delete to authenticated using (
  exists (select 1 from perfiles where perfiles.user_id = auth.uid() and perfiles.rol = 'director'));

-- 2) Carpeta pública "catalogo" en el almacenamiento (solo imágenes, máximo 25 MB por archivo)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('catalogo', 'catalogo', true, 26214400, array['image/jpeg','image/png','image/webp','image/heic','image/heif'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "catalogo ver director" on storage.objects;
drop policy if exists "catalogo subir director" on storage.objects;
drop policy if exists "catalogo cambiar director" on storage.objects;
drop policy if exists "catalogo borrar director" on storage.objects;
-- Las fotos se ven por su liga pública; subir, cambiar y borrar archivos: solo la directora
create policy "catalogo ver director" on storage.objects for select to authenticated using (
  bucket_id = 'catalogo' and exists (select 1 from public.perfiles where user_id = auth.uid() and rol = 'director'));
create policy "catalogo subir director" on storage.objects for insert to authenticated with check (
  bucket_id = 'catalogo' and exists (select 1 from public.perfiles where user_id = auth.uid() and rol = 'director'));
create policy "catalogo cambiar director" on storage.objects for update to authenticated using (
  bucket_id = 'catalogo' and exists (select 1 from public.perfiles where user_id = auth.uid() and rol = 'director'));
create policy "catalogo borrar director" on storage.objects for delete to authenticated using (
  bucket_id = 'catalogo' and exists (select 1 from public.perfiles where user_id = auth.uid() and rol = 'director'));

-- Revisión: debe salir la carpeta "catalogo" como pública
select id, public, file_size_limit from storage.buckets where id = 'catalogo';
