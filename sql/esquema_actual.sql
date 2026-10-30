-- =====================================================================
-- Connie Repostería Fina — ESQUEMA ACTUAL DE LA BASE DE DATOS (referencia)
-- =====================================================================
-- Qué es: la "foto" de cómo está la base de datos hoy, juntando en orden todo lo que
-- se ha corrido desde sql/historial/. Sirve para saber qué tablas, columnas, permisos
-- y funciones existen sin tener que leer todos los archivos.
--
-- NO hay que correrlo en la base actual: ya está aplicado. Está escrito para que, si
-- algún día se necesita armar la base desde cero (otro proyecto de Supabase, un segundo
-- local, pruebas), sí se pueda correr completo sin errores.
--
-- Cómo se mantiene: cada cambio nuevo va en un archivo numerado en sql/ (ver sql/README.md)
-- y además se actualiza este archivo para que siempre refleje el estado real.
-- Última actualización: 2026-10-28. Verificado: armar la base desde cero con este archivo da el mismo
-- resultado (tablas, columnas, permisos y funciones) que correr todo sql/historial/ en orden.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1) PERFILES Y ROLES
-- ---------------------------------------------------------------------
-- director = directora (ve y edita todo) · colaborador = tablet del local · produccion = solo ver
create table if not exists perfiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  rol text not null default 'colaborador'
);
alter table perfiles drop constraint if exists rol_valido;
alter table perfiles add constraint rol_valido check (rol in ('director','colaborador','produccion'));
alter table perfiles enable row level security;
drop policy if exists "ver propio perfil" on perfiles;
create policy "ver propio perfil" on perfiles for select to authenticated using (auth.uid() = user_id);
-- Los usuarios se crean en Authentication → Users y su rol se da así (ejemplo):
-- insert into perfiles (user_id, rol) select id, 'colaborador' from auth.users where email = 'correo@conniereposteria.com'
-- on conflict (user_id) do update set rol = excluded.rol;


-- ---------------------------------------------------------------------
-- 2) CATÁLOGOS (precios y productos: se cambian aquí, nunca en el código)
-- ---------------------------------------------------------------------
create table if not exists tamanos_pastel (
  id bigint generated always as identity primary key,
  created_at timestamptz default now(),
  tamano text not null,
  precio numeric not null default 0
);
alter table tamanos_pastel add column if not exists personas int;          -- para la página pública

create table if not exists sabores_pasteles (
  id bigint generated always as identity primary key,
  created_at timestamptz default now(),
  nombre text not null                                                       -- ej. white_velvet, cc_frutos_rojos
);
alter table sabores_pasteles add column if not exists incluye_corona boolean default false;
alter table sabores_pasteles add column if not exists foto_url text;
alter table sabores_pasteles add column if not exists descripcion text;

create table if not exists sabores_cupcakes (
  id bigint generated always as identity primary key,
  created_at timestamptz default now(),
  nombre text not null
);
alter table sabores_cupcakes add column if not exists foto_url text;

-- Cuchareables / individuales. Incluye un renglón "cupcake" = precio unitario del cupcake.
create table if not exists individuales (
  id bigint generated always as identity primary key,
  created_at timestamptz default now(),
  nombre text not null,
  precio numeric not null default 0
);
alter table individuales add column if not exists foto_url text;

create table if not exists panques (
  id bigint generated always as identity primary key,
  nombre text not null unique,
  precio numeric not null
);
alter table panques add column if not exists foto_url text;

create table if not exists coronas (
  id bigint generated always as identity primary key,
  tipo text not null,      -- 'ambar' o 'color'
  tamano text not null,    -- 'mini' o 'normal'
  precio numeric not null,
  unique (tipo, tamano)
);

create table if not exists decoraciones (            -- lista "Hazlo especial" de la página pública
  id bigint generated always as identity primary key,
  nombre text not null unique,
  precio numeric,                                  -- vacío = "Cotizar"
  orden int default 99,
  foto_url text
);

-- Los catálogos los puede LEER cualquiera (también la página pública sin sesión). Nadie los escribe desde el sistema.
alter table tamanos_pastel   enable row level security;
alter table sabores_pasteles enable row level security;
alter table sabores_cupcakes enable row level security;
alter table individuales     enable row level security;
alter table panques          enable row level security;
alter table coronas          enable row level security;
alter table decoraciones     enable row level security;
drop policy if exists "publico lee tamanos"      on tamanos_pastel;
drop policy if exists "publico lee sabores_p"    on sabores_pasteles;
drop policy if exists "publico lee sabores_c"    on sabores_cupcakes;
drop policy if exists "publico lee individuales" on individuales;
drop policy if exists "publico lee panques"      on panques;
drop policy if exists "publico lee coronas"      on coronas;
drop policy if exists "publico lee decoraciones" on decoraciones;
create policy "publico lee tamanos"      on tamanos_pastel   for select to anon, authenticated using (true);
create policy "publico lee sabores_p"    on sabores_pasteles for select to anon, authenticated using (true);
create policy "publico lee sabores_c"    on sabores_cupcakes for select to anon, authenticated using (true);
create policy "publico lee individuales" on individuales     for select to anon, authenticated using (true);
create policy "publico lee panques"      on panques          for select to anon, authenticated using (true);
create policy "publico lee coronas"      on coronas          for select to anon, authenticated using (true);
create policy "publico lee decoraciones" on decoraciones     for select to anon, authenticated using (true);
-- (En la base actual también existen políticas viejas de solo lectura para usuarios con sesión:
--  "catalogo lectura tamanos/sabores_p/sabores_c/individuales/panques/coronas". Son redundantes, no estorban.)


-- ---------------------------------------------------------------------
-- 3) CLIENTES
-- ---------------------------------------------------------------------
create table if not exists clientes (
  id bigint generated always as identity primary key,
  created_at timestamptz default now(),
  nombre text not null,
  apellido text,
  telefono text,
  calle text,
  numero_exterior text,
  numero_interior text,
  colonia text,
  codigo_postal text,
  ciudad text,
  referencias text
);
alter table clientes add column if not exists apellido text;
alter table clientes enable row level security;
drop policy if exists "clientes ver" on clientes;
drop policy if exists "clientes insertar" on clientes;
drop policy if exists "clientes editar director" on clientes;
create policy "clientes ver" on clientes for select to authenticated using (true);
create policy "clientes insertar" on clientes for insert to authenticated with check (true);
create policy "clientes editar director" on clientes for update to authenticated using (
  exists (select 1 from perfiles where perfiles.user_id = auth.uid() and perfiles.rol = 'director'));


-- ---------------------------------------------------------------------
-- 4) PEDIDOS (agendados)
-- ---------------------------------------------------------------------
create table if not exists pedidos (
  id bigint generated always as identity primary key,
  created_at timestamptz default now(),
  nombre_cliente text,
  telefono text,
  categoria text,                 -- pastel | cupcake | individual | panque
  tamano_o_sabor text,            -- tamaño del pastel
  sabor text,                     -- sabor del pastel, o el detalle del carrito (ej. "6 Pistache, 6 Chocolate")
  precio numeric,                 -- total del pedido
  fecha_entrega timestamptz,
  anticipo numeric,               -- lo que dejó al agendar
  metodo_pago text,               -- método del anticipo: efectivo | transferencia | tarjeta
  notas text,
  entrega text,                   -- local | casa | domicilio
  direccion text
);
alter table pedidos add column if not exists cliente_id bigint references clientes(id);
alter table pedidos add column if not exists direccion_detalle jsonb;
alter table pedidos add column if not exists recibe_nombre text;            -- quién recibe (si no es el cliente)
alter table pedidos add column if not exists recibe_telefono text;
alter table pedidos add column if not exists corona_tipo text;              -- incluida | ambar | color | (vacío = sin corona)
alter table pedidos add column if not exists corona_tamano text;            -- mini | normal
alter table pedidos add column if not exists corona_color text;
alter table pedidos add column if not exists corona_precio numeric;
alter table pedidos add column if not exists decorado boolean default false;
alter table pedidos add column if not exists decorado_descripcion text;
alter table pedidos add column if not exists pagos jsonb not null default '[]'::jsonb;   -- pagos posteriores [{monto, metodo, fecha, origen, tipo}]
alter table pedidos add column if not exists pago_entrega numeric default 0;            -- lo cobrado en el punto de venta
alter table pedidos add column if not exists metodo_entrega text;
alter table pedidos add column if not exists descuento_entrega numeric default 0;
alter table pedidos add column if not exists entregado boolean default false;
alter table pedidos add column if not exists entregado_at timestamptz;
-- Lo pagado de un pedido = anticipo + pago_entrega + descuento_entrega + suma(pagos)
-- Métodos de pago guardados: efectivo | transferencia | tarjeta | mixto (pago diferido). Los viejos 'terminal' ya se cambiaron a 'tarjeta'.

alter table pedidos enable row level security;
drop policy if exists "pedidos insertar" on pedidos;
drop policy if exists "pedidos ver director" on pedidos;
drop policy if exists "pedidos ver produccion" on pedidos;
drop policy if exists "pedidos editar director" on pedidos;
drop policy if exists "pedidos borrar director" on pedidos;
-- Cualquiera con sesión CAPTURA pedidos; solo directora y producción los VEN; solo la directora edita y borra.
-- El colaborador ve los de hoy y los busca solo a través de funciones (pedidos_entrega_hoy, buscar_pedidos_pos).
create policy "pedidos insertar" on pedidos for insert to authenticated with check (true);
create policy "pedidos ver director" on pedidos for select to authenticated using (
  exists (select 1 from perfiles where perfiles.user_id = auth.uid() and perfiles.rol = 'director'));
create policy "pedidos ver produccion" on pedidos for select to authenticated using (
  exists (select 1 from perfiles where perfiles.user_id = auth.uid() and perfiles.rol = 'produccion'));
create policy "pedidos editar director" on pedidos for update to authenticated using (
  exists (select 1 from perfiles where perfiles.user_id = auth.uid() and perfiles.rol = 'director'));
create policy "pedidos borrar director" on pedidos for delete to authenticated using (
  exists (select 1 from perfiles where perfiles.user_id = auth.uid() and perfiles.rol = 'director'));

-- Papelera: cada pedido borrado se guarda aquí automáticamente y se puede recuperar
create table if not exists pedidos_eliminados (
  id bigint generated always as identity primary key,
  eliminado_at timestamptz default now(),
  eliminado_por uuid,
  pedido jsonb not null
);
alter table pedidos_eliminados enable row level security;
drop policy if exists "eliminados ver director" on pedidos_eliminados;
create policy "eliminados ver director" on pedidos_eliminados for select to authenticated using (
  exists (select 1 from perfiles where perfiles.user_id = auth.uid() and perfiles.rol = 'director'));

create or replace function guardar_pedido_eliminado() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into pedidos_eliminados (eliminado_por, pedido) values (auth.uid(), to_jsonb(old));
  return old;
end $$;

drop trigger if exists trg_pedido_eliminado on pedidos;
create trigger trg_pedido_eliminado before delete on pedidos
  for each row execute function guardar_pedido_eliminado();

create or replace function recuperar_pedido(eliminado_id bigint) returns void
language plpgsql security definer set search_path = public as $$
declare r jsonb;
begin
  if not exists (select 1 from perfiles where user_id = auth.uid() and rol = 'director') then
    raise exception 'Solo la directora puede recuperar pedidos';
  end if;
  select pedido into r from pedidos_eliminados where id = eliminado_id;
  if r is null then raise exception 'No se encontró el pedido eliminado'; end if;
  insert into pedidos overriding system value
    select * from jsonb_populate_record(null::pedidos, r);
  delete from pedidos_eliminados where id = eliminado_id;
end $$;
revoke execute on function recuperar_pedido(bigint) from public, anon;
grant execute on function recuperar_pedido(bigint) to authenticated;


-- ---------------------------------------------------------------------
-- 5) SOLICITUDES (pedidos que llegan desde la página pública)
-- ---------------------------------------------------------------------
create table if not exists solicitudes (
  id bigint generated always as identity primary key,
  created_at timestamptz default now(),
  nombre text not null check (char_length(nombre) <= 80),
  telefono text not null check (char_length(telefono) <= 20),
  fecha_deseada date,
  entrega text,
  direccion text check (char_length(direccion) <= 300),
  comentarios text check (char_length(comentarios) <= 500),
  items jsonb not null,
  total numeric,
  estado text not null default 'nueva'
);
alter table solicitudes enable row level security;
drop policy if exists "publico crea solicitudes"   on solicitudes;
drop policy if exists "director ve solicitudes"    on solicitudes;
drop policy if exists "director edita solicitudes" on solicitudes;
create policy "publico crea solicitudes" on solicitudes for insert to anon, authenticated with check (estado = 'nueva');
create policy "director ve solicitudes" on solicitudes for select to authenticated using (
  exists (select 1 from perfiles where perfiles.user_id = auth.uid() and perfiles.rol = 'director'));
create policy "director edita solicitudes" on solicitudes for update to authenticated using (
  exists (select 1 from perfiles where perfiles.user_id = auth.uid() and perfiles.rol = 'director'));


-- ---------------------------------------------------------------------
-- 6) PRODUCTOS DEL DÍA (inventario y corte de caja, un renglón por día)
-- ---------------------------------------------------------------------
create table if not exists cierres_dia (
  id bigint generated always as identity primary key,
  created_at timestamptz default now(),
  fecha date not null unique,
  abierto_por uuid references auth.users(id),
  cupcakes jsonb default '{}'::jsonb,       -- {"Limón": {exis, in, vendidos, cierre, merma, cortesia}}
  individuales jsonb default '{}'::jsonb,   -- cuchareables, mismo formato
  pasteles jsonb default '{}'::jsonb,       -- {"White velvet": {mini:{...}, chico:{...}}}
  corte_caja jsonb default '{}'::jsonb,     -- version 2: denominaciones, ventas por método, fondo, gastos, anticipos
  cupcakes_listo boolean default false,
  individuales_listo boolean default false,
  pasteles_listo boolean default false,
  caja_listo boolean default false,
  cerrado boolean default false,
  cerrado_at timestamptz
);
alter table cierres_dia add column if not exists panques jsonb default '{}'::jsonb;
alter table cierres_dia add column if not exists panques_listo boolean default false;
alter table cierres_dia add column if not exists coronas jsonb default '{}'::jsonb;   -- {"Mini": {...}, "Normal": {...}}
alter table cierres_dia add column if not exists coronas_listo boolean default false;
alter table cierres_dia enable row level security;
drop policy if exists "cierres_dia acceso" on cierres_dia;
create policy "cierres_dia acceso" on cierres_dia for all to authenticated using (true) with check (true);

-- Metas de producción: fila por día (2 = martes … 6 = sábado) y fila 7 = metas generales (coronas)
create table if not exists metas_produccion (
  dia int primary key,
  pasteles jsonb not null default '{}'::jsonb,
  cupcakes jsonb not null default '{}'::jsonb,
  updated_at timestamptz default now()
);
alter table metas_produccion add column if not exists coronas jsonb not null default '{}'::jsonb;
alter table metas_produccion drop constraint if exists metas_produccion_dia_check;
alter table metas_produccion add constraint metas_produccion_dia_check check (dia between 0 and 7);
alter table metas_produccion enable row level security;
drop policy if exists "metas ver" on metas_produccion;
drop policy if exists "metas crear director" on metas_produccion;
drop policy if exists "metas editar director" on metas_produccion;
create policy "metas ver" on metas_produccion for select to authenticated using (
  exists (select 1 from perfiles where perfiles.user_id = auth.uid()));
create policy "metas crear director" on metas_produccion for insert to authenticated with check (
  exists (select 1 from perfiles where perfiles.user_id = auth.uid() and perfiles.rol = 'director'));
create policy "metas editar director" on metas_produccion for update to authenticated using (
  exists (select 1 from perfiles where perfiles.user_id = auth.uid() and perfiles.rol = 'director'));


-- ---------------------------------------------------------------------
-- 7) VENTAS DEL PUNTO DE VENTA (un renglón por ticket / folio)
-- ---------------------------------------------------------------------
create table if not exists ventas (
  id bigint generated always as identity primary key,       -- = folio del ticket
  created_at timestamptz default now(),
  fecha date not null,
  vendedor uuid default auth.uid(),
  items jsonb not null,           -- [{tipo:'local', cat, clave, tam, nombre, precio, cantidad, cortesia?, merma?} | {tipo:'pedido', pedido_id, cobrado, anticipo, entregar}]
  subtotal numeric not null default 0,
  descuento numeric not null default 0,
  total numeric not null default 0,
  monto_local numeric not null default 0,
  monto_pedidos numeric not null default 0,
  metodo_pago text
);
alter table ventas add column if not exists pagos jsonb;                       -- pago diferido: [{metodo, monto}]
alter table ventas add column if not exists editado_at timestamptz;
alter table ventas add column if not exists ediciones jsonb default '[]'::jsonb;  -- cómo estaba el ticket antes de cada edición
alter table ventas drop constraint if exists ventas_metodo_pago_check;
alter table ventas add constraint ventas_metodo_pago_check
  check (metodo_pago in ('efectivo','transferencia','tarjeta','terminal','mixto'));
alter table ventas enable row level security;
drop policy if exists "ventas ver" on ventas;
create policy "ventas ver" on ventas for select to authenticated using (true);
-- No hay insert/update directos: las ventas solo se crean con registrar_venta y se editan con editar_venta.


-- ---------------------------------------------------------------------
-- 8) FUNCIONES (todas revisan que quien llama tenga perfil)
-- ---------------------------------------------------------------------
create or replace function pedidos_entrega_hoy(desde timestamptz, hasta timestamptz)
returns setof pedidos language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from perfiles where user_id = auth.uid()) then
    raise exception 'Sin permiso';
  end if;
  if hasta - desde > interval '2 days' then
    raise exception 'Rango no permitido';
  end if;
  return query
    select * from pedidos
    where fecha_entrega >= desde and fecha_entrega < hasta
      and coalesce(entrega, 'recoger') in ('recoger', 'local')
    order by fecha_entrega;
end $$;
revoke execute on function pedidos_entrega_hoy(timestamptz, timestamptz) from public, anon;
grant execute on function pedidos_entrega_hoy(timestamptz, timestamptz) to authenticated;

create or replace function buscar_pedidos_pos(q text)
returns setof pedidos language plpgsql security definer set search_path = public as $$
declare t text := '%' || replace(replace(trim(coalesce(q,'')), '%', ''), '_', '') || '%';
begin
  if not exists (select 1 from perfiles where user_id = auth.uid()) then raise exception 'Sin permiso'; end if;
  if length(trim(coalesce(q,''))) < 2 then return; end if;
  return query
    select * from pedidos
    where coalesce(entregado, false) = false
      and (nombre_cliente ilike t or telefono ilike t)
    order by fecha_entrega
    limit 30;
end $$;
revoke execute on function buscar_pedidos_pos(text) from public, anon;
grant execute on function buscar_pedidos_pos(text) to authenticated;

create or replace function anticipos_del_dia(desde timestamptz, hasta timestamptz)
returns table (metodo text, monto numeric) language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from perfiles where user_id = auth.uid()) then raise exception 'Sin permiso'; end if;
  if hasta - desde > interval '2 days' then raise exception 'Rango no permitido'; end if;
  return query
    select p.metodo_pago, sum(coalesce(p.anticipo,0))
    from pedidos p
    where p.created_at >= desde and p.created_at < hasta and coalesce(p.anticipo,0) > 0
    group by p.metodo_pago;
end $$;
revoke execute on function anticipos_del_dia(timestamptz, timestamptz) from public, anon;
grant execute on function anticipos_del_dia(timestamptz, timestamptz) to authenticated;

-- Cobrar en el punto de venta (local, pedidos, anticipos, merma, cortesía, pago diferido)
drop function if exists registrar_venta(date, jsonb, numeric, numeric, numeric, numeric, text);
create or replace function registrar_venta(
  p_fecha date, p_items jsonb, p_subtotal numeric, p_descuento numeric,
  p_total numeric, p_monto_local numeric, p_metodo text, p_pagos jsonb default null)
returns bigint language plpgsql security definer set search_path = public as $$
declare
  it jsonb; v_id bigint; v_ped pedidos%rowtype; v_cobrado numeric; v_falta numeric; v_entregar boolean; v_pagos numeric; v_anticipo boolean;
  v_suma numeric;
begin
  if not exists (select 1 from perfiles where user_id = auth.uid()) then
    raise exception 'Sin permiso';
  end if;
  if p_total > 0 and p_metodo is null then
    raise exception 'Falta el método de pago';
  end if;
  if p_metodo = 'mixto' then
    if p_pagos is null or jsonb_typeof(p_pagos) <> 'array' or jsonb_array_length(p_pagos) < 2 then
      raise exception 'Faltan los montos del pago diferido';
    end if;
    select coalesce(sum((x->>'monto')::numeric), 0) into v_suma from jsonb_array_elements(p_pagos) x;
    if abs(v_suma - p_total) > 0.01 then raise exception 'Los montos del pago diferido no suman el total'; end if;
  end if;
  for it in select * from jsonb_array_elements(p_items) loop
    if it->>'tipo' = 'pedido' then
      select * into v_ped from pedidos where id = (it->>'pedido_id')::bigint for update;
      if not found then raise exception 'El pedido ya no existe'; end if;
      if v_ped.entregado then raise exception 'El pedido de % ya estaba entregado', v_ped.nombre_cliente; end if;
      v_cobrado := coalesce((it->>'cobrado')::numeric, 0);
      v_anticipo := coalesce((it->>'anticipo')::boolean, false);
      v_entregar := coalesce((it->>'entregar')::boolean, true);
      if v_anticipo then
        update pedidos set
          pagos = coalesce(pagos, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
            'monto', v_cobrado, 'metodo', p_metodo, 'fecha', now(), 'origen', 'punto de venta', 'tipo', 'anticipo'))
        where id = v_ped.id;
      else
        select coalesce(sum((x->>'monto')::numeric), 0) into v_pagos from jsonb_array_elements(coalesce(v_ped.pagos, '[]'::jsonb)) x;
        v_falta := greatest(0, coalesce(v_ped.precio,0) - coalesce(v_ped.anticipo,0)
                   - coalesce(v_ped.pago_entrega,0) - coalesce(v_ped.descuento_entrega,0) - v_pagos);
        update pedidos set
          pago_entrega = coalesce(pago_entrega,0) + v_cobrado,
          metodo_entrega = case when v_cobrado > 0 then p_metodo else metodo_entrega end,
          descuento_entrega = coalesce(descuento_entrega,0) + greatest(0, v_falta - v_cobrado),
          entregado = case when v_entregar then true else entregado end,
          entregado_at = case when v_entregar then now() else entregado_at end
        where id = v_ped.id;
      end if;
    end if;
  end loop;
  insert into ventas (fecha, items, subtotal, descuento, total, monto_local, monto_pedidos, metodo_pago, pagos)
  values (p_fecha, p_items, p_subtotal, p_descuento, p_total, p_monto_local, p_total - p_monto_local, p_metodo,
          case when p_metodo = 'mixto' then p_pagos else null end)
  returning id into v_id;
  return v_id;
end $$;
revoke execute on function registrar_venta(date, jsonb, numeric, numeric, numeric, numeric, text, jsonb) from public, anon;
grant execute on function registrar_venta(date, jsonb, numeric, numeric, numeric, numeric, text, jsonb) to authenticated;

-- Editar un ticket de hoy (devolución o cambio) con el mismo folio
create or replace function editar_venta(
  p_id bigint, p_items jsonb, p_subtotal numeric, p_descuento numeric,
  p_total numeric, p_monto_local numeric, p_metodo text)
returns bigint language plpgsql security definer set search_path = public as $$
declare v ventas%rowtype;
begin
  if not exists (select 1 from perfiles where user_id = auth.uid()) then
    raise exception 'Sin permiso';
  end if;
  select * into v from ventas where id = p_id for update;
  if not found then raise exception 'El ticket ya no existe'; end if;
  if v.fecha <> (now() at time zone 'America/Mazatlan')::date then
    raise exception 'Solo se pueden editar tickets de hoy';
  end if;
  if exists (select 1 from jsonb_array_elements(coalesce(v.items, '[]'::jsonb)) x
             where coalesce(x->>'tipo', '') <> 'local' or coalesce((x->>'merma')::boolean, false)) then
    raise exception 'Este ticket tiene pedidos o merma y no se puede editar aquí';
  end if;
  if jsonb_typeof(p_items) <> 'array' then raise exception 'Productos no válidos'; end if;
  if exists (select 1 from jsonb_array_elements(p_items) x
             where coalesce(x->>'tipo', '') <> 'local' or coalesce((x->>'merma')::boolean, false)) then
    raise exception 'Al editar solo se pueden poner productos del local';
  end if;
  if p_total > 0 and p_metodo is null then
    raise exception 'Falta el método de pago';
  end if;
  update ventas set
    ediciones = coalesce(ediciones, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
      'fecha', now(), 'por', auth.uid(), 'items', v.items, 'subtotal', v.subtotal,
      'descuento', v.descuento, 'total', v.total, 'metodo_pago', v.metodo_pago)),
    editado_at = now(),
    items = p_items,
    subtotal = p_subtotal,
    descuento = p_descuento,
    total = p_total,
    monto_local = p_monto_local,
    monto_pedidos = p_total - p_monto_local,
    metodo_pago = case when p_total > 0 then p_metodo else null end
  where id = p_id;
  return p_id;
end $$;
revoke execute on function editar_venta(bigint, jsonb, numeric, numeric, numeric, numeric, text) from public, anon;
grant execute on function editar_venta(bigint, jsonb, numeric, numeric, numeric, numeric, text) to authenticated;

-- Botón Editar de pedidos en el punto de venta
create or replace function pos_cambiar_entrega(p_id bigint, p_entrega text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from perfiles where user_id = auth.uid()) then raise exception 'Sin permiso'; end if;
  if p_entrega not in ('domicilio', 'local') then raise exception 'Tipo de entrega no válido'; end if;
  update pedidos set entrega = p_entrega where id = p_id;
end $$;
revoke execute on function pos_cambiar_entrega(bigint, text) from public, anon;
grant execute on function pos_cambiar_entrega(bigint, text) to authenticated;

create or replace function pos_reabrir_pedido(p_id bigint)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from perfiles where user_id = auth.uid()) then raise exception 'Sin permiso'; end if;
  update pedidos set entregado = false, entregado_at = null where id = p_id;
end $$;
revoke execute on function pos_reabrir_pedido(bigint) from public, anon;
grant execute on function pos_reabrir_pedido(bigint) to authenticated;

-- ===== 020 Fotos del catálogo (tabla fotos_catalogo + carpeta "catalogo") =====
--
-- Cada producto puede tener varias fotos. La primera (orden más bajo) es la principal.
-- Se guardan dos archivos por foto en el almacenamiento de Supabase (carpeta pública "catalogo"):
--   · la original, tal cual se tomó (respaldo, sin perder calidad)
--   · una copia en alta calidad para la página (hasta 2400 px, carga más rápido)

-- 1) Lista de fotos
create table if not exists fotos_catalogo (
  id bigint generated always as identity primary key,
  created_at timestamptz default now(),
  tabla text not null,             -- regla fotos_catalogo_tabla_check abajo (021)
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

-- ===== 021 Fotos de la página (tabla = 'pagina': portada, visitanos, galeria_decorados) =====
alter table fotos_catalogo drop constraint if exists fotos_catalogo_tabla_check;
alter table fotos_catalogo add constraint fotos_catalogo_tabla_check
  check (tabla in ('sabores_pasteles','sabores_cupcakes','individuales','panques','decoraciones','pagina'));

-- ===== 022 Productos ocultos en la página web =====
-- Si un producto está en esta lista, no aparece en conniereposteria.com (el sistema y el punto de venta no cambian).
-- Se oculta o se vuelve a mostrar desde el sistema: Catálogo → botón "Ocultar en la página".

create table if not exists productos_ocultos (
  tabla text not null,      -- sabores_pasteles / sabores_cupcakes / individuales / panques
  producto text not null,   -- el "nombre" del producto en su tabla
  created_at timestamptz default now(),
  primary key (tabla, producto)
);

alter table productos_ocultos enable row level security;
drop policy if exists "ocultos ver publico" on productos_ocultos;
drop policy if exists "ocultos crear director" on productos_ocultos;
drop policy if exists "ocultos borrar director" on productos_ocultos;
-- Cualquiera la lee (la página pública la necesita); solo la directora oculta o vuelve a mostrar
create policy "ocultos ver publico" on productos_ocultos for select to anon, authenticated using (true);
create policy "ocultos crear director" on productos_ocultos for insert to authenticated with check (
  exists (select 1 from perfiles where perfiles.user_id = auth.uid() and perfiles.rol = 'director'));
create policy "ocultos borrar director" on productos_ocultos for delete to authenticated using (
  exists (select 1 from perfiles where perfiles.user_id = auth.uid() and perfiles.rol = 'director'));


-- ===== 023 Catálogo: de qué está hecho, incluye corona (desde el sistema) y personas =====

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


-- ===== 024 Varios productos en un pedido (grupo) =====
-- Al agendar se pueden agregar varios productos; cada uno se guarda como un pedido aparte
-- y quedan ligados con el mismo "grupo" (Pedido 1 de 3, 2 de 3…).

alter table pedidos add column if not exists grupo text;          -- mismo valor en los pedidos que se agendaron juntos
alter table pedidos add column if not exists grupo_parte int;     -- 1, 2, 3…
alter table pedidos add column if not exists grupo_total int;     -- cuántos son en total
create index if not exists pedidos_grupo on pedidos (grupo) where grupo is not null;


-- ===== 026 Encuadre de fotos =====
-- Desde Catálogo → "Encuadrar" se mueve y acerca la foto dentro del recuadro de la tarjeta.
-- pos_x / pos_y: punto de la foto que queda al centro del recuadro (0 a 100). zoom: 1 = sin acercar.
-- Vacío = como se ve hoy (centrada, sin acercar).

alter table fotos_catalogo add column if not exists pos_x numeric;
alter table fotos_catalogo add column if not exists pos_y numeric;
alter table fotos_catalogo add column if not exists zoom numeric;


-- (025 solo renombró el mostachón a cc_ en los datos; no cambia la estructura)
