// Pedidos → "Por confirmar": lo que mandan desde la página (tabla solicitudes, estado 'nueva').
// "Revisar y aceptar" abre el pedido en el formulario de Nuevo pedido ya lleno; al guardarlo se crea
// el pedido de siempre (Confirmados) y la solicitud queda 'aceptada'. "Cancelar pedido" la deja 'cancelada'.
// El cliente NO se da de alta solo: se busca o se agrega a mano (para no repetir clientes).

let seccionPedidos = 'confirmados';
let solicitudesPorId = {};
let solicitudEnRevision = null;

function veSolicitudes(){ return rolActual === 'director'; }

function elegirSeccionPedidos(s){
  seccionPedidos = s;
  document.querySelectorAll('#pedidos-secciones .chip').forEach(c=> c.classList.toggle('selected', c.dataset.s === s));
  document.getElementById('pedidos-porconfirmar').style.display = s === 'porconfirmar' ? 'block' : 'none';
  document.getElementById('pedidos-confirmados').style.display = s === 'confirmados' ? 'block' : 'none';
  if(s === 'porconfirmar') cargarSolicitudes();
}

// Se llama al entrar a Pedidos: muestra las dos secciones (solo directora) y el número por confirmar
async function refrescarSeccionesPedidos(){
  const chips = document.getElementById('pedidos-secciones');
  if(!veSolicitudes()){
    chips.style.display = 'none';
    document.getElementById('pedidos-porconfirmar').style.display = 'none';
    document.getElementById('pedidos-confirmados').style.display = 'block';
    return;
  }
  chips.style.display = 'flex';
  elegirSeccionPedidos(seccionPedidos);
  if(seccionPedidos !== 'porconfirmar') await cargarSolicitudes(true);
}

function ponerConteoSolicitudes(n){
  const chip = document.querySelector('#pedidos-secciones .chip[data-s="porconfirmar"]');
  if(chip) chip.textContent = n ? `Por confirmar (${n})` : 'Por confirmar';
}

async function cargarSolicitudes(soloConteo){
  const cont = document.getElementById('solicitudes-contenido');
  if(!soloConteo){ cont.className = 'loading'; cont.textContent = 'Cargando…'; }
  const { data, error } = await sb.from('solicitudes').select('*').eq('estado', 'nueva').order('created_at', { ascending:true });
  if(error){
    if(!soloConteo){ cont.className = 'msg err'; cont.textContent = 'No se pudieron cargar los pedidos de la página: ' + error.message; }
    return;
  }
  const lista = data || [];
  solicitudesPorId = {};
  lista.forEach(s=> solicitudesPorId[s.id] = s);
  ponerConteoSolicitudes(lista.length);
  if(soloConteo) return;
  cont.className = '';
  if(!lista.length){ cont.innerHTML = '<div class="empty">No hay pedidos de la página por confirmar.</div>'; return; }
  cont.innerHTML = '<div class="hint" style="margin:0 0 12px;">Pedidos que mandaron desde la página. Revísalos, confírmalos con el cliente y acéptalos; ya aceptados se pasan a Confirmados.</div>'
    + lista.map(tarjetaSolicitud).join('');
}

function fechaCorta(f){
  if(!f) return '';
  return new Date(String(f).length <= 10 ? f + 'T12:00:00' : f).toLocaleDateString('es-MX', { weekday:'long', day:'numeric', month:'long' });
}
function itemsSolicitud(s){ return Array.isArray(s.items) ? s.items : []; }
function tituloItem(it){
  const t = it.tipo;
  if(t === 'pastel') return 'Pastel de ' + formatNombre(it.nombre);
  if(t === 'cheesecake') return 'Cheesecake ' + formatNombre(it.nombre);
  if(t === 'tresleches') return 'Pastel de tres leches';
  if(t === 'cupcake') return it.nombre || 'Cupcakes';
  if(t === 'cuchareable') return formatNombre(it.nombre);
  if(t === 'panque') return 'Panqué ' + formatNombre(it.nombre);
  return formatNombre(it.nombre || t || '');
}

function tarjetaSolicitud(s){
  const items = itemsSolicitud(s);
  const filas = items.map(it=>{
    const cant = Number(it.cantidad) || 1;
    const total = (Number(it.precio) || 0) * cant;
    return `<div class="sol-item"><div><b>${cant > 1 ? cant + ' × ' : ''}${escHtml(tituloItem(it))}</b>${it.detalle ? `<div class="hint" style="margin:2px 0 0;">${escHtml(it.detalle)}</div>` : ''}</div><b>${fmtDinero(total)}</b></div>`;
  }).join('');
  const entrega = s.entrega === 'domicilio' ? 'A domicilio' + (s.direccion ? ': ' + s.direccion : '') : 'Recoge en el local';
  return `<div class="sol-card">
    <div class="sol-cab"><div><b>${escHtml(s.nombre || '')}</b> · ${escHtml(s.telefono || '')}</div>
      <span class="hint" style="margin:0;">Lo mandó el ${escHtml(fechaCorta(s.created_at))}</span></div>
    <div class="sol-dato"><span>Para</span> ${escHtml(fechaCorta(s.fecha_deseada) || 'sin fecha')}</div>
    <div class="sol-dato"><span>Entrega</span> ${escHtml(entrega)}</div>
    <div class="sol-items">${filas || '<div class="hint">Sin productos.</div>'}</div>
    <div class="sol-total"><span>Total estimado</span><b>${fmtDinero(s.total)}</b></div>
    ${s.comentarios ? `<div class="sol-dato"><span>Comentarios</span> ${escHtml(s.comentarios)}</div>` : ''}
    <div class="botones-fila">
      <button type="button" class="btn-borrar" onclick="cancelarSolicitud(${Number(s.id)})">Cancelar pedido</button>
      <button type="button" class="primary" onclick="revisarSolicitud(${Number(s.id)})">Revisar y aceptar</button>
    </div>
  </div>`;
}

async function cambiarEstadoSolicitud(id, estado){
  const { data, error } = await sb.from('solicitudes').update({ estado }).eq('id', id).select();
  if(error) return 'No se pudo guardar: ' + error.message;
  if(!data || !data.length) return 'No se guardó el cambio (revisa permisos).';
  return null;
}
async function cancelarSolicitud(id){
  const s = solicitudesPorId[id]; if(!s) return;
  if(!confirm(`¿Cancelar el pedido de ${s.nombre}? Ya no se va a poder recuperar.`)) return;
  const err = await cambiarEstadoSolicitud(id, 'cancelada');
  if(err){ alert(err); return; }
  cargarSolicitudes();
}

// ---------- Convertir lo que pidió en la página a productos del formulario ----------
function claveSol(t){ return (t||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]/g,''); }
function productosDeSolicitud(s){
  const productos = [];
  const sumas = { cupcake:{}, individual:{}, panque:{} };   // nombre -> cantidad
  const precios = { cupcake:0, individual:0, panque:0 };
  const cajas = [];
  itemsSolicitud(s).forEach(it=>{
    const cant = Number(it.cantidad) || 1;
    const precio = (Number(it.precio) || 0) * cant;
    if(it.tipo === 'pastel' || it.tipo === 'cheesecake' || it.tipo === 'tresleches'){
      let sabor = it.nombre || '';
      if(it.tipo === 'tresleches'){ const r = saboresPastelesData.find(x=> claveSol(x.nombre) === 'tresleches'); if(r) sabor = r.nombre; }
      const tam = (it.tamano || '').toLowerCase() === 'mini' ? 'mini' : 'normal';
      let cor = { corona_tipo:null, corona_tamano:null, corona_color:null, corona_precio:null };
      if(it.corona === 'incluida') cor = { corona_tipo:'incluida', corona_tamano:tam, corona_color:null, corona_precio:0 };
      else if(it.corona === 'ambar') cor = { corona_tipo:'ambar', corona_tamano:tam, corona_color:null, corona_precio:precioCorona('ambar', tam) };
      const nota = [it.base === 'blanca' ? 'Base blanca' : '', it.relleno ? 'Relleno de ' + String(it.relleno).toLowerCase() : '', it.comentario ? 'Nota del cliente: ' + it.comentario : ''].filter(Boolean).join(' · ');
      for(let k = 0; k < cant; k++){
        productos.push({ categoria:'pastel', tamano_o_sabor: it.tamano || '', sabor, precio: String(Number(it.precio) || 0), ...cor,
          decorado:false, decorado_descripcion:null, ...(nota ? { nota_producto: nota } : {}) });
      }
    } else if(it.tipo === 'cupcake'){
      Object.entries(it.sabores || {}).forEach(([n, q])=>{ sumas.cupcake[n] = (sumas.cupcake[n] || 0) + Number(q) * cant; });
      precios.cupcake += precio;
      if(it.caja) cajas.push(`Caja de ${it.caja}: ` + Object.entries(it.sabores || {}).map(([n, q])=> `${q} ${formatNombre(n)}`).join(', '));
    } else if(it.tipo === 'cuchareable' || it.tipo === 'panque'){
      const cat = it.tipo === 'panque' ? 'panque' : 'individual';
      sumas[cat][it.nombre] = (sumas[cat][it.nombre] || 0) + cant;
      precios[cat] += precio;
    }
  });
  ['cupcake','individual','panque'].forEach(cat=>{
    const partes = Object.entries(sumas[cat]);
    if(!partes.length) return;
    const nota = cat === 'cupcake' && cajas.length > 1 ? cajas.join(' · ') : '';  // con una sola caja ya lo dice el sabor
    productos.push({ categoria:cat, tamano_o_sabor:cat, sabor: partes.map(([n, q])=> `${q} ${formatNombre(n)}`).join(', '), precio: String(precios[cat]),
      corona_tipo:null, corona_tamano:null, corona_color:null, corona_precio:null, decorado:false, decorado_descripcion:null,
      ...(nota ? { nota_producto: nota } : {}) });
  });
  return productos;
}

// ---------- Revisar y aceptar: el formulario de Nuevo pedido ya lleno ----------
function revisarSolicitud(id){
  const s = solicitudesPorId[id]; if(!s) return;
  switchView('nuevo');
  limpiarFormularioPedido();
  iniciarNuevoPedido();
  window.scrollTo(0, 0);
  solicitudEnRevision = s;
  productosPedido = productosDeSolicitud(s);
  pintarProductosPedido();
  // Cliente: no se crea solo. Se busca por el teléfono que dejó; si no está, "+ Cliente nuevo" (ya con sus datos)
  const tel = String(s.telefono || '').replace(/\D/g, '');
  document.getElementById('cliente-busqueda').value = tel.slice(-10);
  if(tel) buscarClientes();
  // Entrega y fecha
  if(s.entrega === 'domicilio'){
    elegirChip('#entrega-chips .chip[data-entrega="domicilio"]');
    if(s.direccion){
      const h = document.getElementById('dir-edicion-hint');
      h.textContent = 'Dirección que escribió el cliente: ' + s.direccion;
      h.style.display = 'block';
    }
  } else if(s.entrega) elegirChip('#entrega-chips .chip[data-entrega="recoger"]');
  if(s.fecha_deseada) document.getElementById('fecha_entrega').value = String(s.fecha_deseada).slice(0, 10);
  document.getElementById('notas').value = s.comentarios || '';
  document.getElementById('solicitud-titulo').textContent = `Pedido de la página: ${s.nombre || ''} · ${s.telefono || ''}`;
  document.getElementById('solicitud-sub').textContent = 'Busca al cliente abajo o agrégalo como nuevo. Puedes quitar o agregar productos. Al guardar se pasa a Confirmados.';
  document.getElementById('solicitud-banner').style.display = 'flex';
}
function terminarRevisionSolicitud(){
  solicitudEnRevision = null;
  document.getElementById('solicitud-banner').style.display = 'none';
}
function regresarASolicitudes(){
  limpiarFormularioPedido();
  seccionPedidos = 'porconfirmar';
  switchView('lista');
}
async function cancelarSolicitudEnRevision(){
  const s = solicitudEnRevision; if(!s) return;
  if(!confirm(`¿Cancelar el pedido de ${s.nombre}? Ya no se va a poder recuperar.`)) return;
  const err = await cambiarEstadoSolicitud(s.id, 'cancelada');
  if(err){ const msg = document.getElementById('msg'); msg.className = 'msg err'; msg.textContent = err; return; }
  regresarASolicitudes();
}
// "+ Cliente nuevo" estando en un pedido de la página: se llena con lo que escribió el cliente
function prellenarClienteDeSolicitud(){
  const s = solicitudEnRevision; if(!s) return;
  const partes = String(s.nombre || '').trim().split(/\s+/);
  if(!document.getElementById('cn-nombre').value) document.getElementById('cn-nombre').value = partes[0] || '';
  if(!document.getElementById('cn-apellido').value) document.getElementById('cn-apellido').value = partes.slice(1).join(' ');
  document.getElementById('cn-telefono').value = String(s.telefono || '').replace(/\D/g, '').slice(-10);
}
