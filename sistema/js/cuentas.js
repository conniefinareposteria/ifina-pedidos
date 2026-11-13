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

// ---------------------------------------------------------------------------------------------
// VENTA DEL DÍA: todo lo que le corresponde a un día, sin importar cuándo se pagó.
//  · Mostrador: lo vendido en el punto de venta ese día (solo la parte de mostrador de cada ticket).
//  · Pedidos: los pedidos que se ENTREGAN ese día, con TODO lo que se pagó de ellos (anticipos de días
//    antes, pagos posteriores y lo cobrado al entregar), cada pago con su método. Lo que falte es "por cobrar".
// Así, si el 15 hay 10 pasteles y 5 se pagaron por transferencia un mes antes, ese dinero sale el 15.
// Devuelve { 'AAAA-MM-DD': { mostrador:{efectivo,tarjeta,transferencia,otro,total,tickets},
//            pedidos:{venta,n,cobrado,antes,porCobrar,metodos:{…}}, metodos:{…}, total } }
const METODOS_VENTA = ['efectivo','tarjeta','transferencia','otro'];
function metodoVenta(m){ m = mt(m); return METODOS_VENTA.includes(m) ? m : 'otro'; }
function diaVacio(){
  const z = ()=> ({ efectivo:0, tarjeta:0, transferencia:0, otro:0 });
  return { mostrador: { ...z(), total:0, tickets:0 }, pedidos: { venta:0, n:0, cobrado:0, antes:0, porCobrar:0, metodos: z() }, metodos: z(), total:0 };
}
async function ventaPorDia(desde, hasta){
  const ini = new Date(desde + 'T00:00:00'), fin = new Date(hasta + 'T00:00:00'); fin.setDate(fin.getDate() + 1);
  const [rv, rp] = await Promise.all([
    sb.from('ventas').select('fecha,items,total,monto_local,metodo_pago,pagos').gte('fecha', desde).lte('fecha', hasta),
    sb.rpc('pedidos_pagos_por_entrega', { desde: ini.toISOString(), hasta: fin.toISOString() })
  ]);
  if(rv.error) throw rv.error;
  if(rp.error) throw rp.error;
  const ventas = rv.data || [], pedidos = rp.data || [];
  const dias = {};
  const dia = f=> (dias[f] = dias[f] || diaVacio());

  // Mostrador
  ventas.forEach(v=>{
    const ml = Number(v.monto_local)||0;
    if(ml <= 0) return;
    const d = dia(v.fecha);
    repartoVenta(v, ml).forEach(r=>{ d.mostrador[metodoVenta(r.m)] += r.monto; });
    d.mostrador.total += ml; d.mostrador.tickets++;
  });

  // Tickets con pago diferido (varios métodos) que hagan falta para repartir pagos de pedidos
  const fechaLocal = t=> t ? fechaStrDesdeDate(new Date(t)) : null;
  const necesito = new Set();
  pedidos.forEach(p=>{
    pagosDe(p).forEach(x=>{ if(x.metodo === 'mixto'){ const f = fechaLocal(x.fecha); if(f && (f < desde || f > hasta)) necesito.add(f); } });
    if(p.metodo_entrega === 'mixto'){ const f = fechaLocal(p.entregado_at); if(f && (f < desde || f > hasta)) necesito.add(f); }
  });
  let tickets = ventas;
  if(necesito.size){
    const extra = await sb.from('ventas').select('fecha,items,total,monto_local,metodo_pago,pagos').in('fecha', [...necesito]);
    if(!extra.error) tickets = tickets.concat(extra.data || []);
  }
  // Reparte un pago "mixto" de un pedido con los métodos del ticket donde se cobró
  const repartoMixto = (pid, monto, f)=>{
    const t = tickets.find(v=> v.metodo_pago === 'mixto' && (!f || v.fecha === f) && (v.items || []).some(i=> i.tipo === 'pedido' && Number(i.pedido_id) === Number(pid)));
    return t ? repartoVenta(t, monto) : [{ m:'otro', monto }];
  };

  // Pedidos: todo lo pagado va al día en que se entregan
  pedidos.forEach(p=>{
    if(!p.fecha_entrega) return;
    const f = fechaLocal(p.fecha_entrega), d = dia(f);
    const venta = Math.max(0, (Number(p.precio)||0) - (Number(p.descuento_entrega)||0));
    const pagos = [];
    if(Number(p.anticipo) > 0) pagos.push({ m: p.metodo_pago, monto: Number(p.anticipo), f: fechaLocal(p.created_at) });
    pagosDe(p).forEach(x=>{ if(Number(x.monto) > 0) pagos.push({ m: x.metodo, monto: Number(x.monto), f: fechaLocal(x.fecha) }); });
    if(Number(p.pago_entrega) > 0) pagos.push({ m: p.metodo_entrega, monto: Number(p.pago_entrega), f: fechaLocal(p.entregado_at) || f });
    let cobrado = 0;
    pagos.forEach(x=>{
      const partes = x.m === 'mixto' ? repartoMixto(p.id, x.monto, x.f) : [{ m: x.m, monto: x.monto }];
      partes.forEach(r=>{ d.pedidos.metodos[metodoVenta(r.m)] += r.monto; });
      cobrado += x.monto;
      if(x.f && x.f < f) d.pedidos.antes += x.monto;
    });
    d.pedidos.venta += venta; d.pedidos.n++;
    d.pedidos.cobrado += cobrado;
    d.pedidos.porCobrar += Math.max(0, venta - cobrado);
  });

  Object.values(dias).forEach(d=>{
    METODOS_VENTA.forEach(m=> d.metodos[m] = d.mostrador[m] + d.pedidos.metodos[m]);
    d.total = d.mostrador.total + d.pedidos.venta;
  });
  return dias;
}
function sumarDias(dias){
  const t = diaVacio();
  Object.values(dias).forEach(d=>{
    METODOS_VENTA.forEach(m=>{ t.mostrador[m] += d.mostrador[m]; t.pedidos.metodos[m] += d.pedidos.metodos[m]; t.metodos[m] += d.metodos[m]; });
    t.mostrador.total += d.mostrador.total; t.mostrador.tickets += d.mostrador.tickets;
    ['venta','n','cobrado','antes','porCobrar'].forEach(k=> t.pedidos[k] += d.pedidos[k]);
    t.total += d.total;
  });
  return t;
}
// Tabla de la venta del día (corte, historial y resumen la usan igual)
function tablaVentaDia(d, titulo){
  const fila = (c, m, extra)=> `<tr${extra ? ` class="${extra}"` : ''}><td>${c}</td><td class="n">${fmtDinero(m)}</td></tr>`;
  const cobradoMet = d.metodos.efectivo + d.metodos.tarjeta + d.metodos.transferencia + d.metodos.otro;
  return `<div class="tabla-wrap" style="margin-bottom:12px;"><table class="tabla-pedidos">
      <thead><tr><th>${titulo || 'Venta por método de pago'}</th><th class="n">Monto</th></tr></thead>
      <tbody>${fila('Efectivo', d.metodos.efectivo)}${fila('Tarjeta', d.metodos.tarjeta)}${fila('Transferencia', d.metodos.transferencia)}
        ${d.metodos.otro ? fila('Sin método registrado', d.metodos.otro) : ''}
        ${d.pedidos.porCobrar ? fila('Pedidos por cobrar todavía', d.pedidos.porCobrar) : ''}</tbody>
      <tfoot><tr><td>Venta total</td><td class="n">${fmtDinero(cobradoMet + d.pedidos.porCobrar)}</td></tr></tfoot>
    </table></div>
    <div class="tabla-wrap" style="margin-bottom:10px;"><table class="tabla-pedidos">
      <thead><tr><th>Por tipo de venta</th><th class="n">Monto</th></tr></thead>
      <tbody>${fila('Mostrador', d.mostrador.total)}${fila(`Pedidos que se entregan (${d.pedidos.n})`, d.pedidos.venta)}</tbody>
      <tfoot><tr><td>Venta total</td><td class="n">${fmtDinero(d.total)}</td></tr></tfoot>
    </table></div>
    ${d.pedidos.antes ? `<div class="hint" style="margin:0 0 12px;">De los pedidos, ${fmtDinero(d.pedidos.antes)} se pagaron en días anteriores (anticipos o pagos completos); ya van incluidos arriba con su método.</div>` : ''}`;
}
