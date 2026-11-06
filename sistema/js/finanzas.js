// Finanzas (solo directora). Por ahora: tabla de insumos (presentación de compra y precio).
// Cada cambio de cantidad o precio queda en el historial (lo guarda Supabase, ver sql/031).
// Más adelante aquí van: tickets de compra, recetas y costos, alertas y estado de resultados.

let insumosData = [];
const UNIDADES = { g:'g', ml:'ml', pza:'piezas' };

function abrirFinanzas(){
  activarVistaDirectora('tab-finanzas', 'view-finanzas');
  cargarInsumos();
}
async function cargarInsumos(){
  const cont = document.getElementById('insumos-contenido');
  cont.className = 'loading'; cont.textContent = 'Cargando...';
  const { data, error } = await sb.from('insumos').select('*').order('nombre');
  if(error){ cont.className = 'empty'; cont.textContent = 'No se pudieron cargar los insumos: ' + error.message + ' (revisa que ya se haya corrido el SQL de finanzas).'; return; }
  insumosData = data || [];
  pintarInsumos();
}
function filaInsumo(r){
  const id = r.id ? Number(r.id) : 'nuevo';
  const fecha = r.updated_at ? new Date(r.updated_at).toLocaleDateString('es-MX', {day:'numeric', month:'short'}) : '';
  return `<tr data-id="${id}">
    <td><input type="text" class="ins-nombre" value="${escHtml(r.nombre || '')}" placeholder="Ej. Harina" onchange="guardarInsumo(this)"></td>
    <td class="ins-cant"><input type="number" inputmode="decimal" min="0" step="any" class="ins-cantidad" value="${r.cantidad ?? ''}" placeholder="1000" onchange="guardarInsumo(this)">
      <select class="ins-unidad" onchange="guardarInsumo(this)" aria-label="Unidad">${Object.entries(UNIDADES).map(([k, t])=> `<option value="${k}"${(r.unidad || 'g') === k ? ' selected' : ''}>${t}</option>`).join('')}</select></td>
    <td><div class="ins-precio"><span>$</span><input type="number" inputmode="decimal" min="0" step="any" class="ins-precio-in" value="${r.precio ?? ''}" placeholder="0" onchange="guardarInsumo(this)"></div></td>
    <td class="ins-estado">${fecha ? 'Act. ' + fecha : ''}</td>
    <td class="c">${r.id ? `<button type="button" class="ins-quitar" aria-label="Quitar insumo" onclick="quitarInsumo(${id})">×</button>` : ''}</td>
  </tr>`;
}
function pintarInsumos(){
  const cont = document.getElementById('insumos-contenido');
  cont.className = '';
  cont.innerHTML = `<div class="seccion-resumen"><h3>Insumos</h3>
    <div class="hint" style="margin:-4px 0 10px;">Lo que compras: cuánto trae la presentación y cuánto cuesta. Se guarda solo al cambiar un dato.</div>
    <div class="tabla-scroll"><table class="tabla-insumos">
      <thead><tr><th>Insumo</th><th>Cantidad</th><th>Precio</th><th></th><th></th></tr></thead>
      <tbody id="insumos-filas">${insumosData.map(filaInsumo).join('')}</tbody>
    </table></div>
    <button type="button" class="btn-secundario" onclick="agregarFilaInsumo()">+ Agregar insumo</button>
    <div class="msg" id="insumos-msg"></div></div>`;
  if(!insumosData.length) agregarFilaInsumo();
}
function agregarFilaInsumo(){
  const tb = document.getElementById('insumos-filas');
  if(tb.querySelector('tr[data-id="nuevo"]')){ tb.querySelector('tr[data-id="nuevo"] .ins-nombre').focus(); return; }
  tb.insertAdjacentHTML('beforeend', filaInsumo({}));
  tb.querySelector('tr[data-id="nuevo"] .ins-nombre').focus();
}
async function guardarInsumo(el){
  const tr = el.closest('tr'), msg = document.getElementById('insumos-msg'), estado = tr.querySelector('.ins-estado');
  const nombre = tr.querySelector('.ins-nombre').value.trim();
  const cantidad = tr.querySelector('.ins-cantidad').value === '' ? null : Number(tr.querySelector('.ins-cantidad').value);
  const precio = tr.querySelector('.ins-precio-in').value === '' ? null : Number(tr.querySelector('.ins-precio-in').value);
  const datos = { nombre, unidad: tr.querySelector('.ins-unidad').value, cantidad: cantidad > 0 ? cantidad : null, precio: precio >= 0 ? precio : null, updated_at: new Date().toISOString() };
  msg.className = 'msg';
  if(!nombre){ if(tr.dataset.id !== 'nuevo'){ msg.className = 'msg err'; msg.textContent = 'El insumo necesita nombre.'; } return; }
  estado.textContent = 'Guardando...';
  const esNuevo = tr.dataset.id === 'nuevo';
  const q = esNuevo ? sb.from('insumos').insert([datos]).select().single() : sb.from('insumos').update(datos).eq('id', Number(tr.dataset.id)).select().single();
  const { data, error } = await q;
  if(error){
    estado.textContent = '';
    msg.className = 'msg err';
    msg.textContent = /duplicate|unique/i.test(error.message) ? `Ya existe un insumo llamado "${nombre}".` : 'No se pudo guardar: ' + error.message;
    return;
  }
  const i = insumosData.findIndex(x=> x.id === data.id);
  if(i >= 0) insumosData[i] = data; else insumosData.push(data);
  tr.dataset.id = data.id;
  estado.textContent = 'Guardado';
  if(esNuevo) tr.querySelector('td.c').innerHTML = `<button type="button" class="ins-quitar" aria-label="Quitar insumo" onclick="quitarInsumo(${Number(data.id)})">×</button>`;
}
async function quitarInsumo(id){
  const r = insumosData.find(x=> x.id === id); if(!r) return;
  if(!confirm(`¿Quitar "${r.nombre}" de los insumos? También se borra su historial de precios.`)) return;
  const { error } = await sb.from('insumos').delete().eq('id', id);
  if(error){ alert('No se pudo quitar: ' + error.message); return; }
  insumosData = insumosData.filter(x=> x.id !== id);
  pintarInsumos();
}
