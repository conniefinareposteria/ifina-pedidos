// Tickets en la impresora Epson del local (ePOS-Print por la red).

// Renglones del pedido para el ticket: el producto y la corona por separado, con su precio
function entregaTxtPedido(p){
  if(!p.fecha_entrega) return '';
  const d = new Date(p.fecha_entrega);
  const dia = d.toLocaleDateString('es-MX', {weekday:'short', day:'numeric', month:'short'});
  return p.entrega === 'domicilio' ? dia + ' ' + d.toLocaleTimeString('es-MX', {hour:'2-digit', minute:'2-digit'}) + ' (domicilio)' : dia;
}
// Pedido como renglón de ticket (comprobante): precio completo, lo ya pagado y nada cobrado hoy
function itemTicketPedido(p){
  return { tipo:'pedido', nombre: p.nombre_cliente || 'Sin nombre', cobrado:0, montoBase:0,
    total: Number(p.precio)||0, pagadoAntes: pagadoDe(p), lineas: lineasTicketPedido(p), entregaTxt: entregaTxtPedido(p) };
}
function lineasTicketPedido(p){
  const tot = Number(p.precio)||0;
  const cor = textoCorona(p);
  const precioCor = Number(p.corona_precio)||0;
  const lineas = [{ txt: detallePedidoPOS(p) + (p.decorado ? ' · Decorado' : ''), monto: Math.max(0, tot - precioCor) }];
  if(cor) lineas.push({ txt: cor, monto: precioCor });
  return lineas;
}
// ---------- Ticket en la impresora Epson del local (ePOS-Print por la red) ----------
const IMPRESORA_TICKETS = '192.168.1.30';
const LOGO_TICKET = { w:384, h:136, data:'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABwAAAAAAAAAAAAAAAAD/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHwAAAAAAAAAAAAAAAB///4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAfwAAAAAAAAAAAAAAAP////AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP/wAAAAAAAAAAAAAAB//Af/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD//wAAAAAAAAAAAAAAH/wAB/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAH//wAAAAAAAAAAAAAAf+AAA//AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP//wAAAAAAAAAAAAAA/4AAAf/gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAf//gAAAAAAAAAAAAAD/wAAAP/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAf//gAAAAAAAAAAAAAH/AAAAP/4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA///AAAAAAAAAAAAAAP+AAAAP/4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA///AAAAAAAAAAAAAAf8AAAAP/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//+AAAAAAAAAAAAAA/4AAAAP/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA//+AAAAAAAAAAAAAB/wAAAAP/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAf/8AAAAAAAAAAAAAD/gAAAAP/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAf/4AAAAAAAAAAAAAH/gAAAAP/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP/wAAAAAAAAAAAAAP/AAAAAP/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAH/AAAAAAAAAAAAAAP+AAAAAH/8AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB8AAAAAAAAAAAAAAf+AAAAAH/4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/8AAAAAD/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA/8AAAAAB/gAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB/4AAAAAAOAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB/4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/wAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAH/wAAAAAAAAAAAAAD/+AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD//AAAH/wAAAAAAAAAAAAA///wAAAAAAAAAH/gAAAAAAAAAAP/gAAAAAAAAAAAAAf//8AAH/gAAAAAAAAAAAAD/AP+AAAAAAIAA//+AAAAAAAQAB//8AAAAAAAwAAAAD/gD/AAP/gAAAAAAAAAAAAP4AB/gAAAAAcAD+D/gAAAAAA4AH8H/AAAAAADwAAAAP8AAfwAP/gAAAAAAAAAAAA/gAAfwAAAAB8AHgA/4AAAAAD4APAB/wAAAAAHwAAAA/wAAP8AP/gAAAAAAAAAAAB/AAAP8AAAAD8AeAAP8AAAAAH4A8AAf4AAAAAPwAAAB/gAAD+AP/AAAAAAAAAAAAH+AAAH+AAAAH8A8AAH+AAAAAP4B4AAP8AAAAA/wAAAH/AAAB/Af/AAAAAAAAAAAAP8AAAD/AAAAf8BwAAD/AAAAA/4DwAAH+AAAAD/wAAAP+AAAB/gf/AAAAAAAAAAAAf4AAAB/gAAB/8DgAAD/gAAAD/4DAAAD/AAAM//wAAAf8AAAA/wf/AAAAAAAAAAAA/wAAAA/wAH//8DAAAB/wAAP//4HAAAD/gAAP//wAAA/4AAAAf4f/AAAAAAAAAAAB/gAAAAf4AH//8HAAAA/wAAP//4OAAAB/wAAH//wAAB/wAAAAf4f/AAAAAAAAAAAD/gAAAAf8AB//8OAAAA/4AAD//4cAAAB/wAAB//wAAD/gAAAAP8//AAAAAAAAAAAD/AAAAAP+AAP/8MAAAA/4AAAf/4YAAAB/4AAAP/wAAD/gAAAAP+//AAAAAAAAAAAH/AAAAAP+AAD/8cAAAAf8AAAH/44AAAA/4AAAH/wAAH/AAAAAP+//AAAAAAAAAAAP+AAAAAH/AAB/8YAAAAf8AAAD/4wAAAA/4AAAD/wAAP/AAAAAP+//AAAAAAAAAAAP+AAAAAH/gAA/84AAAAf+AAAB/5wAAAA/8AAAD/wAAP+AAAAAP///AAAAAAAAAAAf+AAAAAD/gAA/8wAAAAf+AAAB/5gAAAA/8AAAB/wAAf+AAAAAP///AAAAAAAAAAAf8AAAAAD/wAA/9wAAAAf+AAAB/5gAAAAf8AAAB/wAAf8AAAAAP///AAAAAAAAAAA/8AAAAAD/wAA/9gAAAAP+AAAB/7gAAAAf8AAAB/wAA/8AAAAAP///AAAAAAAAAAA/8AAAAAB/wAA/9gAAAAP+AAAB/7AAAAAf+AAAB/wAA/8AAAAAP///AAAAAAAAAAA/4AAAAAB/4AA//gAAAAP/AAAB//AAAAAf+AAAB/wAB/4AAAAAP///AAAAAAAAAAB/4AAAAAB/4AA//AAAAAP/AAAB//AAAAAf+AAAB/wAB/4AAAAAP///AAAAAAAAAAB/4AAAAAB/4AA//AAAAAP/AAAB/+AAAAAf+AAAB/wAB/4AAAAAf///AAAAAAAAAAB/4AAAAAA/8AA//AAAAAP/AAAB/+AAAAAf+AAAB/wAB/4AAAAAf///AAAAAAAAAAB/4AAAAAA/8AA//AAAAAP/AAAB/+AAAAAf+AAAB/wAD/4AAAAAf+//AAAAAAAAAAD/4AAAAAA/8AA/+AAAAAP/AAAB/+AAAAAf+AAAB/wAD/4AAAAA/+f/gAAAAAAAAAD/wAAAAAA/8AA/+AAAAAP/AAAB/8AAAAAf+AAAB/wAD/wAAAAB/+f/gAAAAAAAAAD/wAAAAAA/8AA/+AAAAAP/AAAB/8AAAAAf+AAAB/wAD/wAAAAD/8f/gAAAAAAAAAD/wAAAAAA/8AA/+AAAAAP/AAAB/8AAAAAf+AAAB/wAD/wAAAAH/4f/gAAAAAAAAAD/wAAAAAA/8AA/+AAAAAP/AAAB/8AAAAAf+AAAB/wAD/wAAAAP/wf/wAAAAAAAAAD/wAAAAAA/8AA/+AAAAAP/AAAB/8AAAAAf+AAAB/wAD/wAAAA//gP/wAAAAAAAAAD/wAAAAAA/8AA/8AAAAAP/AAAB/8AAAAAf+AAAB/wAD/wAAAD//AP/wAAAAAAAAAD/wAAAAAA/8AA/8AAAAAP/AAAB/8AAAAAf+AAAB/wAD/wAAAf/8AP/4AAAAAAAAAD/wAAAAAA/8AA/8AAAAAP/AAAB/4AAAAAf+AAAB/wAD/wAAD//wAH/4AAAAAAAAGD/4AAAAAA/8AA/8AAAAAP/AAAB/4AAAAAf+AAAB/wAD/wAAP//AAH/4AAAAAAAAGD/4AAAAAA/8AA/8AAAAAP/AAAB/4AAAAAf+AAAB/wAD/4AB//wAAH/8AAAAAAAAOB/4AAAAAA/8AA/8AAAAAP/AAAB/4AAAAAf+AAAB/wAD/4AH/8AAAD/8AAAAAAAAMB/4AAAAAA/4AA/8AAAAAP/AAAB/4AAAAAf+AAAB/wAB/4Af+AAAAD/+AAAAAAAAMB/4AAAAAB/4AA/8AAAAAP/AAAB/4AAAAAf+AAAB/wAB/4B/wAAAAB/+AAAAAAAAcA/4AAAAAB/4AA/8AAAAAP/AAAB/4AAAAAf+AAAB/wAB/4D+AAAAAB//AAAAAAAAcA/8AAAAAB/wAA/8AAAAAP/AAAB/4AAAAAf+AAAB/wAA/4HwAAAAAA//gAAAAAAAYA/8AAAAAB/wAA/8AAAAAP/AAAB/4AAAAAf+AAAB/wAA/8HgAAAAAA//gAAAAAAA4Af8AAAAAD/wAA/8AAAAAf/AAAB/4AAAAAf+AAAB/wAA/8PAAAAAHAf/wAAAAAAAwAf+AAAAAD/gAA/8AAAAAf+AAAB/4AAAAAf+AAAD/wAAf8OAAAAAHAP/4AAAAAABwAP+AAAAAH/gAA/8AAAAAf+AAAB/4AAAAAf+AAAD/wAAf+cAAAAAGAP/8AAAAAADgAP+AAAAAH/AAA/8AAAAAf+AAAB/4AAAAAf+AAAD/wAAP+cAAAAAOAH/+AAAAAAHgAH/AAAAAP+AAA/8AAAAAf+AAAB/4AAAAAf+AAAD/wAAP+cAAAAAcAD//AAAAAAHAAD/AAAAAP+AAA/8AAAAAf+AAAB/4AAAAA/+AAAD/wAAH/cAAAAAcAB//gAAAAAOAAD/gAAAAf8AAA/8AAAAAf+AAAB/4AAAAA/+AAAD/wAAD/cAAAAA4AA//wAAAAAcAAB/wAAAAf4AAA/8AAAAAf/AAAB/4AAAAA/+AAAD/wAAB/8AAAAAwAAf/4AAAAB4AAA/wAAAA/wAAA/8AAAAAf/AAAB/4AAAAA/+AAAD/wAAB/8AAAABwAAP/+AAAADwAAAf4AAAB/gAAA/8AAAAAf/AAAB/8AAAAA/+AAAD/wAAA/8AAAADgAAH//gAAAPgAAAP8AAAD/AAAA/+AAAAAf/AAAB/8AAAAA/+AAAD/wAAAf+AAAAHAAAB//4AAA/AAAAH+AAAH+AAAA/+AAAAAf/AAAB/8AAAAA/+AAAD/4AAAH+AAAAOAAAA///AAD8AAAAB/AAAP8AAAB/+AAAAA//gAAD/+AAAAA//AAAH/4AAAD/AAAA8AAAAP//+B/4AAAAA/wAAfwAAAD//AAAAA//gAAD/+AAAAB//gAAP/8AAAA/wAAB4AAAAD/////gAAAAAP4AB/AAAAH//gAAAB//4AAP//AAAAD//wAAf/+AAAAf4AAPgAAAAA////+AAAAAAD/AH8AAAAf//4AAAP//+AA///wAAAP//8AB///wAAAH/gB/AAAAAAH///wAAAAAAA///wAAAD////gAB////wH////AAD////gP///+AAAA///4AAAAAAAP/8AAAAAAAAD/8AAAAH////gAB////4P////AAD////wf///+AAAAD//AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACAABgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAH/gH/4P/AA/wAP8B//B/+B/4BgAcAAAf/gwGAGABwAAAAAAAAAAAAAAAAAAAAAAAH/wH/4P/wB58AeeB//B/+B/8BgAcAAAf/gwHAGAB4AAAAAAAAAAAAAAAAAAAAAAAGA4GAAOA4DgOAYGADABgABgOBgA+AAAYAAwHgGAB4AAAAAAAAAAAAAAAAAAAAAAAGAcGAAOAYHAHAwAADABgABgHBgA2AAAYAAwHwGADcAAAAAAAAAAAAAAAAAAAAAAAGAMGAAOAYGADAwAADABgABgDBgB3AAAYAAwGwGADMAAAAAAAAAAAAAAAAAAAAAAAGAMGAAOAcMADg4AADABgABgDBgBjAAAYAAwGYGAHMAAAAAAAAAAAAAAAAAAAAAAAGAcGAAOAYMABgeAADABgABgDBgDjgAAYAAwGcGAGGAAAAAAAAAAAAAAAAAAAAAAAGAYH/wOA4MABgPwADAB/8BgGBgDBgAAf/AwGOGAOGAAAAAAAAAAAAAAAAAAAAAAAGD4H/wODwMABgD8ADAB/8BgeBgHBgAAf/AwGHGAMDAAAAAAAAAAAAAAAAAAAAAAAH/gGAAP/gMABgAeADABgAB/8BgGAwAAYAAwGDGAcDAAAAAAAAAAAAAAAAAAAAAAAH/AGAAP+AMADgAHADABgAB/wBgGAwAAYAAwGDmAYDgAAAAAAAAAAAAAAAAAAAAAAGDAGAAOAAOADAADADABgABgwBgP/4AAYAAwGB2Af/gAAAAAAAAAAAAAAAAAAAAAAGDgGAAOAAGAHAADADABgABgYBgP/4AAYAAwGA+A//wAAAAAAAAAAAAAAAAAAAAAAGBgGAAOAADAOAwDADABgABgcBgcAcAAYAAwGAeAwAwAAAAAAAAAAAAAAAAAAAAAAGAwGAAOAABwcA8OADABwABgMBgYAMAAYAAwGAeBwAwAAAAAAAAAAAAAAAAAAAAAAGAYH/4OAAA/4Af+ADgB/+BgGBg4AOAAYAA4GAOBgAYAAAAAAAAAAAAAAAAAAAAAAEAYH/4EAAAPgAH4ABAA/+BgCBgwAEAAIAAQGAGBAAYAAAAAAAAAAA' };
const TK_COLS = 42;
let ticketPendiente = null;
function tkEsc(t){ return String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function tkTexto(t){ return tkEsc(t).replace(/\n/g, '&#10;'); }
// Bloque de renglones del mismo ancho, para que al centrarlo queden alineados entre sí
function tkBloque(t){
  return String(t).split('\n').map((l, i, arr)=> (i === arr.length - 1 && l === '') ? '' : l.padEnd(TK_COLS, ' ')).join('\n');
}
function tkFila(izq, der){
  der = String(der || ''); izq = String(izq || '');
  const max = TK_COLS - der.length - 1;
  // Si el texto no cabe junto al precio, el texto va completo arriba y el precio en el renglón de abajo
  if(izq.length > max){
    const partes = []; let r = izq.slice(0, TK_COLS * 3);
    while(r.length > TK_COLS){ partes.push(r.slice(0, TK_COLS)); r = r.slice(TK_COLS); }
    if(r.length) partes.push(r);
    return partes.join('\n') + '\n' + ' '.repeat(Math.max(0, TK_COLS - der.length)) + der;
  }
  return izq + ' '.repeat(TK_COLS - izq.length - der.length) + der;
}
function tkPesos(n){ return '$' + (Number(n)||0).toLocaleString('es-MX', {minimumFractionDigits:2, maximumFractionDigits:2}); }
function tkFechaTxt(f){ return f.toLocaleDateString('es-MX', {day:'2-digit', month:'2-digit', year:'numeric'}) + ' ' + f.toLocaleTimeString('es-MX', {hour:'2-digit', minute:'2-digit'}); }
function tkSobre(cuerpo){
  return '<?xml version="1.0" encoding="utf-8"?>'
    + '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body>'
    + '<epos-print xmlns="http://www.epson-pos.com/schemas/2011/03/epos-print">'
    + '<text lang="en" smooth="true"/>' + cuerpo + '<feed line="3"/><cut type="feed"/>'
    + '</epos-print></s:Body></s:Envelope>';
}
function tkLogo(){ return '<text align="center"/>' + `<image width="${LOGO_TICKET.w}" height="${LOGO_TICKET.h}" color="color_1" mode="mono">${LOGO_TICKET.data}</image>` + '<feed line="1"/>'; }
function tkTitulo(txt){ return '<text align="center" dw="true" dh="true" em="true"/>' + `<text>${tkTexto(txt + '\n')}</text>` + '<text dw="false" dh="false" em="false"/>'; }
function armarMermaXML(t){
  const raya = '-'.repeat(TK_COLS) + '\n';
  let cuerpo = '', piezas = 0;
  t.items.forEach(it=>{ piezas += Number(it.cantidad)||0; cuerpo += tkFila(`${it.cantidad} ${it.nombre}`, tkPesos(it.precio * it.cantidad)) + '\n'; });
  return tkSobre(tkLogo() + tkTitulo('MERMA')
    + `<text>${tkTexto(tkFechaTxt(t.fecha) + '\n' + (t.folio ? 'Folio ' + t.folio + '\n' : ''))}</text>`
    + `<text>${tkTexto(tkBloque(raya + cuerpo + raya + tkFila(piezas + (piezas === 1 ? ' pieza' : ' piezas'), tkPesos(t.valor)) + '\n'))}</text>`);
}
function armarTicketXML(t){
  if(t.tipo === 'merma') return armarMermaXML(t);
  const f = t.fecha;
  const fechaTxt = tkFechaTxt(f);
  const soloCortesia = t.cort > 0 && t.total <= 0 && !t.items.some(it=> it.tipo !== 'local');
  const raya = '-'.repeat(TK_COLS) + '\n';
  let cuerpo = '';
  t.items.forEach(it=>{
    if(it.tipo === 'local'){
      cuerpo += tkFila(`${it.cantidad} ${it.nombre}`, tkPesos(it.precio * it.cantidad)) + '\n';
      if(it.cortesia) cuerpo += tkFila('   Cortesía', '-' + tkPesos(it.precio * it.cantidad)) + '\n';
    } else {
      cuerpo += 'Pedido: ' + String(it.nombre).slice(0, TK_COLS - 8) + '\n';
      const lineas = (it.lineas && it.lineas.length) ? it.lineas : [{ txt: it.detalle || 'Pedido', monto: it.total != null ? it.total : it.cobrado }];
      lineas.forEach(l=> cuerpo += tkFila('  ' + l.txt, tkPesos(l.monto)) + '\n');
      if(it.entregaTxt) cuerpo += '  Entrega: ' + it.entregaTxt + '\n';
    }
  });
  // Lo del pedido se muestra a precio completo; lo que ya se había pagado se resta aparte
  const peds = t.items.filter(it=> it.tipo === 'pedido');
  const totalPedidos = peds.reduce((a, it)=> a + (it.total != null ? it.total : it.cobrado), 0);
  const pagadoAntes = peds.reduce((a, it)=> a + Math.min(it.pagadoAntes || 0, it.total != null ? it.total : 0), 0);
  const montoBase = peds.reduce((a, it)=> a + (it.montoBase || 0), 0);   // lo que de esos pedidos se iba a cobrar hoy
  const desc = Math.max(0, Math.round((t.subtotal - t.cort - t.total) * 100) / 100);
  const subtotalMostrar = Math.round((t.subtotal - montoBase + totalPedidos) * 100) / 100;
  const totalTicket = Math.max(0, Math.round((subtotalMostrar - t.cort - desc) * 100) / 100);
  let tot = tkFila('Subtotal', tkPesos(subtotalMostrar)) + '\n';
  if(t.cort > 0) tot += tkFila('Cortesía', '-' + tkPesos(t.cort)) + '\n';
  if(desc > 0) tot += tkFila('Descuento', '-' + tkPesos(desc)) + '\n';
  let pago = '';
  if(peds.length){
    const falta = Math.max(0, Math.round((totalTicket - pagadoAntes - t.total) * 100) / 100);
    if(t.comprobante){
      pago += tkFila('Pagado', tkPesos(pagadoAntes)) + '\n';
      if(t.metodoAnticipo) pago += tkFila('Método', formatNombre(t.metodoAnticipo)) + '\n';
    } else {
      if(pagadoAntes > 0) pago += tkFila('Pagado antes', tkPesos(pagadoAntes)) + '\n';
      pago += tkFila('Pago hoy', tkPesos(t.total)) + '\n';
    }
    pago += tkFila(falta > 0 ? 'Falta por pagar' : 'Pagado', falta > 0 ? tkPesos(falta) : 'Completo') + '\n';
  }
  if(t.pagos && t.pagos.length){
    pago += 'Pago diferido\n';
    t.pagos.forEach(x=> pago += tkFila('  ' + formatNombre(x.metodo), tkPesos(x.monto)) + '\n');
  } else if(t.metodo) pago += tkFila('Método', formatNombre(t.metodo)) + '\n';
  if(t.recibe > 0) pago += tkFila('Recibe', tkPesos(t.recibe)) + '\n' + tkFila('Cambio', tkPesos(t.cambio != null ? t.cambio : t.recibe - t.total)) + '\n';
  const encabezado = 'WhatsApp 667 139 0756\nAv. Juan de la Barrera 1141, Local 2\nCol. Chapultepec, C.P. 80040\n' + fechaTxt + '\n' + (t.folio ? 'Folio ' + t.folio + '\n' : '');
  return '<?xml version="1.0" encoding="utf-8"?>'
    + '<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/"><s:Body>'
    + '<epos-print xmlns="http://www.epson-pos.com/schemas/2011/03/epos-print">'
    + '<text lang="en" smooth="true"/>'
    + tkLogo()
    + (soloCortesia ? tkTitulo('CORTESÍA') + '<text align="center"/>' : t.comprobante ? tkTitulo('COMPROBANTE') + '<text align="center"/>' : '')
    + `<text>${tkTexto(encabezado)}</text>`
    + '<text align="center"/>'
    + `<text>${tkTexto(tkBloque(raya + cuerpo + raya + tot + raya))}</text>`
    + '<text dw="false" dh="true" em="true"/>'
    + `<text>${tkTexto(tkBloque(tkFila('TOTAL', tkPesos(totalTicket)) + '\n'))}</text>`
    + '<text dw="false" dh="false" em="false"/><feed line="1"/>'
    + (pago ? `<text>${tkTexto(tkBloque(pago))}</text>` : '')
    + '<feed line="1"/><text align="center" dw="true" dh="true" em="true"/>' + `<text>${tkTexto('¡Muchas gracias!\n')}</text>`
    + '<text dw="false" dh="false"/><feed line="1"/>' + `<text>${tkTexto('¡Que lo disfrutes!\n')}</text>` + '<text em="false"/>'

    + '<feed line="3"/><cut type="feed"/>'
    + '</epos-print></s:Body></s:Envelope>';
}
async function imprimirTicket(t){ return enviarEpson(armarTicketXML(t)); }
async function enviarEpson(xml){
  const url = `https://${IMPRESORA_TICKETS}/cgi-bin/epos/service.cgi?devid=local_printer&timeout=10000`;
  const ctrl = new AbortController();
  const corte = setTimeout(()=> ctrl.abort(), 15000);
  try {
    const r = await fetch(url, { method:'POST', body: xml, signal: ctrl.signal,
      headers: { 'Content-Type':'text/xml; charset=utf-8', 'If-Modified-Since':'Thu, 01 Jan 1970 00:00:00 GMT', 'SOAPAction':'""' } });
    const txt = await r.text();
    if(!/success="true"/.test(txt)){
      const cod = (txt.match(/code="([^"]*)"/) || [])[1];
      throw new Error(cod ? 'la impresora respondió ' + cod : 'respuesta inesperada');
    }
  } finally { clearTimeout(corte); }
}
function armarResumenMCXML(d){
  const raya = '-'.repeat(TK_COLS) + '\n';
  const bloque = (titulo, filas) => {
    if(!filas.length) return `${titulo}: nada\n` + raya;
    let t = titulo.toUpperCase() + '\n', q = 0, $ = 0;
    filas.forEach(([n,x])=>{ q += x.q; $ += x.$; t += tkFila(`${x.q} ${n}`, tkPesos(x.$)) + '\n'; });
    return t + tkFila('Total ' + q + (q === 1 ? ' pieza' : ' piezas'), tkPesos($)) + '\n' + raya;
  };
  const hoy = new Date().toLocaleDateString('es-MX', {weekday:'long', day:'numeric', month:'long', year:'numeric'});
  return tkSobre(tkLogo() + tkTitulo('MERMA Y CORTESÍA')
    + `<text>${tkTexto(hoy.charAt(0).toUpperCase() + hoy.slice(1) + '\n')}</text>`
    + `<text>${tkTexto(tkBloque(raya + bloque('Merma', d.merma) + bloque('Cortesía', d.cortesia)))}</text>`);
}
async function responderTicket(si){
  cerrarModal('tk');
  const t = ticketPendiente; ticketPendiente = null;
  if(!si || !t) return;
  const msg = document.getElementById(t.msgId || 'pos-msg');
  msg.className = 'msg ok'; msg.textContent = 'Imprimiendo ticket...';
  try {
    await imprimirTicket(t);
    if(msg.textContent === 'Imprimiendo ticket...'){ msg.className = 'msg'; msg.textContent = ''; }
  } catch(e){
    msg.className = 'msg err';
    msg.textContent = 'No se pudo imprimir el ticket (' + (e.name === 'AbortError' ? 'la impresora no contestó' : e.message) + '). Revisa que la impresora esté prendida y con cable de red. ' + (t.nota || 'La venta sí quedó registrada.');
  }
}
