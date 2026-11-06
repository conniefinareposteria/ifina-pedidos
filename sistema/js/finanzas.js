// Finanzas (solo directora). Se navega por categorías (chips de arriba).
//  · Costeo: insumos (lo de las recetas, por gramos) y empaques y desechables (velas, capacillos, cajas: por pieza).
//    Cada cambio de cantidad o precio queda en el historial (lo guarda Supabase, ver sql/031 y 032).
// Más adelante: tickets de compra, recetas y costos, alertas y estado de resultados.

let insumosData = [];
let finCategoria = 'costeo';
const FIN_CATEGORIAS = [ { id:'costeo', titulo:'Costeo' } ];
const UNIDADES = { g:'g', ml:'ml', pza:'piezas' };
// Tablas dentro de Costeo
const FIN_TABLAS = {
  insumo:   { titulo:'Insumos', nota:'Lo que usas en las recetas: cuánto trae la presentación y cuánto cuesta.', ph:'Ej. Harina', conUnidad:true },
  material: { titulo:'Empaques y desechables', nota:'Velas, capacillos, cajas, bases… por pieza. El precio por pieza se calcula solo.', ph:'Ej. Capacillos', conUnidad:false }
};

function abrirFinanzas(){
  activarVistaDirectora('tab-finanzas', 'view-finanzas');
  cargarInsumos();
}
function elegirCategoriaFinanzas(id){ finCategoria = id; pintarFinanzas(); }
async function cargarInsumos(){
  const cont = document.getElementById('insumos-contenido');
  cont.className = 'loading'; cont.textContent = 'Cargando...';
  const { data, error } = await sb.from('insumos').select('*').order('nombre');
  if(error){ cont.className = 'empty'; cont.textContent = 'No se pudieron cargar los insumos: ' + error.message + ' (revisa que ya se haya corrido el SQL de finanzas).'; return; }
  insumosData = (data || []).map(r=> ({ ...r, tipo: r.tipo || 'insumo' }));
  pintarFinanzas();
}
function pintarFinanzas(){
  const cont = document.getElementById('insumos-contenido');
  cont.className = '';
  const chips = `<div class="chip-group cf-chips">${FIN_CATEGORIAS.map(c=> `<div class="chip${c.id === finCategoria ? ' selected' : ''}" onclick="elegirCategoriaFinanzas('${c.id}')">${c.titulo}</div>`).join('')}</div>`;
  cont.innerHTML = chips + Object.keys(FIN_TABLAS).map(tablaFinanzas).join('');
  Object.keys(FIN_TABLAS).forEach(t=>{ if(!insumosData.some(r=> r.tipo === t)) agregarFilaInsumo(t); });
}
function porPieza(r){ return r.cantidad > 0 && r.precio != null ? '$' + (r.precio / r.cantidad).toLocaleString('es-MX', {minimumFractionDigits:2, maximumFractionDigits:2}) : '—'; }
function filaInsumo(r, tipo){
  const conf = FIN_TABLAS[tipo];
  const id = r.id ? Number(r.id) : 'nuevo';
  const fecha = r.updated_at ? new Date(r.updated_at).toLocaleDateString('es-MX', {day:'numeric', month:'short'}) : '';
  return `<tr data-id="${id}" data-tipo="${tipo}">
    <td><input type="text" class="ins-nombre" value="${escHtml(r.nombre || '')}" placeholder="${conf.ph}" onchange="guardarInsumo(this)"></td>
    <td class="ins-cant"><input type="number" inputmode="decimal" min="0" step="any" class="ins-cantidad" value="${r.cantidad ?? ''}" placeholder="${conf.conUnidad ? '1000' : '100'}" onchange="guardarInsumo(this)">
      ${conf.conUnidad ? `<select class="ins-unidad" onchange="guardarInsumo(this)" aria-label="Unidad">${Object.entries(UNIDADES).map(([k, t])=> `<option value="${k}"${(r.unidad || 'g') === k ? ' selected' : ''}>${t}</option>`).join('')}</select>` : '<input type="hidden" class="ins-unidad" value="pza">'}</td>
    <td><div class="ins-precio"><span>$</span><input type="number" inputmode="decimal" min="0" step="any" class="ins-precio-in" value="${r.precio ?? ''}" placeholder="0" onchange="guardarInsumo(this)"></div></td>
    ${conf.conUnidad ? '' : `<td class="ins-pieza">${porPieza(r)}</td>`}
    <td class="ins-estado">${fecha ? 'Act. ' + fecha : ''}</td>
    <td class="c">${r.id ? `<button type="button" class="ins-quitar" aria-label="Quitar" onclick="quitarInsumo(${id})">×</button>` : ''}</td>
  </tr>`;
}
function tablaFinanzas(tipo){
  const conf = FIN_TABLAS[tipo];
  return `<div class="seccion-resumen fin-tabla"><h3>${conf.titulo}</h3>
    <div class="hint" style="margin:-4px 0 10px;">${conf.nota} Se guarda solo al cambiar un dato.</div>
    <div class="tabla-scroll"><table class="tabla-insumos">
      <thead><tr><th>${conf.titulo === 'Insumos' ? 'Insumo' : 'Producto'}</th><th>${conf.conUnidad ? 'Cantidad' : 'Piezas'}</th><th>Precio</th>${conf.conUnidad ? '' : '<th>Por pieza</th>'}<th></th><th></th></tr></thead>
      <tbody id="insumos-filas-${tipo}">${insumosData.filter(r=> r.tipo === tipo).map(r=> filaInsumo(r, tipo)).join('')}</tbody>
    </table></div>
    <button type="button" class="btn-secundario" onclick="agregarFilaInsumo('${tipo}')">+ Agregar ${tipo === 'insumo' ? 'insumo' : 'producto'}</button>
    <div class="msg" id="insumos-msg-${tipo}"></div></div>`;
}
function agregarFilaInsumo(tipo){
  const tb = document.getElementById('insumos-filas-' + tipo);
  const ya = tb.querySelector('tr[data-id="nuevo"]');
  if(ya){ ya.querySelector('.ins-nombre').focus(); return; }
  tb.insertAdjacentHTML('beforeend', filaInsumo({}, tipo));
  if(insumosData.some(r=> r.tipo === tipo)) tb.querySelector('tr[data-id="nuevo"] .ins-nombre').focus();
}
async function guardarInsumo(el){
  const tr = el.closest('tr'), tipo = tr.dataset.tipo;
  const msg = document.getElementById('insumos-msg-' + tipo), estado = tr.querySelector('.ins-estado');
  const nombre = tr.querySelector('.ins-nombre').value.trim();
  const cantidad = tr.querySelector('.ins-cantidad').value === '' ? null : Number(tr.querySelector('.ins-cantidad').value);
  const precio = tr.querySelector('.ins-precio-in').value === '' ? null : Number(tr.querySelector('.ins-precio-in').value);
  const datos = { nombre, tipo, unidad: tr.querySelector('.ins-unidad').value, cantidad: cantidad > 0 ? cantidad : null, precio: precio >= 0 ? precio : null, updated_at: new Date().toISOString() };
  msg.className = 'msg';
  if(!nombre){ if(tr.dataset.id !== 'nuevo'){ msg.className = 'msg err'; msg.textContent = 'Necesita nombre.'; } return; }
  estado.textContent = 'Guardando...';
  const esNuevo = tr.dataset.id === 'nuevo';
  const q = esNuevo ? sb.from('insumos').insert([datos]).select().single() : sb.from('insumos').update(datos).eq('id', Number(tr.dataset.id)).select().single();
  const { data, error } = await q;
  if(error){
    estado.textContent = '';
    msg.className = 'msg err';
    msg.textContent = /duplicate|unique/i.test(error.message) ? `Ya existe uno llamado "${nombre}".` : 'No se pudo guardar: ' + error.message + (/tipo/.test(error.message) ? ' (revisa que ya se haya corrido el SQL de empaques).' : '');
    return;
  }
  const i = insumosData.findIndex(x=> x.id === data.id);
  if(i >= 0) insumosData[i] = data; else insumosData.push(data);
  tr.dataset.id = data.id;
  estado.textContent = 'Guardado';
  const pz = tr.querySelector('.ins-pieza'); if(pz) pz.textContent = porPieza(data);
  if(esNuevo) tr.querySelector('td.c').innerHTML = `<button type="button" class="ins-quitar" aria-label="Quitar" onclick="quitarInsumo(${Number(data.id)})">×</button>`;
}
async function quitarInsumo(id){
  const r = insumosData.find(x=> x.id === id); if(!r) return;
  if(!confirm(`¿Quitar "${r.nombre}"? También se borra su historial de precios.`)) return;
  const { error } = await sb.from('insumos').delete().eq('id', id);
  if(error){ alert('No se pudo quitar: ' + error.message); return; }
  insumosData = insumosData.filter(x=> x.id !== id);
  pintarFinanzas();
}
