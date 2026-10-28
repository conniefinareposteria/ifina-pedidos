// Resumen e Historial (solo directora).

function abrirResumen(){
  document.querySelectorAll('nav button').forEach(b=>b.classList.remove('active'));
  document.getElementById('tab-resumen').classList.add('active');
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.getElementById('view-resumen').classList.add('active');
  if(!document.getElementById('resumen-desde').value){
    rangoResumenRapido('semana');
  }
}
function rangoResumenRapido(tipo){
  const hoy = new Date();
  let desde = new Date(hoy);
  let hasta = new Date(hoy);
  if(tipo === 'semana'){
    desde.setDate(hoy.getDate() - hoy.getDay() + 1);
  } else if(tipo === 'mes'){
    desde = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  }
  document.getElementById('resumen-desde').value = fechaStrDesdeDate(desde);
  document.getElementById('resumen-hasta').value = fechaStrDesdeDate(hasta);
  generarResumen();
}
function ponerTabResumen(t){
  document.querySelectorAll('#res-tabs button').forEach(b=>b.classList.toggle('sel', b.dataset.r === t));
  ['todo','local','pedidos'].forEach(k=> document.getElementById('res-panel-' + k).style.display = k === t ? 'block' : 'none');
}
document.querySelectorAll('#res-tabs button').forEach(b=> b.addEventListener('click', ()=> ponerTabResumen(b.dataset.r)));
async function generarResumen(){
  generarResumenTickets();
  return generarResumenBase();
}
// Resumen basado en los tickets del punto de venta (Local) y en los pedidos agendados (Pedidos)
async function generarResumenTickets(){
  const desde = document.getElementById('resumen-desde').value;
  const hasta = document.getElementById('resumen-hasta').value;
  const pL = document.getElementById('res-panel-local'), pP = document.getElementById('res-panel-pedidos'), pT = document.getElementById('res-todo-extra');
  if(!desde || !hasta){ pL.innerHTML = pP.innerHTML = pT.innerHTML = ''; return; }
  pL.innerHTML = pP.innerHTML = pT.innerHTML = '<div class="loading">Calculando...</div>';
  const ini = new Date(desde + 'T00:00:00').toISOString(), fin = new Date(hasta + 'T23:59:59').toISOString();
  const [rv, rp] = await Promise.all([
    sb.from('ventas').select('*').gte('fecha', desde).lte('fecha', hasta),
    sb.from('pedidos').select('*').gte('fecha_entrega', ini).lte('fecha_entrega', fin)
  ]);
  if(rv.error || rp.error){ const m = '<div class="empty">No se pudo calcular: ' + escHtml((rv.error||rp.error).message) + '</div>'; pL.innerHTML = pP.innerHTML = pT.innerHTML = m; return; }
  const ventas = rv.data || [], pedidos = rp.data || [];

  // ---- LOCAL: solo lo que se vende en mostrador (sin lo pagado de pedidos agendados)
  let ventaLocal = 0, tickets = 0, ticketsConPedido = 0;
  const met = { efectivo:0, tarjeta:0, transferencia:0 };
  const prod = {}; let cortN = 0, cort$ = 0, merN = 0, mer$ = 0;
  ventas.forEach(v=>{
    const items = v.items || [];
    const vendidos = items.filter(i=> i.tipo === 'local' && !i.merma && !i.cortesia);
    items.filter(i=> i.tipo === 'local').forEach(i=>{
      const q = Number(i.cantidad)||0, $ = (Number(i.precio)||0) * q;
      if(i.merma){ merN += q; mer$ += $; return; }
      if(i.cortesia){ cortN += q; cort$ += $; return; }
      const k = i.nombre || i.clave; (prod[k] = prod[k] || { q:0, $:0 }); prod[k].q += q; prod[k].$ += $;
    });
    const ml = Number(v.monto_local)||0;
    if(vendidos.length && ml > 0){
      tickets++; ventaLocal += ml;
      repartoVenta(v, ml).forEach(r=>{ if(r.m in met) met[r.m] += r.monto; });
      if(items.some(i=> i.tipo === 'pedido')) ticketsConPedido++;
    }
  });
  const promLocal = tickets ? ventaLocal / tickets : 0;
  const ranking = Object.entries(prod).sort((a,b)=> b[1].q - a[1].q);
  const tile = (l, v, sub, azul) => `<div class="total-box${azul ? '' : ' caramelo'}"><div class="tb-label">${l}</div><div class="tb-monto">${v}</div>${sub ? `<div class="tb-sub">${sub}</div>` : ''}</div>`;
  const filasProd = ranking.map(([n, x], i)=> `<tr><td class="num">${i+1}</td><td class="nombre">${escHtml(n)}</td><td class="n">${x.q}</td><td class="n">${fmtDinero(x.$)}</td></tr>`).join('');
  pL.innerHTML = `
    <div class="totales-top">
      ${tile('Venta local', fmtDinero(ventaLocal), `${tickets} ${tickets === 1 ? 'ticket' : 'tickets'}`, true)}
      ${tile('Ticket promedio', fmtDinero(Math.round(promLocal)), 'Solo lo comprado en mostrador')}
      ${tile('Por método', fmtDinero(met.efectivo), `Efectivo · Tarjeta ${fmtDinero(met.tarjeta)} · Transf. ${fmtDinero(met.transferencia)}`)}
      ${tile('Cortesías y merma', cortN + merN + ' piezas', `Cortesía ${cortN} (${fmtDinero(cort$)}) · Merma ${merN} (${fmtDinero(mer$)})`)}
    </div>
    ${ticketsConPedido ? `<div class="hint" style="margin:-10px 0 14px;">${ticketsConPedido} ${ticketsConPedido === 1 ? 'cliente llegó' : 'clientes llegaron'} por un pedido y además compró en mostrador (solo cuenta lo de mostrador).</div>` : ''}
    <div class="seccion-resumen"><h3>Lo que más se vende en el local</h3>
      ${filasProd ? `<div class="tabla-wrap" style="max-width:720px;"><table class="tabla-pedidos"><thead><tr><th>#</th><th>Producto</th><th class="n">Piezas</th><th class="n">Total</th></tr></thead><tbody>${filasProd}</tbody></table></div>` : '<div class="empty">Sin ventas de mostrador en este rango.</div>'}
    </div>`;

  // ---- PEDIDOS: lo agendado para entregar en el rango
  let totPed = 0, cobradoPed = 0;
  const porCat = {}, porProd = {};
  pedidos.forEach(p=>{
    const t = Number(p.precio)||0; totPed += t; cobradoPed += Math.min(t, pagadoDe(p));
    const c = {pastel:'Pastel', cupcake:'Cupcakes', individual:'Cuchareables', panque:'Panqués'}[p.categoria] || p.categoria || 'Otro';
    (porCat[c] = porCat[c] || { n:0, $:0 }); porCat[c].n++; porCat[c].$ += t;
    const k = p.categoria === 'pastel' ? `Pastel ${formatNombre(p.tamano_o_sabor)} ${formatNombre(p.sabor)}` : (p.sabor || c);
    (porProd[k] = porProd[k] || { n:0, $:0 }); porProd[k].n++; porProd[k].$ += t;
  });
  const cobradoLocalPed = ventas.reduce((a,v)=> a + (Number(v.monto_pedidos)||0), 0);
  const promPed = pedidos.length ? totPed / pedidos.length : 0;
  const filasCat = Object.entries(porCat).sort((a,b)=> b[1].$ - a[1].$).map(([n,x])=> `<tr><td class="nombre">${escHtml(n)}</td><td class="n">${x.n}</td><td class="n">${fmtDinero(x.$)}</td></tr>`).join('');
  const filasPP = Object.entries(porProd).sort((a,b)=> b[1].n - a[1].n).map(([n,x],i)=> `<tr><td class="num">${i+1}</td><td class="nombre">${escHtml(n)}</td><td class="n">${x.n}</td><td class="n">${fmtDinero(x.$)}</td></tr>`).join('');
  pP.innerHTML = `
    <div class="totales-top">
      ${tile('Pedidos agendados', fmtDinero(totPed), `${pedidos.length} ${pedidos.length === 1 ? 'pedido' : 'pedidos'}`, true)}
      ${tile('Ticket promedio', fmtDinero(Math.round(promPed)), 'Por pedido')}
      ${tile('Cobrado', fmtDinero(cobradoPed), `Falta por cobrar ${fmtDinero(Math.max(0, totPed - cobradoPed))}`)}
      ${tile('Cobrado en el local', fmtDinero(cobradoLocalPed), 'Pagos de pedidos en el punto de venta')}
    </div>
    <div class="grid-historial">
      <div class="seccion-resumen"><h3>Por categoría</h3>${filasCat ? `<div class="tabla-wrap"><table class="tabla-pedidos"><thead><tr><th>Categoría</th><th class="n">Pedidos</th><th class="n">Total</th></tr></thead><tbody>${filasCat}</tbody></table></div>` : '<div class="empty">Sin pedidos en este rango.</div>'}</div>
      <div class="seccion-resumen"><h3>Lo que más se pide</h3>${filasPP ? `<div class="tabla-wrap"><table class="tabla-pedidos"><thead><tr><th>#</th><th>Producto</th><th class="n">Pedidos</th><th class="n">Total</th></tr></thead><tbody>${filasPP}</tbody></table></div>` : '<div class="empty">Sin pedidos en este rango.</div>'}</div>
    </div>`;

  // ---- TODO: combinado
  const nTot = tickets + pedidos.length;
  const promTodo = nTot ? (ventaLocal + totPed) / nTot : 0;
  const top = {};
  Object.entries(prod).forEach(([n,x])=>{ (top[n] = top[n] || { q:0, $:0 }); top[n].q += x.q; top[n].$ += x.$; });
  Object.entries(porProd).forEach(([n,x])=>{ (top[n] = top[n] || { q:0, $:0 }); top[n].q += x.n; top[n].$ += x.$; });
  const filasTop = Object.entries(top).sort((a,b)=> b[1].q - a[1].q).slice(0, 10).map(([n,x],i)=> `<tr><td class="num">${i+1}</td><td class="nombre">${escHtml(n)}</td><td class="n">${x.q}</td><td class="n">${fmtDinero(x.$)}</td></tr>`).join('');
  pT.innerHTML = `
    <div class="totales-top">
      ${tile('Ticket promedio general', fmtDinero(Math.round(promTodo)), `${nTot} clientes (${tickets} de mostrador · ${pedidos.length} pedidos)`, true)}
      ${tile('Ticket promedio local', fmtDinero(Math.round(promLocal)), 'Solo mostrador')}
      ${tile('Ticket promedio pedidos', fmtDinero(Math.round(promPed)), 'Por pedido agendado')}
    </div>
    <div class="seccion-resumen"><h3>Top 10 de lo que más sale</h3>
      ${filasTop ? `<div class="tabla-wrap" style="max-width:720px;"><table class="tabla-pedidos"><thead><tr><th>#</th><th>Producto</th><th class="n">Piezas / pedidos</th><th class="n">Total</th></tr></thead><tbody>${filasTop}</tbody></table></div>` : '<div class="empty">Sin ventas en este rango.</div>'}
    </div>`;
}
async function generarResumenBase(){
  const desde = document.getElementById('resumen-desde').value;
  const hasta = document.getElementById('resumen-hasta').value;
  const cont = document.getElementById('resumen-contenido');
  cont.innerHTML = '<div class="loading">Calculando...</div>';

  if(!desde || !hasta){
    cont.innerHTML = '<div class="empty">Selecciona un rango de fechas.</div>';
    return;
  }

  const inicioRango = new Date(desde + 'T00:00:00').toISOString();
  const finRango = new Date(hasta + 'T23:59:59').toISOString();
  const [resCierres, resPedidos] = await Promise.all([
    sb.from('cierres_dia').select('*').gte('fecha', desde).lte('fecha', hasta),
    sb.from('pedidos').select('*').gte('fecha_entrega', inicioRango).lte('fecha_entrega', finRango).order('fecha_entrega', {ascending:true})
  ]);
  const errorRango = resCierres.error || resPedidos.error;
  if(errorRango){
    cont.innerHTML = '<div class="empty">Error: ' + escHtml(errorRango.message) + '</div>';
    return;
  }
  const data = resCierres.data || [];
  const pedidosRango = resPedidos.data || [];
  if(data.length === 0 && pedidosRango.length === 0){
    cont.innerHTML = '<div class="empty">No hay información capturada en ese rango.</div>';
    return;
  }

  if(catalogosListos) await catalogosListos;
  const LISTA_IND = INDIVIDUAL_PRODUCTOS.slice();
  const cupcakePrecio = (individualesData.find(r=>r.nombre==='cupcake')||{}).precio || 0;
  const precioMini = (tamanosData.find(r=>r.tamano==='mini')||{}).precio || 0;
  const precioChico = (tamanosData.find(r=>r.tamano==='chico')||{}).precio || 0;

  const vendidosCupcakes = {};
  CUPCAKE_SABORES.forEach(n=>vendidosCupcakes[n]=0);
  const vendidosIndividuales = {};
  LISTA_IND.forEach(n=>vendidosIndividuales[n]=0);
  const LISTA_PAN = PANQUE_PRODUCTOS.slice();
  const vendidosPanques = {};
  LISTA_PAN.forEach(n=>vendidosPanques[n]=0);
  const vendidosPasteles = {};
  PASTEL_SABORES.forEach(n=>vendidosPasteles[n]={mini:0,chico:0});

  let ventaEfectivoBruto=0, ventaTarjeta=0, ventaTransferencia=0, ventaLocal=0, ventaPedidos=0;
  let diasCerrados = 0;

  data.forEach(dia=>{
    if(dia.cerrado) diasCerrados++;

    CUPCAKE_SABORES.forEach(nombre=>{
      const it = (dia.cupcakes && dia.cupcakes[nombre]) || {};
      vendidosCupcakes[nombre] += Math.max(0, (it.exis||0)+(it.in||0)-(it.cierre||0)-(it.merma||0)-(it.cortesia||0));
    });

    // Los nombres viejos del historial se juntan con el nombre actual; los que ya no existen se ignoran
    Object.entries(dia.individuales || {}).forEach(([n, it])=>{
      const nombre = nombreActual(n, LISTA_IND); if(!nombre) return;
      vendidosIndividuales[nombre] += Math.max(0, (it.exis||0)+(it.in||0)-(it.cierre||0)-(it.merma||0)-(it.cortesia||0));
    });

    Object.entries(dia.panques || {}).forEach(([n, it])=>{
      const nombre = nombreActual(n, LISTA_PAN); if(!nombre) return;
      vendidosPanques[nombre] += Math.max(0, (it.exis||0)+(it.in||0)-(it.cierre||0)-(it.merma||0)-(it.cortesia||0));
    });

    PASTEL_SABORES.forEach(nombre=>{
      const it = (dia.pasteles && dia.pasteles[nombre]) || {};
      const mini = it.mini || {}; const chico = it.chico || {};
      vendidosPasteles[nombre].mini += Math.max(0, (mini.exis||0)+(mini.in||0)-(mini.cierre||0)-(mini.merma||0)-(mini.cortesia||0));
      vendidosPasteles[nombre].chico += Math.max(0, (chico.exis||0)+(chico.in||0)-(chico.cierre||0)-(chico.merma||0)-(chico.cortesia||0));
    });

    const cc = dia.corte_caja || {};
    ventaEfectivoBruto += cc.venta_efectivo||0;
    ventaTarjeta += cc.venta_tarjeta||0;
    ventaTransferencia += cc.venta_transferencia||0;
    ventaLocal += cc.venta_local||0;
    ventaPedidos += cc.venta_pedidos||0;
  });

  const totalCajaCrudo = data.reduce((acc, dia)=> acc + totalVentasCorte(dia.corte_caja), 0);

  // Tablas por sección (mismo formato que el historial)
  const tablaVentas = (titulo, filas, conTamano, nota) => {
    let cuerpo = '', piezas = 0, total = 0;
    filas.forEach(f=>{
      piezas += f.piezas;
      total += f.total || 0;
      cuerpo += `<tr>
        <td class="nombre">${escHtml(f.nombre)}</td>${conTamano ? `<td>${f.tamano}</td>` : ''}
        <td class="n">${f.piezas}</td>
        <td class="n">${f.precio !== null ? fmtDinero(f.precio) : '<span style="color:var(--jam-deep);">Sin precio</span>'}</td>
        <td class="n vend">${f.precio !== null ? fmtDinero(f.total) : '—'}</td>
      </tr>`;
    });
    const cols = conTamano ? 5 : 4;
    const cuerpoFinal = cuerpo || `<tr><td colspan="${cols}" style="color:var(--muted); text-align:center;">Sin ventas en el rango</td></tr>`;
    const pieTabla = cuerpo ? `<tfoot><tr><td${conTamano ? ' colspan="2"' : ''}>Total</td><td class="n">${piezas}</td><td></td><td class="n">${fmtDinero(total)}</td></tr></tfoot>` : '';
    return `<div>
      <h3>${titulo}</h3>
      <div class="tabla-wrap"><table class="tabla-pedidos">
        <thead><tr><th>${conTamano ? 'Sabor' : 'Producto'}</th>${conTamano ? '<th>Tamaño</th>' : ''}<th class="n">Piezas</th><th class="n">Precio</th><th class="n">Total</th></tr></thead>
        <tbody>${cuerpoFinal}</tbody>${pieTabla}
      </table></div>
      ${nota || ''}
    </div>`;
  };

  // CUPCAKES
  const filasCup = [];
  let totalCupcakesPiezas = 0, totalCupcakesDinero = 0;
  CUPCAKE_SABORES.forEach(nombre=>{
    const v = vendidosCupcakes[nombre];
    if(v<=0) return;
    const dinero = v*cupcakePrecio;
    totalCupcakesPiezas += v; totalCupcakesDinero += dinero;
    filasCup.push({nombre, piezas:v, precio:cupcakePrecio, total:dinero});
  });

  // INDIVIDUALES
  const filasInd = [], faltaPrecio = [];
  let totalIndividualesPiezas = 0, totalIndividualesDinero = 0;
  LISTA_IND.forEach(nombre=>{
    const v = vendidosIndividuales[nombre];
    if(v<=0) return;
    const precio = buscarPrecioIndividualCatalogo(nombre);
    totalIndividualesPiezas += v;
    if(precio !== null){
      totalIndividualesDinero += v*precio;
      filasInd.push({nombre, piezas:v, precio, total:v*precio});
    } else {
      faltaPrecio.push(nombre);
      filasInd.push({nombre, piezas:v, precio:null, total:0});
    }
  });

  // PANQUÉS
  const filasPan = [];
  let totalPanquesPiezas = 0, totalPanquesDinero = 0;
  LISTA_PAN.forEach(nombre=>{
    const v = vendidosPanques[nombre];
    if(v<=0) return;
    const r = panquesData.find(x => formatNombre(x.nombre) === nombre);
    const precio = r ? Number(r.precio) : null;
    totalPanquesPiezas += v;
    if(precio !== null){
      totalPanquesDinero += v*precio;
      filasPan.push({nombre, piezas:v, precio, total:v*precio});
    } else {
      faltaPrecio.push(nombre);
      filasPan.push({nombre, piezas:v, precio:null, total:0});
    }
  });

  // PASTELES
  const filasPas = [];
  let totalPastelesPiezas = 0, totalPastelesDinero = 0;
  PASTEL_SABORES.forEach(nombre=>{
    const vMini = vendidosPasteles[nombre].mini;
    const vChico = vendidosPasteles[nombre].chico;
    if(vMini>0){
      filasPas.push({nombre, tamano:'Mini', piezas:vMini, precio:precioMini, total:vMini*precioMini});
      totalPastelesPiezas += vMini; totalPastelesDinero += vMini*precioMini;
    }
    if(vChico>0){
      filasPas.push({nombre, tamano:'Chico', piezas:vChico, precio:precioChico, total:vChico*precioChico});
      totalPastelesPiezas += vChico; totalPastelesDinero += vChico*precioChico;
    }
  });

  const totalGeneralProduccion = totalCupcakesDinero + totalIndividualesDinero + totalPastelesDinero + totalPanquesDinero;
  const totalPiezas = totalCupcakesPiezas + totalIndividualesPiezas + totalPastelesPiezas + totalPanquesPiezas;
  const notaFalta = faltaPrecio.length ? `<div class="hint" style="color:var(--jam-deep); margin-top:6px;">Faltan en el catálogo: ${faltaPrecio.map(escHtml).join(', ')}</div>` : '';

  // Pedidos agendados del rango, por categoría
  const ped = { pastel:{n:0,$:0}, cupcake:{n:0,$:0}, individual:{n:0,$:0}, panque:{n:0,$:0} };
  let pedidosTotal = 0, pedidosCobrado = 0, pedidosFalta = 0;
  pedidosRango.forEach(p=>{
    const total = Number(p.precio)||0;
    const pagado = pagadoDe(p);
    if(ped[p.categoria]){ ped[p.categoria].n++; ped[p.categoria].$ += total; }
    pedidosTotal += total;
    pedidosCobrado += Math.min(pagado, total);
    pedidosFalta += Math.max(0, total - pagado);
  });

  const totalVendido = totalGeneralProduccion + pedidosTotal;

  const filaDesglose = (nombre, mostrador$, mostradorPzas, pedidos$, pedidosN) => `
    <tr>
      <td class="nombre">${nombre}</td>
      <td class="n">${fmtDinero(mostrador$)}<span class="sub">${mostradorPzas} piezas</span></td>
      <td class="n">${fmtDinero(pedidos$)}<span class="sub">${pedidosN} ${pedidosN === 1 ? 'pedido' : 'pedidos'}</span></td>
      <td class="n vend">${fmtDinero(mostrador$ + pedidos$)}</td>
    </tr>`;

  const html = `
    <div style="font-size:13px; color:var(--muted); margin-bottom:12px;">${data.length} día(s) capturados en mostrador · ${diasCerrados} cerrado(s) · ${pedidosRango.length} pedido(s) agendados</div>

    <div class="totales-top">
      <div class="total-box">
        <div class="tb-label">Total vendido (mostrador + pedidos)</div>
        <div class="tb-monto">${fmtDinero(totalVendido)}</div>
      </div>
      <div class="total-box caramelo">
        <div class="tb-label">Mostrador (lo que salió de vitrina)</div>
        <div class="tb-monto">${fmtDinero(totalGeneralProduccion)}</div>
        <div class="tb-sub">${totalPiezas} piezas</div>
      </div>
      <div class="total-box caramelo">
        <div class="tb-label">Pedidos agendados</div>
        <div class="tb-monto">${fmtDinero(pedidosTotal)}</div>
        <div class="tb-sub">Cobrado ${fmtDinero(pedidosCobrado)} · Falta por cobrar ${fmtDinero(pedidosFalta)}</div>
      </div>
      <div class="total-box caramelo">
        <div class="tb-label">Venta reportada en caja (sin ajustar fondos)</div>
        <div class="tb-monto">${fmtDinero(totalCajaCrudo)}</div>
      </div>
    </div>

    <div class="tabla-wrap" style="margin-bottom:8px;">
      <table class="tabla-pedidos">
        <thead><tr><th>Categoría</th><th class="n">Mostrador</th><th class="n">Pedidos</th><th class="n">Total</th></tr></thead>
        <tbody>
          ${filaDesglose('Pasteles', totalPastelesDinero, totalPastelesPiezas, ped.pastel.$, ped.pastel.n)}
          ${filaDesglose('Cupcakes', totalCupcakesDinero, totalCupcakesPiezas, ped.cupcake.$, ped.cupcake.n)}
          ${filaDesglose('Individuales', totalIndividualesDinero, totalIndividualesPiezas, ped.individual.$, ped.individual.n)}
          ${filaDesglose('Panqués', totalPanquesDinero, totalPanquesPiezas, ped.panque.$, ped.panque.n)}
        </tbody>
        <tfoot><tr>
          <td>Total</td>
          <td class="n">${fmtDinero(totalGeneralProduccion)}</td>
          <td class="n">${fmtDinero(pedidosTotal)}</td>
          <td class="n">${fmtDinero(totalVendido)}</td>
        </tr></tfoot>
      </table>
    </div>

    <h2 class="titulo-bloque">Mostrador</h2>
    <div class="hint" style="margin:0 0 14px;">Lo que se vendió de vitrina según Productos del día (existencia + entradas − cierre − merma − cortesía).</div>
    <div class="grid-historial">
      <div class="col-hist">
        ${tablaVentas('Pasteles', filasPas, true)}
        ${tablaVentas('Individuales', filasInd, false, notaFalta)}
        ${tablaVentas('Panqués', filasPan, false)}
      </div>
      <div class="col-hist">
        ${tablaVentas('Cupcakes', filasCup, false)}
      </div>
    </div>

    <h2 class="titulo-bloque">Pedidos agendados</h2>
    <div class="hint" style="margin:0 0 14px;">Pedidos con fecha de entrega dentro del rango.</div>
    <div id="resumen-pedidos"></div>
  `;

  cont.innerHTML = html;
  const contPedidos = document.getElementById('resumen-pedidos');
  if(pedidosRango.length){
    pintarPedidosPorDia(pedidosRango, contPedidos);
  } else {
    contPedidos.className = 'empty';
    contPedidos.textContent = 'No hay pedidos agendados en este rango.';
  }
}
async function abrirHistorial(){
  document.querySelectorAll('nav button').forEach(b=>b.classList.remove('active'));
  document.getElementById('tab-historial').classList.add('active');
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.getElementById('view-historial').classList.add('active');

  const cont = document.getElementById('historial-contenido');
  cont.className = 'loading';
  cont.textContent = 'Cargando historial...';

  const { data, error } = await sb.from('cierres_dia').select('*').order('fecha', {ascending:false}).limit(60);

  if(error){
    cont.className = 'empty';
    cont.textContent = 'No se pudo cargar: ' + error.message;
    return;
  }
  if(!data || data.length===0){
    cont.className = 'empty';
    cont.textContent = 'Todavía no hay días capturados.';
    return;
  }

  const marca = v => v ? '<span class="tag-ok">✓</span>' : '<span style="color:var(--muted);">—</span>';
  let filas = '';
  data.forEach(dia=>{
    const cc = dia.corte_caja || {};
    const totalVentasCrudo = totalVentasCorte(cc);
    const fechaLegible = new Date(dia.fecha + 'T12:00:00').toLocaleDateString('es-MX', {weekday:'long', day:'numeric', month:'long'});
    filas += `
      <tr class="click" onclick="abrirDetalleDia('${dia.fecha}')">
        <td class="nombre">${fechaLegible.charAt(0).toUpperCase()+fechaLegible.slice(1)}</td>
        <td>${dia.cerrado ? '<span class="tag-ok">Cerrado</span>' : '<span class="tag-prog">En progreso</span>'}</td>
        <td class="c">${marca(dia.cupcakes_listo)}</td>
        <td class="c">${marca(dia.individuales_listo)}</td>
        <td class="c">${marca(dia.pasteles_listo)}</td>
        <td class="c">${marca(dia.panques_listo)}</td>
        <td class="c">${marca(dia.caja_listo)}</td>
        <td class="n">${fmtDinero(totalVentasCrudo)}</td>
        <td class="c" style="color:var(--jam-deep); font-weight:700;">›</td>
      </tr>`;
  });

  cont.className = '';
  cont.innerHTML = `
    <div class="tabla-wrap">
      <table class="tabla-pedidos">
        <thead><tr>
          <th>Fecha</th><th>Estado</th><th class="c">Cupcakes</th><th class="c">Individuales</th><th class="c">Pasteles</th><th class="c">Panqués</th><th class="c">Caja</th><th class="n">Ventas del día</th><th></th>
        </tr></thead>
        <tbody>${filas}</tbody>
      </table>
    </div>`;
}
function tablaInventario(titulo, listo, filas, conTamano){
  // filas: [{nombre, tamano?, exis, in, cierre, merma}]
  const encabezado = `<th>${conTamano ? 'Sabor' : 'Producto'}</th>${conTamano ? '<th>Tamaño</th>' : ''}<th class="n">Exis</th><th class="n">IN</th><th class="n">Cierre</th><th class="n">Merma</th><th class="n">Cortesía</th><th class="n">Vendidos</th>`;
  let cuerpo = '';
  const tot = {exis:0, in:0, cierre:0, merma:0, cortesia:0, vend:0};
  filas.forEach(f=>{
    const v = vendidosDe(f);
    tot.exis += f.exis||0; tot.in += f.in||0; tot.cierre += f.cierre||0; tot.merma += f.merma||0; tot.cortesia += f.cortesia||0; tot.vend += v;
    cuerpo += `<tr>
      <td class="nombre">${escHtml(f.nombre)}</td>${conTamano ? `<td>${f.tamano}</td>` : ''}
      <td class="n">${f.exis||0}</td><td class="n">${f.in||0}</td><td class="n">${f.cierre||0}</td><td class="n">${f.merma||0}</td><td class="n">${f.cortesia||0}</td>
      <td class="n vend">${v}</td>
    </tr>`;
  });
  const cuerpoFinal = cuerpo || `<tr><td colspan="${conTamano ? 8 : 7}" style="color:var(--muted); text-align:center;">Sin captura este día</td></tr>`;
  const pieTabla = cuerpo ? `<tfoot><tr><td${conTamano ? ' colspan="2"' : ''}>Total</td><td class="n">${tot.exis}</td><td class="n">${tot.in}</td><td class="n">${tot.cierre}</td><td class="n">${tot.merma}</td><td class="n">${tot.cortesia}</td><td class="n">${tot.vend}</td></tr></tfoot>` : '';
  return `<div>
    <h3>${titulo} ${listo ? '<span class="tag-ok">✓</span>' : ''}</h3>
    <div class="tabla-wrap"><table class="tabla-pedidos">
      <thead><tr>${encabezado}</tr></thead>
      <tbody>${cuerpoFinal}</tbody>${pieTabla}
    </table></div>
  </div>`;
}
async function abrirDetalleDia(fecha){
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.getElementById('view-historial-detalle').classList.add('active');

  const fechaLegible = new Date(fecha + 'T12:00:00').toLocaleDateString('es-MX', {weekday:'long', day:'numeric', month:'long', year:'numeric'});
  document.getElementById('historial-detalle-titulo').textContent = fechaLegible.charAt(0).toUpperCase()+fechaLegible.slice(1);

  const cont = document.getElementById('historial-detalle-contenido');
  cont.innerHTML = '<div class="loading">Cargando...</div>';

  const { data, error } = await sb.from('cierres_dia').select('*').eq('fecha', fecha).maybeSingle();
  if(error || !data){
    cont.innerHTML = '<div class="empty">No se pudo cargar el detalle.</div>';
    return;
  }

  const tieneDatos = it => it && (it.in || it.exis || it.cierre || it.merma || it.cortesia);

  const filasCup = CUPCAKE_SABORES
    .map(n => ({nombre:n, ...((data.cupcakes && data.cupcakes[n]) || {})}))
    .filter(tieneDatos);

  if(catalogosListos) await catalogosListos;
  const filasInd = [...new Set([...INDIVIDUAL_PRODUCTOS, ...Object.keys(data.individuales || {})])]
    .map(n => ({nombre:n, ...((data.individuales && data.individuales[n]) || {})}))
    .filter(tieneDatos);

  const filasPan = [...new Set([...PANQUE_PRODUCTOS, ...Object.keys(data.panques || {})])]
    .map(n => ({nombre:n, ...((data.panques && data.panques[n]) || {})}))
    .filter(tieneDatos);

  const filasPas = [];
  PASTEL_SABORES.forEach(n=>{
    const it = (data.pasteles && data.pasteles[n]) || {};
    if(tieneDatos(it.mini)) filasPas.push({nombre:n, tamano:'Mini', ...it.mini});
    if(tieneDatos(it.chico)) filasPas.push({nombre:n, tamano:'Chico', ...it.chico});
  });

  // Corte de caja
  const cc = data.corte_caja || {};
  const totalVentasCrudo = totalVentasCorte(cc);
  const filaCaja = (concepto, monto, fuerte) =>
    `<tr><td${fuerte ? ' style="font-weight:700;"' : ''}>${concepto}</td><td class="n"${fuerte ? ' style="font-weight:700; color:var(--jam-deep);"' : ''}>${fmtDinero(monto)}</td></tr>`;

  const denom = cc.denominaciones || {};
  let filasDenom = '', totalContado = 0;
  DENOMINACIONES.forEach(d=>{
    const cant = Number(denom[d])||0;
    if(!cant) return;
    totalContado += cant*d;
    filasDenom += `<tr><td>$${d}</td><td class="n">${cant}</td><td class="n">${fmtDinero(cant*d)}</td></tr>`;
  });

  const bloqueCaja = `<div class="bloque-caja grid-historial" style="display:block;">
    <h3>Corte de caja ${data.caja_listo ? '<span class="tag-ok">✓</span>' : ''}</h3>
    <div class="grid-caja">
      <div class="tabla-wrap"><table class="tabla-pedidos">
        <thead><tr><th>Concepto</th><th class="n">Monto</th></tr></thead>
        <tbody>
          ${cc.version === 2 ? `
          ${filaCaja('Efectivo', cc.venta_efectivo)}
          ${filaCaja('Tarjeta', cc.venta_tarjeta)}
          ${filaCaja('Transferencia', cc.venta_transferencia)}
          ${filaCaja('Total por método de pago', (cc.venta_efectivo||0)+(cc.venta_tarjeta||0)+(cc.venta_transferencia||0), true)}
          ${filaCaja('Venta local (mostrador)', cc.venta_local)}
          ${filaCaja('Venta de pedidos', cc.venta_pedidos)}
          ${filaCaja('Total por tipo de venta', (cc.venta_local||0)+(cc.venta_pedidos||0), true)}
          ${filaCaja('Anticipos recibidos (no cuentan como venta)', ((cc.anticipos||{}).efectivo||0)+((cc.anticipos||{}).tarjeta||0)+((cc.anticipos||{}).terminal||0)+((cc.anticipos||{}).transferencia||0))}` : `
          ${filaCaja('Venta en efectivo', cc.venta_efectivo)}
          ${filaCaja('Venta en tarjeta', cc.venta_tarjeta)}
          ${filaCaja('Venta en transferencia', cc.venta_transferencia)}
          ${filaCaja('Venta local', cc.venta_local)}
          ${filaCaja('Venta pedidos', cc.venta_pedidos)}
          ${filaCaja('Total ventas (sin ajustar fondo)', totalVentasCrudo, true)}`}
          ${filaCaja('Fondo de caja dejado', cc.fondo_caja)}
          ${filaCaja('Gastos', cc.gastos)}
        </tbody>
      </table></div>
      ${filasDenom ? `
      <div class="tabla-wrap"><table class="tabla-pedidos">
        <thead><tr><th>Billete / moneda</th><th class="n">Cantidad</th><th class="n">Total</th></tr></thead>
        <tbody>${filasDenom}</tbody>
        <tfoot><tr><td colspan="2">Total contado</td><td class="n">${fmtDinero(totalContado)}</td></tr></tfoot>
      </table></div>` : '<div style="color:var(--muted); font-size:13px;">No se capturó el conteo de billetes y monedas.</div>'}
    </div>
  </div>`;

  cont.innerHTML = `
    <div class="grid-historial">
      <div class="col-hist">
        ${tablaInventario('Pasteles', data.pasteles_listo, filasPas, true)}
        ${tablaInventario('Individuales', data.individuales_listo, filasInd, false)}
        ${tablaInventario('Panqués', data.panques_listo, filasPan, false)}
      </div>
      <div class="col-hist">
        ${tablaInventario('Cupcakes', data.cupcakes_listo, filasCup, false)}
      </div>
    </div>
    ${bloqueCaja}`;
}
