// Cuentas de dinero: pagos de pedidos y cómo se reparte el pago de una venta por método.

// Método de pago: antes se guardaba 'terminal', ahora 'tarjeta'
function mt(m){ return m === 'terminal' ? 'tarjeta' : m; }
// Cómo se repartió el pago de una venta: [{m, monto}] (pago diferido = varios métodos), escalado a "base"
function repartoVenta(v, base){
  const tot = Number(v.total)||0;
  if(v.metodo_pago === 'mixto' && Array.isArray(v.pagos) && tot > 0) return v.pagos.map(x=> ({ m: mt(x.metodo), monto: base * (Number(x.monto)||0) / tot }));
  return [{ m: mt(v.metodo_pago), monto: base }];
}
function textoMetodoVenta(v){
  if(v.metodo_pago === 'mixto' && Array.isArray(v.pagos)) return v.pagos.map(x=> formatNombre(x.metodo) + ' ' + fmtDinero(x.monto)).join(' + ');
  return v.metodo_pago ? formatNombre(v.metodo_pago) : '';
}
// Lo que ya está cubierto de un pedido: anticipo + lo cobrado al entregar + descuento al entregar
function pagosDe(p){ return Array.isArray(p.pagos) ? p.pagos : []; }
function sumaPagos(p){ return pagosDe(p).reduce((a, x)=> a + (Number(x.monto)||0), 0); }
function pagadoDe(p){ return (Number(p.anticipo)||0) + (Number(p.pago_entrega)||0) + (Number(p.descuento_entrega)||0) + sumaPagos(p); }
