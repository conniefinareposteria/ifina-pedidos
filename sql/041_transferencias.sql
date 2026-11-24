-- 041: Transferencias validadas con Banxico (CEP)
-- Cada comprobante que se sube queda aquí con lo que leyó la IA y lo que contestó Banxico.
-- Solo la función "validar-transferencia" escribe (con llave de servicio); en el sistema se puede leer y ligar al pedido o venta.
-- Se puede correr más de una vez sin riesgo.

create table if not exists transferencias (
  id bigint generated always as identity primary key,
  created_at timestamptz default now(),
  subido_por uuid default auth.uid(),
  clave_rastreo text,              -- o referencia, tal como viene en el comprobante
  fecha date,                      -- fecha del comprobante
  banco_emisor text,               -- clave Banxico (ej. 40012 = BBVA)
  banco_emisor_nombre text,
  monto numeric,
  ordenante text,                  -- quién pagó (según Banxico, o según el comprobante si no se pudo validar)
  concepto text,
  estado text not null default 'pendiente',
     -- liquidada (sí llegó) | no_encontrada (Banxico aún no la tiene o no existe) | manual (revisar a mano) | otra_cuenta (no es a tu cuenta)
  detalle text,                    -- explicación corta para mostrar
  revisado_at timestamptz,         -- última consulta a Banxico
  pedido_id bigint,
  venta_id bigint,
  lectura jsonb                    -- lo que leyó la IA del comprobante (para revisar sin volver a pagar la lectura)
);
create index if not exists transferencias_clave_idx on transferencias (clave_rastreo);
create index if not exists transferencias_pedido_idx on transferencias (pedido_id);
create index if not exists transferencias_venta_idx on transferencias (venta_id);

alter table transferencias enable row level security;
drop policy if exists "transferencias ver" on transferencias;
create policy "transferencias ver" on transferencias for select to authenticated using (
  exists (select 1 from perfiles where perfiles.user_id = auth.uid() and perfiles.rol in ('director','colaborador'))
);

-- Ligar una transferencia ya validada al pedido (por id o por folio P-) o a la venta (folio L-) que se acaba de guardar
drop function if exists vincular_transferencia(bigint, bigint, bigint);
create or replace function vincular_transferencia(p_id bigint, p_pedido_id bigint default null, p_venta_id bigint default null, p_folio bigint default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_pedido bigint := p_pedido_id;
begin
  if not exists (select 1 from perfiles where user_id = auth.uid() and rol in ('director','colaborador')) then
    raise exception 'Sin permiso';
  end if;
  if v_pedido is null and p_folio is not null then
    select min(id) into v_pedido from pedidos where folio = p_folio;
  end if;
  update transferencias
     set pedido_id = coalesce(v_pedido, pedido_id),
         venta_id  = coalesce(p_venta_id, venta_id)
   where id = p_id;
end $$;
revoke execute on function vincular_transferencia(bigint, bigint, bigint, bigint) from public, anon;
grant execute on function vincular_transferencia(bigint, bigint, bigint, bigint) to authenticated;
