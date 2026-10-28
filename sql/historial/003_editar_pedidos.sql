-- Connie Repostería Fina — Permiso para editar y borrar pedidos (solo directora)
-- Se puede correr varias veces sin riesgo.
drop policy if exists "pedidos editar director" on pedidos;
drop policy if exists "pedidos borrar director" on pedidos;
create policy "pedidos editar director" on pedidos for update to authenticated using (
  exists (select 1 from perfiles where perfiles.user_id = auth.uid() and perfiles.rol = 'director'));
create policy "pedidos borrar director" on pedidos for delete to authenticated using (
  exists (select 1 from perfiles where perfiles.user_id = auth.uid() and perfiles.rol = 'director'));
