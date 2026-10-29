-- Connie Repostería Fina — Catálogo: descripción, incluye corona y personas por tamaño
-- Se puede correr varias veces sin riesgo.

-- 1) De qué está hecho cada producto (se llena desde el sistema: Catálogo)
alter table sabores_pasteles add column if not exists pan text;
alter table sabores_pasteles add column if not exists relleno text;
alter table sabores_pasteles add column if not exists betun text;
alter table sabores_cupcakes add column if not exists pan text;
alter table sabores_cupcakes add column if not exists relleno text;
alter table sabores_cupcakes add column if not exists betun text;
alter table sabores_cupcakes add column if not exists descripcion text;
alter table individuales     add column if not exists pan text;
alter table individuales     add column if not exists relleno text;
alter table individuales     add column if not exists betun text;
alter table individuales     add column if not exists descripcion text;
alter table panques          add column if not exists pan text;
alter table panques          add column if not exists relleno text;
alter table panques          add column if not exists betun text;
alter table panques          add column if not exists descripcion text;

-- 2) Guardar desde el sistema: solo la directora. Los precios NO se cambian aquí.
--    p_incluye_corona solo aplica a pasteles (en otras tablas se ignora).
create or replace function catalogo_guardar_producto(
  p_tabla text, p_nombre text, p_pan text, p_relleno text, p_betun text, p_descripcion text, p_incluye_corona boolean default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from perfiles where user_id = auth.uid() and rol = 'director') then
    raise exception 'Solo la directora puede cambiar el catálogo';
  end if;
  if p_tabla not in ('sabores_pasteles','sabores_cupcakes','individuales','panques') then
    raise exception 'Tabla no permitida: %', p_tabla;
  end if;
  execute format('update %I set pan = $1, relleno = $2, betun = $3, descripcion = $4 where nombre = $5', p_tabla)
    using nullif(trim(p_pan),''), nullif(trim(p_relleno),''), nullif(trim(p_betun),''), nullif(trim(p_descripcion),''), p_nombre;
  if p_tabla = 'sabores_pasteles' and p_incluye_corona is not null then
    update sabores_pasteles set incluye_corona = p_incluye_corona where nombre = p_nombre;
  end if;
end $$;
revoke all on function catalogo_guardar_producto(text,text,text,text,text,text,boolean) from public, anon;
grant execute on function catalogo_guardar_producto(text,text,text,text,text,text,boolean) to authenticated;

-- 3) Pasteles que incluyen corona (los de merengue). Los demás, no. Después se controla desde Catálogo.
update sabores_pasteles
set incluye_corona = regexp_replace(lower(nombre),'[^a-z]','','g') in ('whitevelvet','bicajeta','pistache','marmoleado','zanahoria','bichocolate');

-- 4) Personas por tamaño (según la lista de precios)
update tamanos_pastel set personas = 8 where regexp_replace(lower(tamano),'[^a-z0-9]','','g') = 'mini';

-- Revisión: 1) qué pasteles quedaron con corona incluida  2) personas por tamaño
select nombre, incluye_corona from sabores_pasteles order by incluye_corona desc, nombre;
select tamano, personas, precio from tamanos_pastel order by precio;
