-- Connie Repostería Fina — Textos de la página web (se editan desde el sistema: Catálogo → Página web)
-- Se puede correr varias veces sin riesgo.

create table if not exists textos_pagina (
  clave text primary key,     -- bienvenida_titulo, bienvenida_texto, visitanos_direccion, visitanos_detalle
  texto text,
  updated_at timestamptz default now()
);

alter table textos_pagina enable row level security;
drop policy if exists "textos ver publico" on textos_pagina;
drop policy if exists "textos crear director" on textos_pagina;
drop policy if exists "textos editar director" on textos_pagina;
-- Cualquiera los lee (la página pública); solo la directora los escribe
create policy "textos ver publico" on textos_pagina for select to anon, authenticated using (true);
create policy "textos crear director" on textos_pagina for insert to authenticated with check (
  exists (select 1 from perfiles where perfiles.user_id = auth.uid() and perfiles.rol = 'director'));
create policy "textos editar director" on textos_pagina for update to authenticated using (
  exists (select 1 from perfiles where perfiles.user_id = auth.uid() and perfiles.rol = 'director'));

-- Revisión: debe salir 0 (empieza vacía; mientras esté vacía la página muestra los textos de siempre)
select count(*) from textos_pagina;
