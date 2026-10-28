// Pedidos (directora y producción): lista por día, repartidor, editar, pagos, eliminados y hoja impresa.

function cambiarRangoPedidos(){
  const rango = document.getElementById('filtro-rango').value;
  document.getElementById('filtro-fechas-wrap').style.display = rango === 'personalizado' ? 'flex' : 'none';
  cargarPedidos();
}
function resumenPedidoCorto(p){
  if(p.categoria === 'pastel'){
    const cor = textoCorona(p);
    return `Pastel ${formatNombre(p.tamano_o_sabor)}${p.sabor ? ' de ' + formatNombre(p.sabor) : ''}${cor ? ', ' + cor.toLowerCase() : ''}`;
  }
  const tipo = {cupcake:'Cupcakes', individual:'Individuales', panque:'Panqués'}[p.categoria] || p.categoria;
  return `${tipo}: ${p.sabor || ''}`;
}
function armarTextoRepartidor(fechaTitulo, pedidos){
  const lineas = [];
  lineas.push(`🛵 *Domicilios — ${fechaTitulo}*`);
  lineas.push(`${pedidos.length} ${pedidos.length === 1 ? 'entrega' : 'entregas'}`);
  pedidos.forEach((p, i)=>{
    const hora = p.fecha_entrega ? new Date(p.fecha_entrega).toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'}) : '';
    const falta = Math.max(0, (Number(p.precio)||0) - pagadoDe(p));
    lineas.push('');
    if(p.recibe_nombre){
      lineas.push(`*${i+1}. Entregar a: ${p.recibe_nombre}*${hora ? ' — ' + hora : ''}`);
      if(p.recibe_telefono) lineas.push(`📞 ${p.recibe_telefono}`);
      lineas.push(`👤 Pidió: ${p.nombre_cliente || 'Sin nombre'}${p.telefono ? ' (' + p.telefono + ')' : ''}`);
    } else {
      lineas.push(`*${i+1}. ${p.nombre_cliente || 'Sin nombre'}*${hora ? ' — ' + hora : ''}`);
      if(p.telefono) lineas.push(`📞 ${p.telefono}`);
    }
    lineas.push(`📍 ${p.direccion || 'Sin dirección, confirmar con la clienta'}`);
    lineas.push(`🎂 ${resumenPedidoCorto(p)}`);
    lineas.push(falta > 0 ? `💵 Cobrar ${fmtDinero(falta)}` : '✅ Ya está pagado, no cobrar');
    if(p.notas) lineas.push(`📝 ${p.notas}`);
  });
  return lineas.join('\n');
}
async function copiarRepartidor(texto, btn){
  let ok = false;
  try{
    await navigator.clipboard.writeText(texto);
    ok = true;
  } catch(e){
    const ta = document.createElement('textarea');
    ta.value = texto;
    ta.setAttribute('readonly','');
    ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, texto.length);
    try{ ok = document.execCommand('copy'); }catch(e2){}
    document.body.removeChild(ta);
  }
  const original = btn.dataset.original || btn.innerHTML;
  btn.dataset.original = original;
  if(ok){
    btn.classList.add('copiado');
    btn.innerHTML = '✓ Copiado, ya lo puedes pegar en WhatsApp';
  } else {
    btn.innerHTML = 'No se pudo copiar, intenta de nuevo';
  }
  setTimeout(()=>{ btn.classList.remove('copiado'); btn.innerHTML = original; }, 2500);
}
async function cargarPedidos(){
  const cont = document.getElementById('lista-contenido');
  cont.className = 'loading';
  cont.textContent = 'Cargando pedidos...';

  let q = sb.from('pedidos').select('*').order('fecha_entrega', {ascending:true});

  const nombre = document.getElementById('filtro-nombre').value.trim();
  if(nombre) q = q.ilike('nombre_cliente', `%${nombre}%`);

  const categoria = document.getElementById('filtro-categoria').value;
  if(categoria) q = q.eq('categoria', categoria);

  const rango = document.getElementById('filtro-rango').value;
  if(rango === 'proximos'){
    const h = new Date();
    q = q.gte('fecha_entrega', new Date(h.getFullYear(), h.getMonth(), h.getDate()).toISOString());
  } else if(rango === 'personalizado'){
    const desde = document.getElementById('filtro-desde').value;
    const hasta = document.getElementById('filtro-hasta').value;
    if(desde) q = q.gte('fecha_entrega', desde + 'T00:00:00');
    if(hasta) q = q.lte('fecha_entrega', hasta + 'T23:59:59');
  }

  const { data, error } = await q;

  if(error){
    cont.className = 'empty';
    cont.textContent = 'No se pudieron cargar los pedidos: ' + error.message;
    return;
  }
  if(!data || data.length===0){
    cont.className = 'empty';
    cont.textContent = 'Todavía no hay pedidos capturados.';
    return;
  }

  pintarPedidosPorDia(data, cont);
}
function pintarPedidosPorDia(data, cont){
  const grupos = {};
  data.forEach(p=>{
    const d = p.fecha_entrega ? new Date(p.fecha_entrega) : null;
    const key = d ? d.toLocaleDateString('es-MX', {weekday:'long', day:'numeric', month:'long'}) : 'Sin fecha';
    if(!grupos[key]) grupos[key] = [];
    grupos[key].push(p);
  });

  const esc = escHtml;
  const dinero = fmtDinero;

  cont.className = '';
  cont.innerHTML = '';
  // Dentro de cada día, los pedidos van en orden alfabético por nombre del cliente
  Object.values(grupos).forEach(lista=> lista.sort((x, y)=> (x.nombre_cliente||'').localeCompare(y.nombre_cliente||'', 'es', {sensitivity:'base'})));
  Object.keys(grupos).forEach(fecha=>{
    const g = document.createElement('div');
    g.className = 'day-group';

    // Totales del día (como en la hoja de seguimiento)
    const cobrado = { efectivo:0, transferencia:0, tarjeta:0 };
    let totalDia = 0, faltaDia = 0;
    grupos[fecha].forEach(p=>{
      const total = Number(p.precio)||0;
      const pagado = pagadoDe(p);
      totalDia += total;
      faltaDia += Math.max(0, total - pagado);
      if(p.metodo_pago && mt(p.metodo_pago) in cobrado) cobrado[mt(p.metodo_pago)] += Number(p.anticipo)||0;
      if(p.metodo_entrega && mt(p.metodo_entrega) in cobrado) cobrado[mt(p.metodo_entrega)] += Number(p.pago_entrega)||0;
      pagosDe(p).forEach(x=>{ if(mt(x.metodo) in cobrado) cobrado[mt(x.metodo)] += Number(x.monto)||0; });
    });

    let filas = '';
    grupos[fecha].forEach((p, idx)=>{
      const hora = p.fecha_entrega ? new Date(p.fecha_entrega).toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'}) : '';
      const producto = {pastel:'Pastel', cupcake:'Cupcakes', individual:'Individuales', panque:'Panqués'}[p.categoria] || p.categoria;
      const tamano = p.categoria === 'pastel' ? formatNombre(p.tamano_o_sabor) : '—';
      const sabor = p.categoria === 'pastel' ? formatNombre(p.sabor) + (textoCorona(p) ? ' · ' + textoCorona(p) : '') + (p.decorado ? ' · Decorado' : '') : (p.sabor || '');
      const entrega = p.entrega === 'domicilio' ? 'Domicilio'
        : p.entrega === 'casa' ? 'Recoger en casa'
        : 'Recoge en local';
      const direccion = p.entrega === 'domicilio' && p.direccion ? `<span class="sub">${esc(p.direccion)}</span>` : '';
      const total = Number(p.precio)||0;
      const pagado = pagadoDe(p);
      const falta = Math.max(0, total - pagado);
      const metodos = [Number(p.anticipo) > 0 ? p.metodo_pago : '', Number(p.pago_entrega) > 0 ? p.metodo_entrega : '', ...pagosDe(p).map(x=>x.metodo)].filter(Boolean).map(formatNombre);
      const metodo = metodos.length ? `<span class="sub">${esc([...new Set(metodos)].join(' + '))}</span>` : '';
      const faltaHtml = (falta <= 0 ? '<span class="falta-ok">✓ Pagado</span>' : `<span class="falta-pend">${dinero(falta)}</span>`) + (p.entregado ? '<span class="sub">Entregado</span>' : '');

      pedidosPorId[p.id] = p;
      filas += `
        <tr>
          ${rolActual === 'director' ? `<td class="c"><button type="button" class="btn-editar-fila" onclick="event.stopPropagation(); elegirAccionPedido(${Number(p.id)})">Editar</button></td>` : ''}
          <td class="num">${idx+1}</td>
          <td class="nombre">${esc(p.nombre_cliente || 'Sin nombre')}${p.recibe_nombre ? `<span class="sub">Recibe: ${esc(p.recibe_nombre)}${p.recibe_telefono ? ' · ' + esc(p.recibe_telefono) : ''}</span>` : ''}</td>
          <td class="nowrap">${esc(p.telefono || '')}</td>
          <td class="nowrap">${producto}</td>
          <td class="nowrap">${esc(tamano)}</td>
          <td class="det">${esc(sabor)}${p.decorado && p.decorado_descripcion ? `<span class="sub">${esc(p.decorado_descripcion)}</span>` : ''}</td>
          <td class="nowrap">${hora}</td>
          <td class="nowrap">${entrega}${direccion}</td>
          <td class="dinero">${dinero(total)}</td>
          <td class="dinero">${dinero(pagado)}${metodo}</td>
          <td class="dinero">${faltaHtml}</td>
          <td class="coment">${esc(p.notas || '')}</td>
        </tr>`;
    });

    g.innerHTML = `
      <h3>${fecha.charAt(0).toUpperCase() + fecha.slice(1)}</h3>
      ${rolActual === 'director' ? `<div class="resumen-dia">
        <span>Efectivo <b>${dinero(cobrado.efectivo)}</b></span>
        <span>Transferencia <b>${dinero(cobrado.transferencia)}</b></span>
        <span>Tarjeta <b>${dinero(cobrado.tarjeta)}</b></span>
        <span>Total <b>${dinero(totalDia)}</b></span>
        <span>Falta pago <b>${dinero(faltaDia)}</b></span>
      </div>` : ''}
      <div class="tabla-wrap">
        <table class="tabla-pedidos">
          <thead>
            <tr>
              ${rolActual === 'director' ? '<th></th>' : ''}<th>No.</th><th>Nombre</th><th>Teléfono</th><th>Producto</th><th>Tamaño</th><th>Sabor / detalle</th>
              <th>Hora</th><th>Entrega</th><th class="dinero">Total</th><th class="dinero">Pagó</th><th class="dinero">Falta</th><th>Comentarios</th>
            </tr>
          </thead>
          <tbody>${filas}</tbody>
        </table>
      </div>`;

    const domicilios = grupos[fecha].filter(p => p.entrega === 'domicilio');
    if(domicilios.length){
      const tituloDia = fecha.charAt(0).toUpperCase() + fecha.slice(1);
      const textoRep = armarTextoRepartidor(tituloDia, domicilios);
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn-repartidor';
      btn.innerHTML = `🛵 Copiar domicilios para el repartidor (${domicilios.length})`;
      btn.onclick = () => copiarRepartidor(textoRep, btn);
      g.appendChild(btn);
    }
    if(rolActual === 'director'){
      const bi = document.createElement('button');
      bi.type = 'button';
      bi.className = 'btn-repartidor';
      bi.style.marginLeft = '8px';
      bi.textContent = 'Imprimir';
      const lista = grupos[fecha].slice(), tituloImp = fecha.charAt(0).toUpperCase() + fecha.slice(1);
      bi.onclick = () => imprimirPedidosDia(tituloImp, lista);
      g.appendChild(bi);
    }
    cont.appendChild(g);
  });
}
let rolActual = null;
// ---------- Ver / editar / borrar pedido ----------
const pedidosPorId = {};
let pedidoEditando = null;
function epVal(id){ return document.getElementById(id).value; }
function epSet(id, v){ document.getElementById(id).value = v ?? ''; }
function epActualizarUI(){
  const esPastel = epVal('ep-cat') === 'pastel';
  document.getElementById('ep-cor-wrap').style.display = esPastel ? 'block' : 'none';
  document.getElementById('ep-color-wrap').style.display = esPastel && epVal('ep-cor') === 'color' ? 'block' : 'none';
  const dom = epVal('ep-entrega') === 'domicilio';
  document.querySelectorAll('.ep-dom').forEach(e => e.style.display = dom ? 'block' : 'none');
  const extra = pedidoEditando ? (Number(pedidoEditando.pago_entrega)||0) + (Number(pedidoEditando.descuento_entrega)||0) + sumaPagos(pedidoEditando) : 0;

}
['ep-cat','ep-cor','ep-entrega'].forEach(id=>{
  document.getElementById(id).addEventListener('input', epActualizarUI);
  document.getElementById(id).addEventListener('change', epActualizarUI);
});
function abrirEditarPedido(id){
  if(rolActual !== 'director') return; // Producción solo puede ver
  const p = pedidosPorId[id];
  if(!p) return;
  pedidoEditando = p;
  const {f, h} = fechaLocalPartes(p.fecha_entrega);
  document.getElementById('ep-titulo').textContent = p.nombre_cliente || 'Pedido';
  document.getElementById('ep-sub').textContent = 'Pedido #' + p.id + (p.created_at ? ' · capturado el ' + new Date(p.created_at).toLocaleDateString('es-MX',{day:'numeric',month:'long'}) : '')
    + (p.decorado ? ' · Decorado: ' + (p.decorado_descripcion || '') : '')
    + (p.entregado ? ' · Entregado' + (Number(p.pago_entrega) > 0 ? `, cobró ${fmtDinero(p.pago_entrega)} al entregar (${formatNombre(p.metodo_entrega || '')})` : '') + (Number(p.descuento_entrega) > 0 ? `, descuento ${fmtDinero(p.descuento_entrega)}` : '') : '');
  epSet('ep-nombre', p.nombre_cliente); epSet('ep-tel', p.telefono);
  epSet('ep-cat', p.categoria || 'pastel');
  epSet('ep-tam', p.categoria === 'pastel' ? p.tamano_o_sabor : '');
  epSet('ep-sabor', p.sabor);
  epSet('ep-cor', p.corona_tipo || ''); epSet('ep-color', p.corona_color);
  epSet('ep-fecha', f); epSet('ep-hora', h);
  epSet('ep-entrega', p.entrega === 'local' ? 'recoger' : (p.entrega || 'recoger'));
  epSet('ep-dir', p.direccion); epSet('ep-rnombre', p.recibe_nombre); epSet('ep-rtel', p.recibe_telefono);
  epSet('ep-precio', p.precio);
  epSet('ep-notas', p.notas);
  document.getElementById('ep-msg').className = 'msg';
  epActualizarUI();
  document.getElementById('ep-velo').classList.add('on');
  document.getElementById('ep-hoja').classList.add('on');
}
function cerrarEditarPedido(){
  document.getElementById('ep-velo').classList.remove('on');
  document.getElementById('ep-hoja').classList.remove('on');
  pedidoEditando = null;
}
async function guardarEdicionPedido(){
  const msg = document.getElementById('ep-msg'); msg.className = 'msg';
  const p = pedidoEditando; if(!p) return;
  const nombre = epVal('ep-nombre').trim();
  const fecha = epVal('ep-fecha');
  if(!nombre){ msg.className='msg err'; msg.textContent='Falta el nombre del cliente.'; return; }
  if(!fecha){ msg.className='msg err'; msg.textContent='Falta la fecha de entrega.'; return; }
  const cat = epVal('ep-cat');
  const entrega = epVal('ep-entrega');
  const cor = cat === 'pastel' ? epVal('ep-cor') : '';
  if(cor === 'color' && !epVal('ep-color').trim()){ msg.className='msg err'; msg.textContent='Escribe el color de la corona.'; return; }
  if(entrega === 'domicilio' && !epVal('ep-dir').trim()){ msg.className='msg err'; msg.textContent='Falta la dirección de entrega.'; return; }
  const hora = epVal('ep-hora') || '11:00';
  const cambios = {
    nombre_cliente: nombre,
    telefono: epVal('ep-tel').trim(),
    categoria: cat,
    tamano_o_sabor: cat === 'pastel' ? epVal('ep-tam').trim() : cat,
    sabor: epVal('ep-sabor').trim(),
    corona_tipo: cor || null,
    corona_color: cor === 'color' ? epVal('ep-color').trim() : null,
    fecha_entrega: new Date(`${fecha}T${hora}:00`).toISOString(),
    entrega,
    direccion: entrega === 'domicilio' ? epVal('ep-dir').trim() : '',
    recibe_nombre: entrega === 'domicilio' ? (epVal('ep-rnombre').trim() || null) : null,
    recibe_telefono: entrega === 'domicilio' ? (epVal('ep-rtel').trim() || null) : null,
    precio: Number(epVal('ep-precio')) || 0,
    notas: epVal('ep-notas')
  };
  const btn = document.getElementById('ep-guardar'); btn.disabled = true; btn.textContent = 'Guardando...';
  const { data, error } = await sb.from('pedidos').update(cambios).eq('id', p.id).select();
  btn.disabled = false; btn.textContent = 'Guardar cambios';
  if(error){ msg.className='msg err'; msg.textContent='No se pudo guardar: ' + error.message; return; }
  if(!data || !data.length){ msg.className='msg err'; msg.textContent='No se guardó. Revisa que ya se haya corrido el SQL de permisos para editar pedidos.'; return; }
  cerrarEditarPedido();
  refrescarVistaActual();
}
async function borrarPedido(){
  const p = pedidoEditando; if(!p) return;
  if(!confirm(`¿Borrar el pedido de ${p.nombre_cliente || 'este cliente'}? Podrás recuperarlo en "Ver pedidos eliminados".`)) return;
  const msg = document.getElementById('ep-msg'); msg.className = 'msg';
  const { data, error } = await sb.from('pedidos').delete().eq('id', p.id).select();
  if(error){ msg.className='msg err'; msg.textContent='No se pudo borrar: ' + error.message; return; }
  if(!data || !data.length){ msg.className='msg err'; msg.textContent='No se borró. Revisa que ya se haya corrido el SQL de permisos para editar pedidos.'; return; }
  cerrarEditarPedido();
  refrescarVistaActual();
}
document.addEventListener('keydown', e => { if(e.key === 'Escape' && pedidoEditando) cerrarEditarPedido(); });
// ---------- Pedidos eliminados (solo directora) ----------
async function abrirEliminados(){
  activarVistaDirectora('tab-lista', 'view-eliminados');
  const cont = document.getElementById('eliminados-contenido');
  cont.className = 'loading'; cont.textContent = 'Cargando...';
  const { data, error } = await sb.from('pedidos_eliminados').select('*').order('eliminado_at', {ascending:false}).limit(200);
  if(error){ cont.className = 'empty'; cont.textContent = 'No se pudieron cargar: ' + error.message + ' (revisa que ya se haya corrido el SQL).'; return; }
  if(!data || !data.length){ cont.className = 'empty'; cont.textContent = 'No hay pedidos eliminados.'; return; }
  cont.className = ''; cont.innerHTML = '';
  data.forEach(e=>{
    const p = e.pedido || {};
    const producto = {pastel:'Pastel', cupcake:'Cupcakes', individual:'Individuales', panque:'Panqués'}[p.categoria] || p.categoria || '';
    const det = p.categoria === 'pastel' ? [formatNombre(p.tamano_o_sabor), formatNombre(p.sabor)].filter(Boolean).join(' · ') : (p.sabor || '');
    const entrega = p.fecha_entrega ? new Date(p.fecha_entrega).toLocaleString('es-MX', {weekday:'short', day:'numeric', month:'short', hour:'2-digit', minute:'2-digit'}) : 'Sin fecha';
    const borrado = new Date(e.eliminado_at).toLocaleString('es-MX', {day:'numeric', month:'short', hour:'2-digit', minute:'2-digit'});
    const card = document.createElement('div');
    card.className = 'elim-card';
    card.innerHTML = `<div class="el-info"><b>${escHtml(p.nombre_cliente || 'Sin nombre')}</b> · ${escHtml(fmtDinero(p.precio))}<br>
      ${escHtml(producto)}${det ? ' — ' + escHtml(det) : ''}<br>
      Entrega: ${escHtml(entrega)}<br>
      <span style="color:var(--muted); font-size:12.5px;">Borrado el ${escHtml(borrado)}</span></div>`;
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'primary'; btn.textContent = 'Recuperar';
    btn.onclick = () => recuperarPedido(e, btn);
    card.appendChild(btn);
    cont.appendChild(card);
  });
}
async function recuperarPedido(e, btn){
  const p = e.pedido || {};
  if(!confirm(`¿Recuperar el pedido de ${p.nombre_cliente || 'este cliente'}?`)) return;
  btn.disabled = true; btn.textContent = 'Recuperando...';
  const { error } = await sb.rpc('recuperar_pedido', { eliminado_id: e.id });
  if(error){ btn.disabled = false; btn.textContent = 'Recuperar'; alert('No se pudo recuperar: ' + error.message); return; }
  abrirEliminados();
}
// ---------- Editar / ingresar pago de un pedido (directora) ----------
let pedidoAccion = null;
let pgMetodo = null;
function elegirAccionPedido(id){
  if(rolActual !== 'director') return;
  const p = pedidosPorId[id]; if(!p) return;
  pedidoAccion = p;
  document.getElementById('acc-titulo').textContent = p.nombre_cliente || 'Pedido';
  const tot = Number(p.precio)||0, falta = Math.max(0, tot - pagadoDe(p));
  document.getElementById('acc-sub').textContent = detallePedidoPOS(p) + ' · Total ' + fmtDinero(tot) + (falta > 0 ? ' · Falta ' + fmtDinero(falta) : ' · Pagado');
  abrirModal('acc');
}
function accionEditarPedido(){ cerrarModal('acc'); if(pedidoAccion) abrirEditarPedido(pedidoAccion.id); }
function accionRegistrarPago(){
  cerrarModal('acc');
  const p = pedidoAccion; if(!p) return;
  const tot = Number(p.precio)||0, pag = pagadoDe(p), falta = Math.max(0, tot - pag);
  document.getElementById('pg-titulo').textContent = 'Ingresar pago — ' + (p.nombre_cliente || 'Pedido');
  document.getElementById('pg-sub').textContent = detallePedidoPOS(p) + (p.fecha_entrega ? ' · para el ' + new Date(p.fecha_entrega).toLocaleDateString('es-MX',{weekday:'long', day:'numeric', month:'long'}) : '');
  document.getElementById('pg-total').textContent = fmtDinero(tot);
  document.getElementById('pg-pagado').textContent = fmtDinero(pag);
  document.getElementById('pg-falta').textContent = falta > 0 ? fmtDinero(falta) : '✓ $0';
  const hist = [];
  if(Number(p.anticipo) > 0) hist.push(`Anticipo ${fmtDinero(p.anticipo)}${p.metodo_pago ? ' (' + formatNombre(p.metodo_pago) + ')' : ''}`);
  pagosDe(p).forEach(x=> hist.push(`${fmtDinero(x.monto)} (${formatNombre(x.metodo)}) el ${new Date(x.fecha).toLocaleDateString('es-MX',{day:'numeric', month:'short'})}`));
  if(Number(p.pago_entrega) > 0) hist.push(`${fmtDinero(p.pago_entrega)} al entregar (${formatNombre(p.metodo_entrega || '')})`);
  document.getElementById('pg-historial').textContent = hist.length ? 'Pagos anteriores: ' + hist.join(' · ') : 'Todavía no hay pagos registrados.';
  document.getElementById('pg-monto').value = falta > 0 ? falta : '';
  pgMetodo = null;
  document.querySelectorAll('#pg-metodos .chip').forEach(c=>c.classList.remove('selected'));
  document.getElementById('pg-msg').className = 'msg';
  abrirModal('pg');
}
document.querySelectorAll('#pg-metodos .chip').forEach(c=> c.addEventListener('click', ()=>{
  pgMetodo = c.dataset.m;
  document.querySelectorAll('#pg-metodos .chip').forEach(x=>x.classList.toggle('selected', x === c));
}));
async function guardarPagoPedido(){
  const p = pedidoAccion; if(!p) return;
  const msg = document.getElementById('pg-msg'); msg.className = 'msg';
  const monto = Number(document.getElementById('pg-monto').value);
  if(!(monto > 0)){ msg.className = 'msg err'; msg.textContent = 'Escribe el monto que pagó.'; return; }
  if(!pgMetodo){ msg.className = 'msg err'; msg.textContent = 'Elige el método de pago.'; return; }
  const pagos = [...pagosDe(p), { monto, metodo: pgMetodo, fecha: new Date().toISOString() }];
  const btn = document.getElementById('pg-guardar'); btn.disabled = true; btn.textContent = 'Guardando...';
  const { data, error } = await sb.from('pedidos').update({ pagos }).eq('id', p.id).select();
  btn.disabled = false; btn.textContent = 'Guardar pago';
  if(error){ msg.className = 'msg err'; msg.textContent = 'No se pudo guardar: ' + error.message; return; }
  if(!data || !data.length){ msg.className = 'msg err'; msg.textContent = 'No se guardó. Revisa que ya se haya corrido el SQL de pagos.'; return; }
  cerrarModal('pg');
  refrescarVistaActual();
}
// ---------- Imprimir hoja de pedidos del día (carta horizontal) ----------
function imprimirPedidosDia(titulo, pedidos){
  const e = escHtml;
  const lista = pedidos.slice().sort((a,b)=> (a.nombre_cliente||'').localeCompare(b.nombre_cliente||'', 'es', {sensitivity:'base'}));
  const filas = lista.map((p, i)=>{
    const prod = {pastel:'Pastel', cupcake:'Cupcakes', individual:'Cuchareables', panque:'Panqués'}[p.categoria] || p.categoria || '';
    const tam = p.categoria === 'pastel' ? formatNombre(p.tamano_o_sabor) : '';
    const det = p.categoria === 'pastel'
      ? [formatNombre(p.sabor), p.decorado ? 'Decorado' + (p.decorado_descripcion ? ': ' + p.decorado_descripcion : '') : ''].filter(Boolean).join(' · ')
      : (p.sabor || '');
    const hora = p.fecha_entrega ? new Date(p.fecha_entrega).toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'}) : '';
    const ent = p.entrega === 'domicilio' ? `<b>Domicilio${hora ? ' · ' + hora : ''}</b>` : p.entrega === 'casa' ? 'Recoger en casa' : 'Recoger en local';
    const corona = p.categoria === 'pastel' ? (textoCorona(p) || 'Sin corona') : '';
    const pagado = pagadoDe(p), falta = Math.max(0, (Number(p.precio)||0) - pagado);
    const pago = falta <= 0 ? '<b>Pagado</b>'
      : pagado > 0 ? `Anticipo ${fmtDinero(pagado)}<small><b>Falta ${fmtDinero(falta)}</b></small>`
      : `<b>No ha pagado</b><small>Falta ${fmtDinero(falta)}</small>`;
    return `<tr>
      <td class="c">${i+1}</td>
      <td><b>${e(p.nombre_cliente || '')}</b>${p.telefono ? `<small class="tel">${e(String(p.telefono).replace(/\s+/g,''))}</small>` : ''}${p.recibe_nombre ? `<small>Recibe: ${e(p.recibe_nombre)}${p.recibe_telefono ? ' · ' + e(p.recibe_telefono) : ''}</small>` : ''}</td>
      <td>${e(prod)}${tam ? `<small>${e(tam)}</small>` : ''}</td>
      <td>${e(det)}</td>
      <td>${e(corona)}</td>
      <td>${ent}${p.entrega === 'domicilio' && p.direccion ? `<small>${e(p.direccion)}</small>` : ''}</td>
      <td>${pago}</td>
      <td>${e(p.notas || '')}</td>
    </tr>`;
  }).join('');
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Pedidos ${e(titulo)}</title>
<style>
  @page{size:letter landscape; margin:6mm 7mm;}
  *{box-sizing:border-box}
  body{font-family:Arial,Helvetica,sans-serif; color:#000; margin:0; font-size:15px; line-height:1.25;}
  table{width:100%; border-collapse:collapse;}
  thead{display:table-header-group;}
  tr{page-break-inside:avoid;}
  .cab td{border:none; padding:0 0 5px;}
  .cab-in{display:flex; justify-content:space-between; align-items:center;}
  .fecha{font-family:Georgia,'Times New Roman',serif; font-size:26px; font-weight:bold;}
  .marca{text-align:center; line-height:1;}
  .marca .n{font-family:Georgia,serif; font-size:28px; letter-spacing:1px;}
  .marca .s{font-size:9px; letter-spacing:4px; margin-top:2px;}
  th{background:#bdbdbd; border:2px solid #000; padding:6px 5px; font-size:15px; font-weight:bold; text-align:left;}
  td{border:2px solid #000; padding:7px 6px; vertical-align:top;}
  td b{font-size:16px;}
  td small{display:block; font-size:13px; margin-top:3px;}
  td small.tel{font-size:14px; white-space:nowrap;}
  .c{text-align:center}
</style></head><body>
<table>
  <thead>
    <tr class="cab"><td colspan="8"><div class="cab-in">
      <div class="fecha">${e(titulo)}</div>
      <div class="marca"><div class="n">CONNIE</div><div class="s">FINA REPOSTERÍA</div></div>
    </div></td></tr>
    <tr><th style="width:4%" class="c">No</th><th style="width:15%">Nombre</th><th style="width:8%">Producto</th><th style="width:16%">Sabor / detalle</th><th style="width:9%">Corona</th><th style="width:15%">Entrega</th><th style="width:12%">Pago</th><th>Comentarios</th></tr>
  </thead>
  <tbody>${filas}</tbody>
</table>
<script>window.onload = () => { setTimeout(() => window.print(), 250); };<\/script>
</body></html>`;
  const w = window.open('', '_blank');
  if(!w){ alert('Permite las ventanas emergentes para poder imprimir.'); return; }
  w.document.open(); w.document.write(html); w.document.close();
}
