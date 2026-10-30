-- Connie Repostería Fina — Pasteles: betún "Por encima" y "Por debajo"
-- Se puede correr varias veces sin riesgo.
-- En pasteles, "Betún" pasa a llamarse "Por encima" (se queda lo que ya tenían) y se agrega "Por debajo"
-- (ej. Bi Cajeta: por encima merengue, por debajo cajeta).

alter table sabores_pasteles add column if not exists betun_abajo text;

-- La función de guardar cambia (agrega "por debajo"): se quita la anterior para que no haya dos
drop function if exists catalogo_guardar_producto(text,text,text,text,text,text,boolean);
create or replace function catalogo_guardar_producto(
  p_tabla text, p_nombre text, p_pan text, p_relleno text, p_betun text, p_descripcion text,
  p_incluye_corona boolean default null, p_betun_abajo text default null)
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
    update sabores_pasteles set betun_abajo = nullif(trim(p_betun_abajo),'') where nombre = p_nombre;
    if p_incluye_corona is not null then
      update sabores_pasteles set incluye_corona = p_incluye_corona where nombre = p_nombre;
    end if;
  end if;
end $$;
revoke all on function catalogo_guardar_producto(text,text,text,text,text,text,boolean,text) from public, anon;
grant execute on function catalogo_guardar_producto(text,text,text,text,text,text,boolean,text) to authenticated;

-- Revisión: debe salir betun_abajo
select column_name from information_schema.columns where table_name = 'sabores_pasteles' and column_name = 'betun_abajo';
