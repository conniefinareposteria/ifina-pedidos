-- 039: Folios de pedidos (P-1, P-2, …). Los del local (L-) son el número de ticket que ya existe.
-- Un folio por pedido: si un pedido lleva varios productos (mismo "grupo"), todos comparten el folio.
-- Los pedidos de la página reciben su folio al mandarse, y al aceptarlos se queda el mismo.
-- Se puede correr más de una vez sin riesgo.

create sequence if not exists folio_pedidos_seq;
alter table pedidos     add column if not exists folio bigint;
alter table solicitudes add column if not exists folio bigint;
create index if not exists pedidos_folio_idx on pedidos (folio);

-- Folio a los pedidos que ya existen, en el orden en que se capturaron
with g as (
  select coalesce(grupo, 'id' || id) as k, min(created_at) as c, min(id) as mid
  from pedidos where folio is null group by 1
), n as (
  select k, row_number() over (order by c, mid) + coalesce((select max(folio) from pedidos), 0) as f from g
)
update pedidos p set folio = n.f from n
where p.folio is null and coalesce(p.grupo, 'id' || p.id) = n.k;

-- El contador sigue después del folio más alto
select setval('folio_pedidos_seq', m, true)
from (select greatest(coalesce((select max(folio) from pedidos), 0), coalesce((select max(folio) from solicitudes), 0)) as m) x
where m > 0;

-- Pedidos de la página que siguen por confirmar
update solicitudes set folio = nextval('folio_pedidos_seq') where folio is null and estado = 'nueva';

-- Todo pedido nuevo sin folio recibe uno (si es de un grupo que ya tiene folio, usa ese)
create or replace function pedidos_poner_folio() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.folio is null and new.grupo is not null then
    select folio into new.folio from pedidos where grupo = new.grupo and folio is not null limit 1;
  end if;
  if new.folio is null then new.folio := nextval('folio_pedidos_seq'); end if;
  return new;
end $$;
drop trigger if exists pedidos_folio on pedidos;
create trigger pedidos_folio before insert on pedidos for each row execute function pedidos_poner_folio();

-- El sistema pide el folio antes de guardar (para imprimirlo en el comprobante)
create or replace function folio_nuevo_pedido() returns bigint
language sql security definer set search_path = public as $$ select nextval('folio_pedidos_seq') $$;
revoke execute on function folio_nuevo_pedido() from public, anon;
grant execute on function folio_nuevo_pedido() to authenticated;

-- La página manda el pedido por aquí y recibe su folio
create or replace function crear_solicitud(p jsonb) returns bigint
language plpgsql security definer set search_path = public as $$
declare v bigint;
begin
  if jsonb_typeof(p->'items') <> 'array' or jsonb_array_length(p->'items') = 0 then
    raise exception 'El pedido no tiene productos';
  end if;
  if jsonb_array_length(p->'items') > 60 then raise exception 'Demasiados productos'; end if;
  insert into solicitudes (nombre, telefono, fecha_deseada, entrega, direccion, direccion_detalle, comentarios, items, total, folio)
  values (p->>'nombre', p->>'telefono', nullif(p->>'fecha_deseada', '')::date, p->>'entrega', p->>'direccion',
          nullif(p->'direccion_detalle', 'null'::jsonb), p->>'comentarios', p->'items', nullif(p->>'total', '')::numeric,
          nextval('folio_pedidos_seq'))
  returning folio into v;
  return v;
end $$;
revoke execute on function crear_solicitud(jsonb) from public;
grant execute on function crear_solicitud(jsonb) to anon, authenticated;
