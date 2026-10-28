# Base de datos (Supabase)

- **`esquema_actual.sql`** — la "foto" de cómo está la base hoy: tablas, columnas, permisos (RLS) y funciones.
  **No se corre** en la base actual (ya está aplicado). Sirve de referencia y para armar una base desde cero.
- **`historial/`** — todos los scripts que se han corrido en Supabase, numerados en el orden en que se corrieron.
  No se vuelven a correr.

## Cómo se hace un cambio nuevo en la base

1. Se crea un archivo nuevo en `sql/` con el siguiente número: `sql/020_nombre_del_cambio.sql`.
   Debe poder correrse varias veces sin riesgo (`if not exists`, `create or replace`, `drop policy if exists`…).
2. Se corre en Supabase → SQL Editor.
3. Ya corrido, se pasa a `historial/` y se actualiza `esquema_actual.sql` para que refleje el cambio.
4. El código del sistema que usa el cambio se publica **después** de correr el SQL.

## Reglas de seguridad

- Cada tabla tiene RLS activado. Ocultar algo en pantalla no lo protege: lo que protege los datos son las políticas.
- Lo que solo ve la directora (dinero, pedidos completos, y en el futuro compras y gastos) debe tener políticas
  `... perfiles.rol = 'director'`.
- Las acciones del local que tocan datos sensibles (cobrar, editar tickets, cambiar entrega) se hacen con
  funciones `security definer` que revisan el perfil, no con permisos directos a la tabla.
