# Connie Repostería Fina

| Carpeta | Qué es | Dónde vive |
|---|---|---|
| `sistema/` | Sistema interno: pedidos, punto de venta, inventario, corte, resumen | sistema.conniereposteria.com (Netlify, base dir `sistema`) |
| `pagina-inicial/` | Página pública con catálogo | conniereposteria.com (Netlify, base dir `pagina-inicial`) |
| `sql/` | Base de datos: `esquema_actual.sql` + historial de scripts (ver `sql/README.md`) | Supabase |
| `pruebas/` | Pruebas automáticas con Supabase simulado (ver `pruebas/README.md`) | Solo local, no se publica |

Cada carpeta publicada es un sitio distinto en Netlify y se publica sola al subir a `main`.

## Cómo está armado el sistema (`sistema/`)

Una sola página (`index.html`) con todas las pantallas; el estilo y el código están separados por tema.
No hay "build": los archivos se publican tal cual.

```
sistema/
  index.html          pantallas (HTML) y la lista de archivos que se cargan
  css/base.css        estructura y componentes
  css/tema.css        colores, tipografía y acabados del tema Connie (va encima de base.css)
  js/                 se cargan en este orden:
    nucleo.js         conexión a Supabase, estado de catálogos, utilidades (fechas, dinero, ventanas)
    catalogos.js      precios y productos (de Supabase), listas fijas de sabores, coronas
    cuentas.js        pagos de pedidos y reparto del pago de una venta por método
    inventario.js     existencias que se arrastran de un día a otro
    sesion.js         login, PERMISOS por perfil y navegación entre pantallas
    nuevo-pedido.js   agendar: carrito, corona, decorado, cliente, dirección, pago
    pedidos.js        lista por día, repartidor, editar, pagos, eliminados, hoja impresa
    clientes.js       pestaña Clientes (directora)
    productos-dia.js  inicio/cierre por sección, corte de caja, mermas y cortesías
    resumen.js        Resumen e Historial (directora)
    tickets.js        impresión en la Epson del local (ePOS-Print)
    punto-venta.js    venta, pedidos de hoy, coronas, cortesía, merma, anticipo, pago diferido
    produccion.js     Por hacer y metas
    interfaz.js       bloqueo de scroll con ventanas abiertas, vibración al tocar
    inicio.js         arranque (siempre al final)
```

Todo el código comparte el mismo espacio (no usa módulos de JavaScript): una función de un archivo se puede
usar desde otro. La única regla es el **orden**: lo que se ejecuta al cargar un archivo solo puede usar cosas de
ese archivo o de los anteriores. Las pruebas automáticas avisan si esto se rompe.

### Agregar un módulo nuevo (compras, calculadora, alertas…)

1. Su pantalla en `index.html` (`<section id="view-...">`) y su pestaña en el `<nav>`.
2. Su archivo `js/nombre.js`, cargado antes de `inicio.js`.
3. La pestaña y sus acciones en `PERMISOS` (`js/sesion.js`); para revisar permisos en el código, `puede('accion')`.
4. Sus tablas en un SQL nuevo con RLS (`sql/README.md`). Lo que es solo de la directora se protege en Supabase.
5. Agregar sus pasos a `pruebas/recorrido.js`.

### Reglas de trabajo

- Precios y catálogos siempre en Supabase, nunca escritos en el código.
- Interfaz en español, etiquetas neutras, sin emojis en la interfaz.
- Antes de publicar: correr las pruebas (`pruebas/README.md`) y comparar contra la versión anterior.
- Si un cambio necesita SQL, se corre en Supabase **antes** de publicar el código.
