-- Connie Repostería Fina — Relleno a elegir (ej. Vintage: mermelada de fresa o cajeta)
-- Se puede correr varias veces sin riesgo.
-- Si un pastel tiene opciones de relleno, en la página el cliente elige una.

alter table sabores_pasteles add column if not exists relleno_opciones jsonb;   -- ["Mermelada de fresa","Cajeta"]

-- La función de guardar agrega las opciones de relleno: se quita la anterior para que no haya dos
drop function if exists catalogo_guardar_producto(text,text,text,text,text,text,boolean,text);
create or replace function catalogo_guardar_producto(
  p_tabla text, p_nombre text, p_pan text, p_relleno text, p_betun text, p_descripcion text,
  p_incluye_corona boolean default null, p_betun_abajo text default null, p_relleno_opciones jsonb default null)
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
  if p_tabla = 'sabores_pasteles' then
    update sabores_pasteles set betun_abajo = nullif(trim(p_betun_abajo),''),
      relleno_opciones = case when jsonb_typeof(p_relleno_opciones) = 'array' and jsonb_array_length(p_relleno_opciones) >= 2 then p_relleno_opciones else null end
    where nombre = p_nombre;
    if p_incluye_corona is not null then
      update sabores_pasteles set incluye_corona = p_incluye_corona where nombre = p_nombre;
    end if;
  end if;
end $$;
revoke all on function catalogo_guardar_producto(text,text,text,text,text,text,boolean,text,jsonb) from public, anon;
grant execute on function catalogo_guardar_producto(text,text,text,text,text,text,boolean,text,jsonb) to authenticated;

-- Revisión: debe salir relleno_opciones
select column_name from information_schema.columns where table_name = 'sabores_pasteles' and column_name = 'relleno_opciones';
