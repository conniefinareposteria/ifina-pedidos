# Pruebas automáticas del sistema

No se publican (Netlify solo sube `sistema/` y `pagina-inicial/`).

- `supabase-simulado.js` — reemplaza a Supabase con datos de prueba en memoria y anota todo lo que el sistema manda (ventas, pedidos, cierres, RPCs).
- `recorrido.js` — abre el sistema como colaborador, directora y producción, recorre las pantallas y flujos principales (venta, pago diferido, merma, cortesía, anticipo, pedidos de hoy, productos del día, corte, resumen, historial, clientes, por hacer) y guarda una "huella" en JSON.
- `comparar.js` — compara dos huellas y dice exactamente qué cambió.

## Antes de publicar un cambio

```bash
git stash            # o usar una copia del sistema anterior
node pruebas/recorrido.js sistema/index.html antes.json
git stash pop
node pruebas/recorrido.js sistema/index.html despues.json
node pruebas/comparar.js antes.json despues.json
```

Si el cambio es a propósito (algo nuevo o un texto distinto), las diferencias deben ser solo esas.
Con `CAPTURAS=carpeta` también se guarda una foto de cada paso para revisar el diseño.

Requiere Node y Playwright (`npm i -g playwright`).
