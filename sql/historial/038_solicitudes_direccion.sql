-- 038: dirección de los pedidos de la página con los mismos campos que el sistema
-- (calle, número exterior, número interior, colonia, código postal, ciudad, referencias).
-- Se puede correr más de una vez sin riesgo.
alter table solicitudes add column if not exists direccion_detalle jsonb;
