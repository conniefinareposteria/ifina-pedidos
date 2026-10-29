// Punto de venta (colaborador): venta, pedidos de hoy, coronas, cortesía, merma, anticipo, pago diferido.

let posTab = 'cupcakes';
let posVenta = [];          // [{tipo:'local', cat, clave, tam, nombre, precio, cantidad} | {tipo:'pedido', pedido_id, nombre, detalle, total, falta}]
let posMetodo = null;
let posStock = {};          // posStock[cat][clave|tam] = disponibles (sin contar la venta actual)
let posHayCierre = false;
let posPedidos = [];
let posTotalManual = false;
let posGuardando = false;
let posEditando = null;      // ticket que se está editando: {id, creado, total, metodo}

function posEnVenta(cat, clave, tam){
  return posVenta.filter(x=>x.tipo==='local' && x.cat===cat && x.clave===clave && (x.tam||'')===(tam||''))
    .reduce((a, x)=> a + x.cantidad, 0);
}
function posDisponible(cat, clave, tam){
  const base = ((posStock[cat]||{})[clave + '|' + (tam||'')]) || 0;
  return base - posEnVenta(cat, clave, tam);
}
async function abrirPOS(){
  document.querySelectorAll('nav button').forEach(b=>b.classList.remove('active'));
  document.getElementById('tab-pos').classList.add('active');
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.getElementById('view-pos').classList.add('active');
  window.scrollTo(0,0);
  document.getElementById('pos-fecha').textContent = new Date().toLocaleDateString('es-MX',{weekday:'long', day:'numeric', month:'long'});
  pintarVenta();
  await cargarDatosPOS();
}
async function cargarDatosPOS(){
  const cont = document.getElementById('pos-contenido');
  cont.className = 'loading'; cont.textContent = 'Cargando...';
  if(catalogosListos) await catalogosListos;
  const fecha = fechaHoyStr();
  const [rango0, rango1] = rangoHoyISO();
  const [cierre, ventas, peds] = await Promise.all([
    sb.from('cierres_dia').select('*').eq('fecha', fecha).maybeSingle(),
    sb.from('ventas').select('id,items').eq('fecha', fecha),
    sb.rpc('pedidos_entrega_hoy', { desde: rango0, hasta: rango1 })
  ]);
  if(ventas.error || peds.error){
    cont.className = 'empty';
    cont.textContent = 'No se pudo cargar el punto de venta: ' + (ventas.error || peds.error).message + ' (revisa que ya se haya corrido el SQL del punto de venta).';
    return;
  }
  // Existencia = lo que quedó del último día + IN de hoy, menos lo ya vendido hoy en el punto de venta
  let base;
  try { base = await existenciaInicial(fecha); }
  catch(e){ cont.className = 'empty'; cont.textContent = 'No se pudieron calcular las existencias: ' + e.message; return; }
  posStock = {}; posHayCierre = true;
  Object.keys(POS_CATS).forEach(cat=>{
    posStock[cat] = {};
    const datos = (cierre.data && cierre.data[cat]) || {};
    posItemsCat(cat).forEach(nombre=>{
      if(cat === 'pasteles'){
        ['mini','chico'].forEach(tam=>{
          const d = (datos[nombre]||{})[tam] || {};
          posStock[cat][nombre + '|' + tam] = (base[cat][nombre + '|' + tam] || 0) + (Number(d.in)||0);
        });
      } else {
        const d = datos[nombre] || {};
        posStock[cat][nombre + '|'] = (base[cat][nombre + '|'] || 0) + (Number(d.in)||0);
      }
    });
  });
  // Si se está editando un ticket, sus productos cuentan como disponibles otra vez (están en la venta actual)
  (ventas.data||[]).forEach(v=>(posEditando && v.id === posEditando.id ? [] : (v.items||[])).forEach(it=>{
    if(it.tipo !== 'local' || !posStock[it.cat]) return;
    const k = it.clave + '|' + (it.tam||'');
    posStock[it.cat][k] = (posStock[it.cat][k]||0) - (Number(it.cantidad)||0);
  }));
  posPedidos = peds.data || [];
  const pend = posPedidos.filter(p=>!p.entregado).length;
  const b = document.getElementById('pos-badge-ped');
  b.style.display = pend ? 'inline-block' : 'none'; b.textContent = pend;
  pintarCatalogoPOS();
}
function ponerTabPOS(t){ posTab = t; pintarCatalogoPOS(); }
document.querySelectorAll('#pos-tabs .pos-tab').forEach(el=> el.addEventListener('click', ()=> ponerTabPOS(el.dataset.t)));
function pintarCatalogoPOS(){
  document.querySelectorAll('#pos-tabs .pos-tab').forEach(el=>el.classList.toggle('sel', el.dataset.t === posTab));
  const cont = document.getElementById('pos-contenido');
  document.getElementById('pos-buscar-wrap').style.display = posTab === 'pedidos' ? 'block' : 'none';
  if(posTab === 'pedidos') return pintarPedidosPOS(cont);
  if(!posHayCierre){
    cont.className = 'empty';
    cont.textContent = 'Todavía no se captura el Inicio de hoy en Productos del día. En cuanto se capture, aquí aparecen los productos disponibles.';
    return;
  }
  cont.className = 'pos-pgrid'; cont.innerHTML = '';
  const cat = posTab;
  let hay = 0;
  posItemsCat(cat).forEach(nombre=>{
    if(cat === 'pasteles'){
      const dm = posDisponible(cat, nombre, 'mini'), dc = posDisponible(cat, nombre, 'chico');
      const baseM = (posStock[cat][nombre+'|mini']||0), baseC = (posStock[cat][nombre+'|chico']||0);
      if(baseM <= 0 && baseC <= 0) return;
      hay++;
      const card = document.createElement('div'); card.className = 'pos-pastel';
      card.innerHTML = `<div class="nm">${escHtml(nombre)}</div><div class="pos-tam"></div>`;
      const wrap = card.querySelector('.pos-tam');
      [['mini',etiquetaTamano('mini'),dm],['chico',etiquetaTamano('chico'),dc]].forEach(([tam, lbl, disp])=>{
        const precio = posPrecio(cat, nombre, tam);
        const en = posEnVenta(cat, nombre, tam);
        const btn = document.createElement('button'); btn.type = 'button';
        if(en) btn.className = 'en';
        btn.disabled = disp <= 0;
        btn.innerHTML = `${lbl}<b>${precio == null ? 'Sin precio' : fmtDinero(precio)}</b><small>${disp <= 0 ? (en ? 'Ya no quedan' : 'Sin existencia') : (disp === 1 ? 'Queda 1' : 'Quedan ' + disp)}${en ? ' · ' + en + ' en venta' : ''}</small>`;
        btn.onclick = ()=> preguntarCorona(nombre, tam);
        wrap.appendChild(btn);
      });
      cont.appendChild(card);
    } else {
      const base = posStock[cat][nombre+'|'] || 0;
      if(base <= 0) return;
      hay++;
      const disp = posDisponible(cat, nombre, '');
      const en = posEnVenta(cat, nombre, '');
      const precio = posPrecio(cat, nombre, '');
      const card = document.createElement('button'); card.type = 'button';
      card.className = 'pos-card' + (en ? ' en' : '') + (disp <= 0 ? ' agotado' : '');
      card.innerHTML = `<div class="nm">${escHtml(nombre)}</div><div class="bt"><div><div class="pr">${precio == null ? 'Sin precio' : fmtDinero(precio)}</div>
        <div class="st">${disp <= 0 ? 'Ya no quedan' : (disp === 1 ? 'Queda 1' : 'Quedan ' + disp)}</div></div>${en ? `<span class="bdg">${en}</span>` : ''}</div>`;
      card.onclick = ()=> { if(disp > 0) agregarAVenta(cat, nombre, ''); };
      cont.appendChild(card);
    }
  });
  if(!hay){ cont.className = 'empty'; cont.textContent = 'No hay ' + POS_CATS[cat].titulo.toLowerCase() + ' en existencia hoy.'; }
  if(cat === 'pasteles'){
    const info = document.createElement('div');
    info.className = 'hint';
    info.style.gridColumn = '1/-1';
    const cm = posDisponible('coronas','Mini',''), cn = posDisponible('coronas','Normal','');
    info.textContent = `Coronas disponibles: mini ${cm} · normal ${cn}`;
    cont.prepend(info);
  }
}
function detallePedidoPOS(p){
  const producto = {pastel:'Pastel', cupcake:'Cupcakes', individual:'Cuchareables', panque:'Panqués'}[p.categoria] || p.categoria || '';
  const det = p.categoria === 'pastel' ? [formatNombre(p.tamano_o_sabor), formatNombre(p.sabor)].filter(Boolean).join(' · ') : (p.sabor || '');
  return producto + (det ? ' · ' + det : '');
}
let posBusqueda = null;   // resultados de búsqueda de pedidos de otros días
let posBuscarTimer = null;
document.getElementById('pos-buscar').addEventListener('input', ()=>{
  clearTimeout(posBuscarTimer);
  posBuscarTimer = setTimeout(buscarPedidosPOS, 250);
});
async function buscarPedidosPOS(){
  const texto = document.getElementById('pos-buscar').value.trim();
  if(texto.length < 2){ posBusqueda = null; if(posTab === 'pedidos') pintarCatalogoPOS(); return; }
  const { data, error } = await sb.rpc('buscar_pedidos_pos', { q: texto });
  if(document.getElementById('pos-buscar').value.trim() !== texto) return;
  // En la búsqueda salen todos (también domicilio y casa) para poder cobrarlos
  posBusqueda = error ? { error: error.message } : (data || []);
  if(posTab === 'pedidos') pintarCatalogoPOS();
}
function filaPedidoPOS(p, conFecha){
  const tot = Number(p.precio)||0, falta = Math.max(0, tot - pagadoDe(p));
  const enVenta = posVenta.some(x=>x.tipo==='pedido' && x.pedido_id === p.id);
  const d = p.fecha_entrega ? new Date(p.fecha_entrega) : null;
  const hora = d ? d.toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'}) : '';
  const fecha = d && conFecha ? d.toLocaleDateString('es-MX',{weekday:'short', day:'numeric', month:'short'}) : '';
  const sub = p.entregado
    ? 'Entregado ' + (p.entregado_at ? new Date(p.entregado_at).toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'}) : '') + (p.metodo_entrega && Number(p.pago_entrega) > 0 ? ' · ' + formatNombre(p.metodo_entrega) : '')
    : [textoCorona(p), p.notas].filter(Boolean).join(' · ');
  const est = p.entregado ? '<span class="pos-est ok">✓ Finalizado</span>'
    : enVenta ? '<span class="pos-est sel">En la venta</span>'
    : falta > 0 ? '<span class="pos-est pend">Pendiente</span>' : '<span class="pos-est pend">Por entregar</span>';
  const esLocalP = esEntregaLocal(p);
  const puedeEditar = POS_EDITAR_ACTIVO && (p.entregado || esLocalP);
  const row = document.createElement('div');
  row.className = 'pos-prow' + (p.entregado ? ' fin' : '') + (enVenta ? ' sel' : '');
  row.innerHTML = `<div><b>${fecha ? escHtml(fecha) : hora}</b>${fecha ? `<small>${hora}</small>` : ''}</div>
    <div><b>${escHtml(p.nombre_cliente || 'Sin nombre')}</b><small>${escHtml(p.telefono || '')}</small></div>
    <div>${escHtml(detallePedidoPOS(p))}<small><b style="color:var(--cocoa);">${p.entrega === 'domicilio' ? 'Domicilio' : p.entrega === 'casa' ? 'Recoger en casa' : 'Recoge en local'}</b>${sub ? ' · ' + escHtml(sub) : ''}</small></div>
    <div class="m">${fmtDinero(tot)}<small>Total · pagó ${fmtDinero(pagadoDe(p))}</small></div>
    <div class="m" style="font-weight:700; color:${falta > 0 && !p.entregado ? 'var(--rojo)' : 'var(--sage)'};">${falta > 0 && !p.entregado ? fmtDinero(falta) + '<small>Falta</small>' : '✓ Pagado<small>Falta $0</small>'}</div>
    <div style="justify-self:end; display:flex; flex-direction:column; align-items:flex-end; gap:6px;">${est}${puedeEditar ? '<a href="#" class="link-accion pos-editar" style="margin:0; font-size:13px;">Editar</a>' : ''}</div>`;
  if(!p.entregado) row.onclick = ()=> alternarPedidoEnVenta(p);
  const be = row.querySelector('.pos-editar');
  if(be) be.onclick = (ev)=>{ ev.preventDefault(); ev.stopPropagation(); editarPedidoPOS(p); };
  return row;
}
const POS_EDITAR_ACTIVO = true;
// ---- Resumen del día en el punto de venta: cada ticket con hora, lo que se llevó y lo que se pagó
async function abrirResumenDiaPOS(){
  const hoy = new Date().toLocaleDateString('es-MX', {weekday:'long', day:'numeric', month:'long'});
  document.getElementById('rd-sub').textContent = hoy.charAt(0).toUpperCase() + hoy.slice(1);
  const lista = document.getElementById('rd-lista'), tot = document.getElementById('rd-totales');
  lista.className = 'loading'; lista.textContent = 'Cargando...'; tot.innerHTML = '';
  abrirModal('rd');
  const { data, error } = await sb.from('ventas').select('*').eq('fecha', fechaHoyStr()).order('created_at', {ascending:false});
  if(error){ lista.className = 'empty'; lista.textContent = 'No se pudo cargar: ' + error.message; return; }
  const ventas = data || [];
  rdVentas = ventas;
  if(!ventas.length){ lista.className = 'empty'; lista.textContent = 'Todavía no hay ventas hoy.'; return; }
  const met = { efectivo:0, tarjeta:0, transferencia:0 };
  let cobrado = 0, nVentas = 0;
  ventas.forEach(v=>{ const t = Number(v.total)||0; cobrado += t; if(t > 0) nVentas++; repartoVenta(v, t).forEach(r=>{ if(r.m in met) met[r.m] += r.monto; }); });
  tot.innerHTML = `<div class="totales-top" style="margin-bottom:14px;">
    <div class="total-box"><div class="tb-label">Cobrado hoy</div><div class="tb-monto">${fmtDinero(cobrado)}</div><div class="tb-sub">${nVentas} ${nVentas === 1 ? 'venta' : 'ventas'}</div></div>
    <div class="total-box caramelo"><div class="tb-label">Por método</div><div class="tb-sub" style="font-size:13.5px; line-height:1.6;">Efectivo ${fmtDinero(met.efectivo)}<br>Tarjeta ${fmtDinero(met.tarjeta)}<br>Transferencia ${fmtDinero(met.transferencia)}</div></div>
  </div>`;
  lista.className = '';
  lista.innerHTML = ventas.map(v=>{
    const items = v.items || [];
    const hora = v.created_at ? new Date(v.created_at).toLocaleTimeString('es-MX', {hour:'2-digit', minute:'2-digit'}) : '';
    const esMerma = items.length && items.every(i=> i.merma);
    const soloCort = !esMerma && items.length && items.every(i=> i.tipo === 'local' && i.cortesia);
    const editable = items.every(i=> i.tipo === 'local' && !i.merma);
    const tag = !items.length ? 'Devuelto' : esMerma ? 'Merma' : soloCort ? 'Cortesía' : (Number(v.total)||0) <= 0 ? 'Entrega' : '';
    const lineas = items.map(i=>{
      if(i.tipo === 'local'){
        const extra = i.merma ? ' (merma)' : i.cortesia ? ' (cortesía)' : '';
        return `<div class="rd-lin"><span>${i.cantidad} ${escHtml(i.nombre || i.clave || '')}${extra}</span><span>${fmtDinero((Number(i.precio)||0) * (Number(i.cantidad)||0))}</span></div>`;
      }
      const que = i.anticipo ? 'Anticipo' : i.entregar ? 'Entregado' : 'Pago';
      return `<div class="rd-lin"><span>Pedido: ${escHtml(i.nombre || '')}${i.detalle ? ' · ' + escHtml(i.detalle) : ''} <i>(${que})</i></span><span>${fmtDinero(i.cobrado)}</span></div>`;
    }).join('');
    const desc = Number(v.descuento)||0;
    return `<div class="rd-venta">
      <div class="rd-cab"><span><b>${hora}</b> · Folio ${v.id}${tag ? `<span class="rd-tag">${tag}</span>` : ''}</span>
        <span><b>${fmtDinero(v.total)}</b>${v.metodo_pago ? ' · ' + escHtml(textoMetodoVenta(v)) : ''}</span></div>
      ${lineas}
      ${desc > 0 && !esMerma ? `<div class="rd-lin"><span>Descuento / cortesía</span><span>-${fmtDinero(desc)}</span></div>` : ''}
      ${editable ? `<div class="rd-acc">${v.editado_at ? '<span class="rd-tag" style="margin:0 8px 0 0; align-self:center;">Editado</span>' : ''}<button type="button" class="rd-editar" data-id="${v.id}">Editar</button></div>` : ''}
    </div>`;
  }).join('');
  lista.querySelectorAll('.rd-editar').forEach(b=> b.onclick = ()=> editarVentaPOS(rdVentas.find(x=> String(x.id) === b.dataset.id)));
}
// ---- Editar un ticket (devolución o cambio): se carga en la venta, se ajusta y se guarda con el mismo folio
let rdVentas = [];
async function editarVentaPOS(v){
  if(!v) return;
  if(posVenta.length && !(posEditando && posEditando.id === v.id)){
    if(!confirm(`Hay una venta en curso. ¿Quitarla para editar el folio ${v.id}?`)) return;
  }
  vaciarVenta(false);
  const items = v.items || [];
  posEditando = { id: v.id, creado: v.created_at ? new Date(v.created_at) : new Date(), total: Number(v.total)||0, metodo: v.metodo_pago || null };
  posVenta = items.map(i=>({ tipo:'local', cat:i.cat, categoria:i.categoria, clave:i.clave, tam:i.tam || null, variante:i.variante || null,
    incluida: !!(i.variante && String(i.variante).endsWith('-incluida')), nombre:i.nombre, precio:Number(i.precio)||0, cantidad:Number(i.cantidad)||0, cortesia: !!i.cortesia }));
  // Descuento que tenía: si era un porcentaje de los botones, se respeta como porcentaje
  const { base } = subtotalesPOS();
  const desc = Math.max(0, Math.round((base - posEditando.total) * 100) / 100);
  const pct = base > 0 ? Math.round(desc / base * 100) : 0;
  if(desc > 0 && [10,15,20,25].includes(pct) && Math.abs(Math.round(base * pct / 100) - desc) < 1) aplicarPct(pct);
  else document.getElementById('pos-descuento').value = desc > 0 ? desc : '';
  alternarPagoDiferido(false);
  posMetodo = posEditando.metodo === 'mixto' ? null : posEditando.metodo;
  document.querySelectorAll('#pos-metodos .pos-chip').forEach(c=> c.classList.toggle('sel', c.dataset.m === posMetodo));
  cerrarModal('rd');
  document.getElementById('pos-msg').className = 'msg';
  pintarVenta();
  await cargarDatosPOS();
}
// Cuánto dinero se mueve con el cambio (para decirle al cajero qué devolver o cobrar)
function filasDiferenciaEdicion(total, metodo){
  const ed = posEditando; if(!ed) return [];
  const orig = ed.total, mOrig = ed.metodo ? formatNombre(ed.metodo) : '', mNuevo = metodo ? formatNombre(metodo) : '';
  if(orig > 0 && total > 0 && ed.metodo !== metodo)
    return [{ que:'Devolver al cliente', como:mOrig, monto:orig }, { que:'Cobrar al cliente', como:mNuevo, monto:total }];
  const dif = Math.round((total - orig) * 100) / 100;
  if(dif > 0) return [{ que:'Cobrar al cliente', como:mNuevo, monto:dif }];
  if(dif < 0) return [{ que:'Devolver al cliente', como:mOrig, monto:-dif }];
  return [{ que:'Sin diferencia', como:'No se cobra ni se devuelve', monto:0 }];
}
function textoDiferenciaEdicion(total, metodo){
  const ed = posEditando; if(!ed) return '';
  const orig = ed.total, mOrig = ed.metodo ? formatNombre(ed.metodo) : '', mNuevo = metodo ? formatNombre(metodo) : '';
  if(orig > 0 && total > 0 && ed.metodo !== metodo)
    return `Devolver ${fmtDinero(orig)} (${mOrig}) y cobrar ${fmtDinero(total)} (${mNuevo})`;
  const dif = Math.round((total - orig) * 100) / 100;
  if(dif > 0) return `Cobrar diferencia: ${fmtDinero(dif)}${mNuevo ? ' (' + mNuevo + ')' : ''}`;
  if(dif < 0) return `Devolver al cliente: ${fmtDinero(-dif)}${mOrig ? ' (' + mOrig + ')' : ''}`;
  return 'Sin diferencia de dinero';
}
function pintarBannerEdicion(){
  const b = document.getElementById('pos-edit-banner');
  document.getElementById('pos-h2-titulo').textContent = posEditando ? `Editando folio ${posEditando.id}` : 'Venta actual';
  const dif = document.getElementById('pos-dif');
  document.getElementById('pos-total-lbl').textContent = posEditando ? 'Nuevo total' : 'Total';
  if(!posEditando){ b.style.display = 'none'; dif.style.display = 'none'; return; }
  const total = Math.max(0, leerNum('pos-total'));
  // Lo importante en una devolución o cambio: cuánto cobrar o devolver, grande junto al total
  dif.style.display = 'block';
  dif.innerHTML = filasDiferenciaEdicion(total, total > 0 ? posMetodo : null).map(f=>
    `<div class="fila"><div class="que">${escHtml(f.que)}${f.como ? `<small>${escHtml(f.como)}</small>` : ''}</div><div class="cuanto">${fmtDinero(f.monto)}</div></div>`).join('');
  b.style.display = 'block';
  b.innerHTML = `Ya había pagado: <b>${fmtDinero(posEditando.total)}</b>${posEditando.metodo ? ' · ' + escHtml(formatNombre(posEditando.metodo)) : ''}<br>
    <span style="font-size:12.5px;">Quita lo que devolvió y agrega lo que se lleva. Lo quitado regresa a existencia.</span>
    <a href="#" id="pos-cancelar-edicion" style="display:block; margin-top:4px;">Cancelar edición</a>`;
  document.getElementById('pos-cancelar-edicion').onclick = (e)=>{ e.preventDefault(); vaciarVenta(); };
}
async function guardarEdicionVenta(){
  const msg = document.getElementById('pos-msg'); msg.className = 'msg';
  const ed = posEditando; if(!ed || posGuardando) return;
  const { cort, subtotal } = subtotalesPOS();
  const total = Math.max(0, leerNum('pos-total'));
  const metodo = total > 0 ? posMetodo : null;
  if(total > 0 && !metodo){ msg.className = 'msg err'; msg.textContent = 'Elige el método de pago.'; return; }
  const items = posVenta.filter(it=> it.tipo === 'local' && it.cantidad > 0).map(it=>({ tipo:'local', cortesia: !!it.cortesia, cat:it.cat, categoria:it.categoria, clave:it.clave, tam:it.tam, variante:it.variante || null, nombre:it.nombre, precio:it.precio, cantidad:it.cantidad, subtotal:it.precio*it.cantidad }));
  if(!items.length && !confirm(`¿Devolver todo el folio ${ed.id}? El ticket queda en $0 y todo regresa a existencia.`)) return;
  const aviso = textoDiferenciaEdicion(total, metodo);
  posGuardando = true; actualizarBotonCobrar();
  const { error } = await sb.rpc('editar_venta', { p_id: ed.id, p_items: items, p_subtotal: subtotal, p_descuento: Math.max(0, subtotal - total),
    p_total: total, p_monto_local: total, p_metodo: metodo });
  posGuardando = false;
  if(error){
    const faltaSQL = /editar_venta|schema cache|does not exist/i.test(error.message);
    msg.className = 'msg err';
    msg.textContent = faltaSQL ? 'Falta correr en Supabase el archivo sql/editar_venta.sql. Después de eso ya se puede editar.' : 'No se pudo actualizar: ' + error.message;
    actualizarBotonCobrar(); return;
  }
  if(items.length){
    ticketPendiente = { folio: ed.id, fecha: ed.creado, items, subtotal, cort, total, metodo, recibe: 0 };
    document.getElementById('tk-sub').textContent = `Folio ${ed.id} actualizado · ${aviso}`;
    abrirModal('tk');
  }
  vaciarVenta();
  // Este aviso se queda hasta la siguiente acción para que no se olvide devolver o cobrar
  msg.className = 'msg ok'; msg.textContent = `Folio ${ed.id} actualizado. ${aviso}.`;
}
let pedidoEditPOS = null;
function editarPedidoPOS(p){
  pedidoEditPOS = p;
  document.getElementById('pe-titulo').textContent = p.nombre_cliente || 'Pedido';
  document.getElementById('pe-sub').textContent = detallePedidoPOS(p) + (p.entregado ? ' · Finalizado' : ' · Recoge en local');
  const esLocalP = esEntregaLocal(p);
  document.getElementById('btn-pe-dom').style.display = (!p.entregado && esLocalP) ? 'block' : 'none';
  document.getElementById('btn-pe-reabrir').style.display = p.entregado ? 'block' : 'none';
  document.getElementById('pe-msg').className = 'msg';
  abrirModal('pe');
}
async function accionPedidoPOS(cual){
  const p = pedidoEditPOS; if(!p) return;
  const msg = document.getElementById('pe-msg');
  const { error } = cual === 'domicilio'
    ? await sb.rpc('pos_cambiar_entrega', { p_id: p.id, p_entrega: 'domicilio' })
    : await sb.rpc('pos_reabrir_pedido', { p_id: p.id });
  if(error){ msg.className = 'msg err'; msg.textContent = 'No se pudo guardar: ' + error.message; return; }
  const i = posVenta.findIndex(x=>x.tipo==='pedido' && x.pedido_id === p.id);
  if(i >= 0){ posVenta.splice(i, 1); pintarVenta(); }
  cerrarModal('pe');
  const m = document.getElementById('pos-msg');
  m.className = 'msg ok'; m.textContent = cual === 'domicilio' ? `${p.nombre_cliente || 'El pedido'} ahora es a domicilio.` : `${p.nombre_cliente || 'El pedido'} regresó a pendiente por entregar.`;
  await cargarDatosPOS();
  if(posBusqueda) buscarPedidosPOS();
}
function pintarPedidosPOS(cont){
  cont.className = 'pos-plist'; cont.innerHTML = '';
  if(posBusqueda){
    const t = document.createElement('div'); t.className = 'sub-titulo'; t.textContent = 'Resultados de la búsqueda'; cont.appendChild(t);
    if(posBusqueda.error){ const e = document.createElement('div'); e.className = 'empty'; e.textContent = 'No se pudo buscar: ' + posBusqueda.error; cont.appendChild(e); }
    else if(!posBusqueda.length){ const e = document.createElement('div'); e.className = 'empty'; e.textContent = 'No se encontraron pedidos pendientes con ese nombre o teléfono.'; cont.appendChild(e); }
    else posBusqueda.forEach(p=> cont.appendChild(filaPedidoPOS(p, true)));
    const t2 = document.createElement('div'); t2.className = 'sub-titulo'; t2.style.marginTop = '14px'; t2.textContent = 'Pedidos de hoy'; cont.appendChild(t2);
  }
  if(!posPedidos.length){ const e = document.createElement('div'); e.className = 'empty'; e.textContent = 'No hay pedidos para recoger en el local hoy.'; cont.appendChild(e); return; }
  posPedidos.forEach(p=> cont.appendChild(filaPedidoPOS(p, false)));
}
function alternarPedidoEnVenta(p){
  if(posEditando){ const m = document.getElementById('pos-msg'); m.className = 'msg err'; m.textContent = 'Al editar un ticket no se pueden agregar pedidos. Termina o cancela la edición.'; return; }
  const i = posVenta.findIndex(x=>x.tipo==='pedido' && x.pedido_id === p.id);
  if(i >= 0) posVenta.splice(i, 1);
  else {
    const tot = Number(p.precio)||0;
    const finHoy = new Date(); finHoy.setHours(23,59,59,999);
    // Si el pedido es para hoy o ya pasó, se entrega; si es de días adelante, solo se cobra (se puede cambiar)
    const esLocal = esEntregaLocal(p);
    // Domicilio o casa: solo se cobra, nunca se entrega desde el punto de venta
    const entregar = esLocal && (!p.fecha_entrega || new Date(p.fecha_entrega) <= finHoy);
    posVenta.push({ tipo:'pedido', pedido_id:p.id, nombre:p.nombre_cliente || 'Sin nombre', detalle:detallePedidoPOS(p),
      total:tot, anticipo:Number(p.anticipo)||0, falta:Math.max(0, tot - pagadoDe(p)), entregar, esLocal,
      pagadoAntes: pagadoDe(p), lineasTicket: lineasTicketPedido(p), entregaTxt: entregaTxtPedido(p),
      tipoEntrega: p.entrega === 'domicilio' ? 'Domicilio' : p.entrega === 'casa' ? 'Recoger en casa' : '',
      fecha: p.fecha_entrega ? new Date(p.fecha_entrega).toLocaleDateString('es-MX',{weekday:'short', day:'numeric', month:'short'}) : '' });
    if(entregar && p.categoria === 'pastel' && !p.corona_tipo) setTimeout(()=> preguntarCoronaPedido(p), 0);
  }
  posTotalManual = false;
  pintarVenta(); pintarCatalogoPOS();
}
function agregarAVenta(cat, nombre, tam){
  if(posDisponible(cat, nombre, tam) <= 0) return;
  const it = posVenta.find(x=>x.tipo==='local' && x.cat===cat && x.clave===nombre && (x.tam||'')===(tam||'') && !x.variante && !x.cortesia);
  if(it) it.cantidad++;
  else {
    const precio = posPrecio(cat, nombre, tam);
    const etiqueta = cat === 'pasteles' ? `Pastel ${tam} ${nombre}` : cat === 'cupcakes' ? `Cupcake ${nombre}` : cat === 'panques' ? `Panqué ${nombre}` : nombre;
    posVenta.push({ tipo:'local', cat, categoria:POS_CATS[cat].tipo, clave:nombre, tam:tam || null, nombre:etiqueta, precio:Number(precio)||0, sinPrecio: precio == null, cantidad:1 });
  }
  posTotalManual = false;
  pintarVenta(); pintarCatalogoPOS();
}
function cambiarCantidadPOS(idx, delta){
  const it = posVenta[idx]; if(!it) return;
  if(delta > 0 && posDisponible(it.cat, it.clave, it.tam) <= 0) return;
  it.cantidad += delta;
  if(it.cantidad <= 0) posVenta.splice(idx, 1);
  posTotalManual = false;
  pintarVenta(); pintarCatalogoPOS();
}
function quitarDeVentaPOS(idx){ posVenta.splice(idx, 1); posTotalManual = false; pintarVenta(); pintarCatalogoPOS(); }
let posModoCortesia = false;
let posPct = null;
function subtotalesPOS(){
  let local = 0, ped = 0, cort = 0;
  posVenta.forEach(it=>{
    if(it.tipo === 'local'){ local += it.precio * it.cantidad; if(it.cortesia) cort += it.precio * it.cantidad; }
    else ped += (it.abono != null ? it.abono : it.falta);
  });
  return { local, ped, cort, subtotal: local + ped, base: local + ped - cort };
}
let posModoAnticipo = false;
function botonAnticipo(){
  const peds = posVenta.filter(x=>x.tipo==='pedido');
  if(!peds.length) return;
  if(peds.length === 1){ pedirAnticipo(posVenta.indexOf(peds[0])); return; }
  posModoAnticipo = !posModoAnticipo;
  const b = document.getElementById('pos-btn-anticipo');
  b.classList.toggle('on', posModoAnticipo);
  b.textContent = posModoAnticipo ? 'Listo' : 'Anticipo';
  pintarVenta();
}
function pedirAnticipo(idx){
  const it = posVenta[idx]; if(!it || it.tipo !== 'pedido') return;
  if(it.falta <= 0){ alert('Este pedido ya está pagado.'); return; }
  const v = prompt(`Anticipo para el pedido de ${it.nombre} (falta ${fmtDinero(it.falta)}). ¿Cuánto deja?`, it.abono != null ? it.abono : '');
  if(v === null) return;
  const n = Number(v);
  if(!(n > 0)){ alert('Escribe una cantidad mayor a 0.'); return; }
  if(n > it.falta){ alert('El anticipo no puede ser mayor a lo que falta (' + fmtDinero(it.falta) + ').'); return; }
  it.abono = n;
  it.entregar = false;
  if(posModoAnticipo) botonAnticipo();
  posTotalManual = false;
  pintarVenta();
}
function quitarAnticipo(idx){ const it = posVenta[idx]; if(!it) return; delete it.abono; posTotalManual = false; pintarVenta(); }
function alternarModoCortesia(){
  posModoCortesia = !posModoCortesia;
  const b = document.getElementById('pos-btn-cortesia');
  b.classList.toggle('on', posModoCortesia);
  b.textContent = posModoCortesia ? 'Listo' : 'Cortesía';
  pintarVenta();
}
// Pasa 1 pieza de la línea a cortesía
function marcarCortesia(idx){
  const it = posVenta[idx]; if(!it || it.tipo !== 'local') return;
  let dest = posVenta.find(x=>x.tipo==='local' && x.cortesia && x.cat===it.cat && x.clave===it.clave && (x.tam||'')===(it.tam||'') && (x.variante||'')===(it.variante||''));
  if(!dest){ dest = { ...it, cortesia:true, cantidad:0 }; posVenta.splice(idx+1, 0, dest); }
  dest.cantidad++;
  it.cantidad--;
  if(it.cantidad <= 0) posVenta.splice(posVenta.indexOf(it), 1);
  pintarVenta();
}
function quitarCortesia(idx){
  const it = posVenta[idx]; if(!it || !it.cortesia) return;
  let dest = posVenta.find(x=>x.tipo==='local' && !x.cortesia && x.cat===it.cat && x.clave===it.clave && (x.tam||'')===(it.tam||'') && (x.variante||'')===(it.variante||''));
  if(!dest){ dest = { ...it, cortesia:false, cantidad:0 }; posVenta.splice(idx, 0, dest); }
  dest.cantidad += it.cantidad;
  posVenta.splice(posVenta.indexOf(it), 1);
  pintarVenta();
}
function aplicarPct(p){
  const { base } = subtotalesPOS();
  posPct = p;
  posTotalManual = false;
  document.getElementById('pos-descuento').value = p ? Math.round(base * p / 100) : '';
  document.querySelectorAll('#pos-pcts button').forEach(b=> b.classList.toggle('sel', b.dataset.p !== 'otro' ? Number(b.dataset.p) === p : !!(p && ![10,15,20,25].includes(p))));
  pintarVenta();
}
document.querySelectorAll('#pos-pcts button').forEach(b=> b.addEventListener('click', ()=>{
  if(b.dataset.p === 'otro'){
    const v = prompt('Porcentaje de descuento (solo el número):');
    if(v === null) return;
    const n = Number(v);
    if(!(n > 0 && n <= 100)){ alert('Escribe un número entre 1 y 100.'); return; }
    aplicarPct(n);
  } else {
    const n = Number(b.dataset.p);
    aplicarPct(posPct === n ? null : n);
  }
}));
async function registrarMerma(){
  const msg = document.getElementById('pos-msg'); msg.className = 'msg';
  if(posEditando){ msg.className = 'msg err'; msg.textContent = 'Termina o cancela la edición del folio antes de registrar merma.'; return; }
  const locales = posVenta.filter(x=>x.tipo==='local');
  if(!locales.length){ msg.className = 'msg err'; msg.textContent = 'Agrega los productos que se van a merma.'; return; }
  if(posVenta.some(x=>x.tipo==='pedido')){ msg.className = 'msg err'; msg.textContent = 'Quita los pedidos de la venta antes de registrar merma.'; return; }
  const piezas = locales.reduce((a,x)=>a + x.cantidad, 0);
  if(!confirm(`¿Registrar ${piezas} ${piezas === 1 ? 'pieza' : 'piezas'} como merma?`)) return;
  const items = locales.map(it=>({ tipo:'local', merma:true, cat:it.cat, categoria:it.categoria, clave:it.clave, tam:it.tam, variante:it.variante || null, nombre:it.nombre, precio:it.precio, cantidad:it.cantidad, subtotal:it.precio*it.cantidad }));
  const valor = items.reduce((a,x)=>a + x.subtotal, 0);
  posGuardando = true; actualizarBotonCobrar();
  const { data: folio, error } = await sb.rpc('registrar_venta', { p_fecha: fechaHoyStr(), p_items: items, p_subtotal: valor, p_descuento: valor, p_total: 0, p_monto_local: 0, p_metodo: null });
  posGuardando = false;
  if(error){ msg.className = 'msg err'; msg.textContent = 'No se pudo registrar la merma: ' + error.message; actualizarBotonCobrar(); return; }
  ticketPendiente = { tipo:'merma', folio, fecha: new Date(), items, valor };
  document.getElementById('tk-sub').textContent = `Merma: ${piezas} ${piezas === 1 ? 'pieza' : 'piezas'}`;
  abrirModal('tk');
  vaciarVenta();
  const texto = `Merma registrada: ${piezas} ${piezas === 1 ? 'pieza' : 'piezas'}.`;
  msg.className = 'msg ok'; msg.textContent = texto;
  setTimeout(()=>{ if(msg.textContent === texto) msg.className = 'msg'; }, 4000);
  await cargarDatosPOS();
}
function pintarVenta(){
  const cont = document.getElementById('pos-items');
  if(!posVenta.length){ cont.innerHTML = '<div class="pos-vacio">Toca un producto o un pedido de hoy para agregarlo.</div>'; }
  else {
    cont.innerHTML = '';
    posVenta.forEach((it, idx)=>{
      const div = document.createElement('div');
      if(it.tipo === 'pedido'){
        div.className = 'pos-it ped';
        div.innerHTML = `<div class="n">Pedido de ${escHtml(it.nombre)} <span class="pos-tag ped">Pedido</span>
          <small>${escHtml(it.detalle)}${it.fecha ? ' · Para el ' + escHtml(it.fecha) : ''} · Total ${fmtDinero(it.total)} · Falta ${fmtDinero(it.falta)}</small>
          ${it.abono != null ? `<div style="font-size:12.5px; margin-top:5px; color:var(--amber-l); font-weight:700;">Anticipo ${fmtDinero(it.abono)} · Falta de pago ${fmtDinero(it.falta - it.abono)} <a href="#" class="pos-quitar-ant" style="color:#E6DCCB; margin-left:6px;">quitar</a></div>`
            : posModoAnticipo ? '<button type="button" class="pos-mini-btn pos-poner-ant">Poner anticipo</button>'
            : it.esLocal ? `<label style="display:flex; align-items:center; gap:6px; font-size:12.5px; margin-top:5px; color:#E6DCCB; cursor:pointer;"><input type="checkbox" class="pos-entregar" ${it.entregar ? 'checked' : ''} style="width:auto; margin:0;"> Entregar ahora</label>` : `<div style="font-size:12.5px; margin-top:5px; color:#E6DCCB;">${escHtml(it.tipoEntrega)}: solo se cobra</div>`}</div>
          <div class="p">${fmtDinero(it.abono != null ? it.abono : it.falta)}</div><button type="button" class="pos-x" title="Quitar">×</button>`;
        div.querySelector('.pos-x').onclick = ()=> quitarDeVentaPOS(idx);
        const qa = div.querySelector('.pos-quitar-ant'); if(qa) qa.onclick = (e)=>{ e.preventDefault(); quitarAnticipo(idx); };
        const pa = div.querySelector('.pos-poner-ant'); if(pa) pa.onclick = ()=> pedirAnticipo(idx);
        const chk = div.querySelector('.pos-entregar');
        if(chk) chk.onchange = (e)=>{ it.entregar = e.target.checked; actualizarBotonCobrar(); };
      } else if(it.cortesia){
        div.className = 'pos-it cort';
        div.innerHTML = `<div class="n">${escHtml(it.nombre)} <span class="pos-tag cort">Cortesía</span><small>${it.cantidad} × ${fmtDinero(it.precio)} · se descuenta</small></div>
          <div class="p">${fmtDinero(it.precio * it.cantidad)}</div><button type="button" class="pos-x" title="Quitar cortesía">×</button>`;
        div.querySelector('.pos-x').onclick = ()=> quitarCortesia(idx);
      } else {
        div.className = 'pos-it';
        div.innerHTML = `<div class="n">${escHtml(it.nombre)} <span class="pos-tag loc">Local</span><small>${it.incluida ? 'Incluida con el pastel' : it.sinPrecio ? 'Sin precio en catálogo' : fmtDinero(it.precio) + ' c/u'}</small>
          ${posModoCortesia ? '<button type="button" class="pos-mini-btn">Cortesía (1)</button>' : ''}</div>
          <div class="pos-qty"><button type="button" class="pos-qb">−</button><b>${it.cantidad}</b><button type="button" class="pos-qb">+</button></div>
          <div class="p">${fmtDinero(it.precio * it.cantidad)}</div>`;
        const [menos, mas] = div.querySelectorAll('.pos-qb');
        menos.onclick = ()=> cambiarCantidadPOS(idx, -1);
        mas.onclick = ()=> cambiarCantidadPOS(idx, +1);
        const bc = div.querySelector('.pos-mini-btn'); if(bc) bc.onclick = ()=> marcarCortesia(idx);
      }
      cont.appendChild(div);
    });
  }
  const { subtotal, cort, base } = subtotalesPOS();
  document.getElementById('pos-subtotal').textContent = fmtDinero(subtotal);
  document.getElementById('pos-cort-row').style.display = cort > 0 ? 'flex' : 'none';
  document.getElementById('pos-cort').textContent = '−' + fmtDinero(cort);
  if(posPct) document.getElementById('pos-descuento').value = Math.round(base * posPct / 100);
  if(!posTotalManual){
    const desc = leerNum('pos-descuento');
    document.getElementById('pos-total').value = Math.max(0, base - desc);
  }
  actualizarBotonCobrar();
}
function limpiarPct(){ posPct = null; document.querySelectorAll('#pos-pcts button').forEach(b=>b.classList.remove('sel')); }
document.getElementById('pos-descuento').addEventListener('input', ()=>{
  posTotalManual = false; limpiarPct();
  const { base } = subtotalesPOS();
  document.getElementById('pos-total').value = Math.max(0, base - leerNum('pos-descuento'));
  actualizarBotonCobrar();
});
document.getElementById('pos-total').addEventListener('input', ()=>{
  posTotalManual = true; limpiarPct();
  const { base } = subtotalesPOS();
  const desc = base - leerNum('pos-total');
  document.getElementById('pos-descuento').value = desc > 0 ? desc : '';
  actualizarBotonCobrar();
});
document.querySelectorAll('#pos-metodos .pos-chip').forEach(el=> el.addEventListener('click', ()=>{
  posMetodo = el.dataset.m;
  document.querySelectorAll('#pos-metodos .pos-chip').forEach(c=>c.classList.toggle('sel', c === el));
  actualizarBotonCobrar();
}));
// ---- Pago diferido: una venta pagada con varios métodos (ej. parte en efectivo y parte con tarjeta)
const DIV_METODOS = ['efectivo','tarjeta','transferencia'];
function pagosDiferidos(){ return DIV_METODOS.map(m=>({ metodo:m, monto: Math.round(leerNum('pos-div-' + m) * 100) / 100 })).filter(x=> x.monto > 0); }
function alternarPagoDiferido(forzar){
  const on = forzar !== undefined ? forzar : posMetodo !== 'mixto';
  if(on && posEditando) return;
  posMetodo = on ? 'mixto' : null;
  document.getElementById('pos-btn-diferido').classList.toggle('on', on);
  document.getElementById('pos-metodos').style.display = on ? 'none' : '';
  document.getElementById('pos-div-wrap').style.display = on ? 'block' : 'none';
  if(!on) DIV_METODOS.forEach(m=> document.getElementById('pos-div-' + m).value = '');
  document.querySelectorAll('#pos-metodos .pos-chip').forEach(c=> c.classList.remove('sel'));
  actualizarBotonCobrar();
}
DIV_METODOS.forEach(m=> document.getElementById('pos-div-' + m).addEventListener('input', actualizarBotonCobrar));
function actualizarCambioPOS(){
  const wrap = document.getElementById('pos-efectivo-wrap');
  const efDiv = posMetodo === 'mixto' ? leerNum('pos-div-efectivo') : 0;
  const conCambio = !posEditando && (posMetodo === 'efectivo' || efDiv > 0);
  wrap.style.display = conCambio ? 'block' : 'none';
  if(posMetodo === 'mixto'){
    const resta = Math.round((leerNum('pos-total') - pagosDiferidos().reduce((a,x)=> a + x.monto, 0)) * 100) / 100;
    const r = document.getElementById('pos-div-resta');
    r.textContent = resta === 0 ? '✓ $0' : resta > 0 ? fmtDinero(resta) : 'Sobran ' + fmtDinero(-resta);
    r.style.color = resta === 0 ? 'var(--amber-l)' : '#F2B8AC';
  }
  if(!conCambio) return;
  const total = posMetodo === 'mixto' ? efDiv : leerNum('pos-total');
  const v = document.getElementById('pos-recibe').value;
  const el = document.getElementById('pos-cambio');
  if(v === ''){ el.textContent = '—'; el.style.color = 'var(--amber-l)'; return; }
  const dif = (Number(v)||0) - total;
  if(dif >= 0){ el.textContent = fmtDinero(dif); el.style.color = 'var(--amber-l)'; }
  else { el.textContent = 'Faltan ' + fmtDinero(-dif); el.style.color = '#F2B8AC'; }
}
document.getElementById('pos-recibe').addEventListener('input', actualizarCambioPOS);
function actualizarBotonCobrar(){
  actualizarCambioPOS();
  const ba = document.getElementById('pos-btn-anticipo');
  if(ba) ba.disabled = !posVenta.some(x=>x.tipo==='pedido');
  const btn = document.getElementById('pos-cobrar');
  const total = leerNum('pos-total');
  pintarBannerEdicion();
  document.getElementById('pos-btn-merma').disabled = !!posEditando;
  document.getElementById('pos-btn-diferido').disabled = !!posEditando;
  if(posEditando){
    if(total > 0 && !posMetodo){ btn.disabled = true; btn.textContent = 'Elige método de pago'; return; }
    btn.disabled = posGuardando;
    const f = filasDiferenciaEdicion(Math.max(0, total), total > 0 ? posMetodo : null);
    const accion = f.map(x=> x.monto > 0 ? `${x.que.split(' ')[0]} ${fmtDinero(x.monto)}` : '').filter(Boolean).join(' y ');
    btn.textContent = (posVenta.length ? `Actualizar folio ${posEditando.id}` : `Devolver todo (folio ${posEditando.id})`) + (accion ? ' · ' + accion : '');
    return;
  }
  const nPed = posVenta.filter(x=>x.tipo==='pedido' && x.entregar).length;
  const entregar = nPed ? (nPed === 1 ? ' y entregar pedido' : ` y entregar ${nPed} pedidos`) : '';
  if(!posVenta.length){ btn.disabled = true; btn.textContent = 'Cobrar'; return; }
  const hayLocal = posVenta.some(x=>x.tipo==='local');
  if(total <= 0){
    btn.disabled = posGuardando || (!nPed && !hayLocal);
    // Pedidos ya pagados que no se entregan hoy: no hay nada que cobrar, pero sí se puede imprimir el comprobante
    if(!hayLocal && !nPed){ btn.disabled = posGuardando; btn.textContent = 'Imprimir comprobante'; return; }
    btn.textContent = hayLocal ? 'Registrar cortesía' + entregar : (nPed === 1 ? 'Entregar pedido' : `Entregar ${nPed} pedidos`); return; }
  if(!posMetodo){ btn.disabled = true; btn.textContent = 'Elige método de pago'; return; }
  if(posMetodo === 'mixto'){
    const resta = Math.round((total - pagosDiferidos().reduce((a,x)=> a + x.monto, 0)) * 100) / 100;
    if(resta !== 0){ btn.disabled = true; btn.textContent = resta > 0 ? `Faltan ${fmtDinero(resta)} por repartir` : `Sobran ${fmtDinero(-resta)}`; return; }
  }
  btn.disabled = posGuardando;
  btn.textContent = `Cobrar ${fmtDinero(total)}${entregar}`;
}
function vaciarVenta(recargar){
  const estabaEditando = !!posEditando;
  posEditando = null;
  posVenta = []; posMetodo = null; posTotalManual = false;
  alternarPagoDiferido(false);
  limpiarPct();
  if(posModoCortesia) alternarModoCortesia();
  if(posModoAnticipo){ posModoAnticipo = false; const b = document.getElementById('pos-btn-anticipo'); b.classList.remove('on'); b.textContent = 'Anticipo'; }
  document.getElementById('pos-recibe').value = '';
  document.getElementById('pos-descuento').value = '';
  document.querySelectorAll('#pos-metodos .pos-chip').forEach(c=>c.classList.remove('sel'));
  document.getElementById('pos-msg').className = 'msg';
  pintarVenta(); pintarCatalogoPOS();
  // Al salir de una edición se recalculan existencias (ya cuenta otra vez el ticket guardado)
  if(estabaEditando && recargar !== false) cargarDatosPOS();
}
async function cobrarVenta(){
  if(posEditando) return guardarEdicionVenta();
  const msg = document.getElementById('pos-msg'); msg.className = 'msg';
  if(!posVenta.length || posGuardando) return;
  if(leerNum('pos-total') <= 0 && !posVenta.some(x=> x.tipo === 'local' || x.entregar)) return imprimirComprobantePOS();
  const { local, cort, subtotal, base } = subtotalesPOS();
  const total = Math.max(0, leerNum('pos-total'));
  const soloEntrega = total <= 0;
  const habiaLocal = posVenta.some(x=>x.tipo==='local');
  if(!soloEntrega && !posMetodo){ msg.className = 'msg err'; msg.textContent = 'Elige el método de pago.'; return; }
  // Pago diferido: si al final solo se usó un método, se guarda como ese método
  let metodoFinal = posMetodo, pagosFinal = null;
  if(!soloEntrega && posMetodo === 'mixto'){
    const pd = pagosDiferidos();
    const suma = Math.round(pd.reduce((a,x)=> a + x.monto, 0) * 100) / 100;
    if(Math.abs(suma - total) > 0.009){ msg.className = 'msg err'; msg.textContent = 'Los montos del pago diferido no suman el total.'; return; }
    if(pd.length === 1) metodoFinal = pd[0].metodo; else pagosFinal = pd;
  }
  // La cortesía se descuenta completa; el descuento se reparte en proporción entre lo de local y lo de pedidos
  const factor = base > 0 ? total / base : 0;
  const montoLocal = Math.round((local - cort) * factor * 100) / 100;
  let restante = Math.round((total - montoLocal) * 100) / 100;
  const pedidos = posVenta.filter(x=>x.tipo==='pedido');
  const items = posVenta.map(it=>{
    if(it.tipo === 'local') return { tipo:'local', cortesia: !!it.cortesia, cat:it.cat, categoria:it.categoria, clave:it.clave, tam:it.tam, variante:it.variante || null, nombre:it.nombre, precio:it.precio, cantidad:it.cantidad, subtotal:it.precio*it.cantidad };
    const esUltimo = it === pedidos[pedidos.length-1];
    const monto = it.abono != null ? it.abono : it.falta;
    const cobrado = esUltimo ? restante : Math.round(monto * factor * 100) / 100;
    if(!esUltimo) restante = Math.round((restante - cobrado) * 100) / 100;
    return { tipo:'pedido', pedido_id:it.pedido_id, nombre:it.nombre, detalle:it.detalle, falta:it.falta, cobrado: Math.max(0, cobrado),
      anticipo: it.abono != null, entregar: it.abono != null ? false : !!it.entregar };
  });
  posGuardando = true; actualizarBotonCobrar();
  const { data: folio, error } = await sb.rpc('registrar_venta', {
    p_fecha: fechaHoyStr(), p_items: items, p_subtotal: subtotal, p_descuento: Math.max(0, subtotal - total),
    p_total: total, p_monto_local: montoLocal, p_metodo: soloEntrega ? null : metodoFinal,
    ...(pagosFinal ? { p_pagos: pagosFinal } : {})
  });
  posGuardando = false;
  if(error){ msg.className = 'msg err'; msg.textContent = 'No se pudo registrar: ' + error.message; actualizarBotonCobrar(); return; }
  const metodoTxt = pagosFinal ? pagosFinal.map(x=> formatNombre(x.metodo) + ' ' + fmtDinero(x.monto)).join(' + ') : formatNombre(metodoFinal);
  const texto = soloEntrega ? (habiaLocal ? 'Cortesía registrada.' : 'Pedido entregado.') : `Venta registrada: ${fmtDinero(total)} en ${metodoTxt}.`;
  const recibe = Number(document.getElementById('pos-recibe').value) || 0;
  const efectivoParte = pagosFinal ? ((pagosFinal.find(x=> x.metodo === 'efectivo') || {}).monto || 0) : (metodoFinal === 'efectivo' ? total : 0);
  const extraPed = {};
  posVenta.forEach(it=>{ if(it.tipo === 'pedido') extraPed[it.pedido_id] = { total: it.total, pagadoAntes: it.pagadoAntes || 0, lineas: it.lineasTicket || [], montoBase: it.abono != null ? it.abono : it.falta, entregaTxt: it.entregaTxt || '' }; });
  ticketPendiente = { folio, fecha: new Date(), items: items.map(it=> it.tipo === 'pedido' ? { ...it, ...(extraPed[it.pedido_id] || {}) } : it), subtotal, cort, total, metodo: soloEntrega ? null : metodoFinal, pagos: pagosFinal,
    recibe: !soloEntrega && efectivoParte > 0 && recibe > efectivoParte ? recibe : 0, cambio: Math.max(0, recibe - efectivoParte) };
  document.getElementById('tk-sub').textContent = soloEntrega ? texto : `Total ${fmtDinero(total)} · ${metodoTxt}`;
  abrirModal('tk');
  vaciarVenta();
  msg.className = 'msg ok'; msg.textContent = texto;
  setTimeout(()=>{ if(msg.textContent === texto) msg.className = 'msg'; }, 4000);
  await cargarDatosPOS();
  if(posBusqueda) buscarPedidosPOS();
}
// Comprobante de pedidos ya pagados (no registra venta): precio completo y lo que ya se pagó
async function imprimirComprobantePOS(){
  const peds = posVenta.filter(x=> x.tipo === 'pedido');
  if(!peds.length) return;
  ticketPendiente = { comprobante:true, fecha:new Date(), subtotal:0, cort:0, total:0, metodo:null, recibe:0, nota:'No se registró ningún cobro.',
    items: peds.map(it=> ({ tipo:'pedido', nombre:it.nombre, cobrado:0, montoBase:0, total:it.total, pagadoAntes:it.pagadoAntes || 0, lineas:it.lineasTicket || [], entregaTxt:it.entregaTxt || '' })) };
  vaciarVenta();
  await responderTicket(true);
}
function cerrarPreguntaCorona(){
  document.getElementById('cor-velo').classList.remove('on');
  document.getElementById('cor-hoja').classList.remove('on');
}
function preguntarCorona(nombre, tam){
  if(posDisponible('pasteles', nombre, tam) <= 0) return;
  const tipoCor = tam === 'mini' ? 'Mini' : 'Normal';
  const incluida = saborTraeCorona(nombre);
  const quedan = posDisponible('coronas', tipoCor, '');
  document.getElementById('cor-titulo').textContent = '¿Lleva corona?';
  document.getElementById('cor-sub').textContent = `Pastel ${tam} ${nombre}` + (incluida ? ' · este sabor ya incluye la corona' : '') + ` · coronas ${tipoCor.toLowerCase()} disponibles: ${quedan}`;
  const cont = document.getElementById('cor-opciones'); cont.innerHTML = '';
  const boton = (texto, sub, fn, deshab) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'pos-card'; b.style.minHeight = '0';
    b.innerHTML = `<div class="nm">${texto}</div><div class="st">${sub}</div>`;
    if(deshab){ b.classList.add('agotado'); b.disabled = true; }
    b.onclick = fn; cont.appendChild(b);
  };
  const tamPrecio = tam === 'mini' ? 'mini' : 'normal';
  // En el local solo se venden coronas ámbar (las de color son solo para pedidos)
  [['ambar','Corona ámbar']].forEach(([tipo, etiqueta])=>{
    const precio = incluida ? 0 : precioCorona(tipo, tamPrecio);
    boton(etiqueta, quedan <= 0 ? 'Ya no hay coronas ' + tipoCor.toLowerCase() : (incluida ? 'Incluida, sin costo' : '+ ' + fmtDinero(precio)),
      ()=>{ cerrarPreguntaCorona(); agregarAVenta('pasteles', nombre, tam); agregarCoronaVenta(tipoCor, tipo, etiqueta, incluida, precio); }, quedan <= 0);
  });
  boton('Sin corona', 'Solo el pastel', ()=>{ cerrarPreguntaCorona(); agregarAVenta('pasteles', nombre, tam); });
  document.getElementById('cor-velo').classList.add('on');
  document.getElementById('cor-hoja').classList.add('on');
}
// Pedido que se entrega hoy y se agendó sin corona: preguntar si al final sí la quiere (misma lógica que en el local)
function preguntarCoronaPedido(p){
  const tam = String(p.tamano_o_sabor || '').toLowerCase() === 'mini' ? 'mini' : 'normal';
  const tipoCor = tam === 'mini' ? 'Mini' : 'Normal';
  const incluida = saborTraeCorona(p.sabor);
  const quedan = posDisponible('coronas', tipoCor, '');
  document.getElementById('cor-titulo').textContent = '¿Ahora sí quiere corona?';
  document.getElementById('cor-sub').textContent = `${p.nombre_cliente || 'Pedido'} · ${detallePedidoPOS(p)} · se agendó sin corona` + (incluida ? ' · este sabor ya incluye la corona' : '') + ` · coronas ${tipoCor.toLowerCase()} disponibles: ${quedan}`;
  const cont = document.getElementById('cor-opciones'); cont.innerHTML = '';
  const boton = (texto, sub, fn, deshab) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'pos-card'; b.style.minHeight = '0';
    b.innerHTML = `<div class="nm">${texto}</div><div class="st">${sub}</div>`;
    if(deshab){ b.classList.add('agotado'); b.disabled = true; }
    b.onclick = fn; cont.appendChild(b);
  };
  const precio = incluida ? 0 : precioCorona('ambar', tam);
  boton('Corona ámbar', quedan <= 0 ? 'Ya no hay coronas ' + tipoCor.toLowerCase() : (incluida ? 'Incluida, sin costo' : '+ ' + fmtDinero(precio)),
    ()=>{ cerrarPreguntaCorona(); agregarCoronaVenta(tipoCor, 'ambar', 'Corona ámbar', incluida, precio); }, quedan <= 0);
  boton('Sin corona', 'Se entrega sin corona', ()=> cerrarPreguntaCorona());
  document.getElementById('cor-velo').classList.add('on');
  document.getElementById('cor-hoja').classList.add('on');
}
function agregarCoronaVenta(tipoCor, tipo, etiqueta, incluida, precio){
  if(posDisponible('coronas', tipoCor, '') <= 0) return;
  const variante = tipo + (incluida ? '-incluida' : '');
  const it = posVenta.find(x=>x.tipo==='local' && x.cat==='coronas' && x.clave===tipoCor && x.variante===variante && !x.cortesia);
  if(it) it.cantidad++;
  else posVenta.push({ tipo:'local', cat:'coronas', categoria:'corona', clave:tipoCor, tam:null, variante, incluida,
    nombre: `${etiqueta} ${tipoCor.toLowerCase()}${incluida ? ' (incluida)' : ''}`, precio: Number(precio)||0, sinPrecio:false, cantidad:1 });
  posTotalManual = false;
  pintarVenta(); pintarCatalogoPOS();
}
