// Compras (solo directora): inventario, lista de compras por tienda y registro de lo que se compró.
// Datos en Supabase (sql/042): compras_tiendas, compras_articulos, compras_presentaciones,
// compras_listas, compras_lista_items, compras_movimientos. La base son los insumos de Finanzas (tabla insumos).
// Cantidades: el inventario se cuenta en la "unidad de conteo" de cada insumo (costal, caja...),
// y por dentro todo se convierte a g / ml / piezas para comparar presentaciones y precios.

let cmp = { tiendas: [], insumos: [], arts: {}, pres: [], lista: null, items: {}, movs: [], hist: [], vista: 'inventario', abierto: null, buscar: '', cargado: false };

const CMP_VISTAS = [ { id:'inventario', titulo:'Inventario' }, { id:'comprar', titulo:'Comprar' }, { id:'ajustes', titulo:'Ajustes' } ];

// ---------- Utilidades ----------
const cmpNum = v => { if(v == null) return null; const s = String(v).trim().replace(',', '.'); return s === '' || isNaN(Number(s)) ? null : Number(s); };
const cmpFmt = n => n == null ? '' : Number(n).toLocaleString('es-MX', { maximumFractionDigits: 2 });
const cmpBase = i => i.unidad === 'kg' ? 'g' : i.unidad;                       // g / ml / pza
const cmpFactor = i => cmpBase(i) === 'pza' ? 1 : 1000;                         // se captura en kg / L / piezas
const cmpUGrande = i => ({ g:'kg', ml:'L', pza:'pzas' })[cmpBase(i)];
const cmpInsumo = id => cmp.insumos.find(i=> i.id === id);
const cmpTienda = id => cmp.tiendas.find(t=> t.id === id);
function cmpArt(i){ return cmp.arts[i.id] || { insumo_id: i.id, activo: false, unidad_conteo: null, contenido: null, objetivo: null, tiendas: [] }; }
// Lo que trae la presentación de Finanzas, en g / ml / piezas
function cmpContFinanzas(i){ const c = Number(i.cantidad); return c > 0 ? (i.unidad === 'kg' ? c * 1000 : c) : null; }
function cmpContenido(i){ const a = cmpArt(i); return Number(a.contenido) || cmpContFinanzas(i) || cmpFactor(i); }
function cmpUnidad(i){ const a = cmpArt(i); return (a.unidad_conteo || '').trim() || (a.contenido || cmpContFinanzas(i) ? 'paquete' : cmpUGrande(i)); }
// "10 kg", "900 g", "30 pzas"
function cmpFmtCont(base, i){
  const u = cmpBase(i);
  if(u === 'pza') return cmpFmt(base) + (base === 1 ? ' pza' : ' pzas');
  return base >= 1000 ? cmpFmt(base / 1000) + (u === 'g' ? ' kg' : ' L') : cmpFmt(base) + ' ' + u;
}
function cmpPlural(w, n){ if(n === 1 || !w) return w; if(/(s|kg|g|ml|L|pzas)$/.test(w)) return w; return /[aeiou]$/i.test(w) ? w + 's' : w + 'es'; }
// La unidad de conteo es el mismo kg / L / pieza (no tiene presentación)
function cmpSuelto(i){ return cmpUnidad(i) === cmpUGrande(i) && cmpContenido(i) === cmpFactor(i); }
function cmpDescUnidad(i){ return cmpSuelto(i) ? 'en ' + cmpUGrande(i) : cmpUnidad(i) + ' de ' + cmpFmtCont(cmpContenido(i), i); }
function cmpCantUnidad(n, i){ return cmpFmt(n) + ' ' + cmpPlural(cmpUnidad(i), Number(n)); }
// Precio por kg / L / pieza
function cmpFmtPU(pu, i){ return pu == null ? '—' : '$' + (pu * cmpFactor(i)).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + '/' + ({ g:'kg', ml:'L', pza:'pza' })[cmpBase(i)]; }
function cmpMes(d){ return d.toLocaleDateString('es-MX', { month: 'long' }); }
function cmpMsg(t, tipo){ const m = document.getElementById('cmp-msg'); if(!m) return; m.className = 'msg' + (tipo ? ' ' + tipo : ''); m.textContent = t || ''; if(tipo === 'ok') setTimeout(()=>{ if(m.textContent === t){ m.className = 'msg'; m.textContent = ''; } }, 2500); }

// ---------- Cargar ----------
function abrirCompras(){
  activarVistaDirectora('tab-compras', 'view-compras');
  cargarCompras();
}
async function cargarCompras(){
  const cont = document.getElementById('compras-contenido');
  if(!cmp.cargado){ cont.className = 'loading'; cont.textContent = 'Cargando...'; }
  const ini = new Date(); ini.setMonth(ini.getMonth() - 1, 1);
  const desde = fechaStrDesdeDate(ini);
  const [ri, rt, ra, rp, rl, rh, rm] = await Promise.all([
    sb.from('insumos').select('*').order('nombre'),
    sb.from('compras_tiendas').select('*').order('id'),
    sb.from('compras_articulos').select('*'),
    sb.from('compras_presentaciones').select('*').order('id'),
    sb.from('compras_listas').select('*').eq('cerrada', false).order('id', { ascending: false }).limit(1),
    sb.from('insumos_historial').select('*').gte('fecha', desde),
    sb.from('compras_movimientos').select('*').eq('estado', 'comprado').gte('created_at', desde)
  ]);
  const err = [ri, rt, ra, rp, rl].find(x=> x.error);
  if(err){ cont.className = 'empty'; cont.textContent = 'No se pudo cargar Compras: ' + err.error.message + '. ¿Ya se corrió el SQL 042?'; return; }
  cmp.insumos = (ri.data || []).filter(i=> !i.base_id).map(i=> ({ ...i, tipo: i.tipo || 'insumo' }));
  cmp.tiendas = rt.data || [];
  cmp.arts = {}; (ra.data || []).forEach(a=> cmp.arts[a.insumo_id] = { ...a, tiendas: a.tiendas || [] });
  cmp.pres = rp.data || [];
  cmp.lista = (rl.data || [])[0] || null;
  cmp.hist = [];
  (rh.data || []).forEach(h=>{ const i = cmpInsumo(h.insumo_id); const c = Number(h.cantidad) * (h.unidad === 'kg' ? 1000 : 1); if(i && c > 0 && h.precio != null) cmp.hist.push({ insumo_id: h.insumo_id, fecha: new Date(h.fecha), pu: Number(h.precio) / c, lista_id: null }); });
  (rm.data || []).forEach(m=>{ if(m.precio != null && Number(m.contenido) > 0) cmp.hist.push({ insumo_id: m.insumo_id, fecha: new Date(m.created_at), pu: Number(m.precio) / Number(m.contenido), lista_id: m.lista_id }); });
  await cargarListaCompras();
  cmp.cargado = true;
  pintarCompras();
}
async function cargarListaCompras(){
  cmp.items = {}; cmp.movs = [];
  if(!cmp.lista) return;
  const [a, b] = await Promise.all([
    sb.from('compras_lista_items').select('*').eq('lista_id', cmp.lista.id),
    sb.from('compras_movimientos').select('*').eq('lista_id', cmp.lista.id).order('id')
  ]);
  (a.data || []).forEach(x=> cmp.items[x.insumo_id] = x);
  cmp.movs = b.data || [];
}

// ---------- Pintar (deja el cursor donde estaba) ----------
function pintarCompras(){
  const cont = document.getElementById('compras-contenido');
  const act = document.activeElement;
  const k = act && act.dataset ? act.dataset.k : null;
  const msg = document.getElementById('cmp-msg');
  const msgPrev = msg ? [msg.className, msg.textContent] : null;
  cont.className = '';
  const chips = `<div class="chip-group cf-chips">${CMP_VISTAS.map(v=> `<div class="chip${v.id === cmp.vista ? ' selected' : ''}" onclick="elegirVistaCompras('${v.id}')">${v.titulo}</div>`).join('')}</div>`;
  const cuerpo = ({ inventario: vistaInventarioCompras, comprar: vistaComprar, ajustes: vistaAjustesCompras })[cmp.vista]();
  cont.innerHTML = chips + '<div class="msg" id="cmp-msg"></div>' + cuerpo;
  if(msgPrev){ const m = document.getElementById('cmp-msg'); m.className = msgPrev[0]; m.textContent = msgPrev[1]; }
  if(k){ const el = cont.querySelector(`[data-k="${CSS.escape(k)}"]`); if(el){ el.focus(); if(el.select && el.dataset.sel) el.select(); } }
  if(cmp.abierto) cmpCalcularCompra();
}
function cmpRepintar(){ setTimeout(pintarCompras, 0); }
function elegirVistaCompras(v){ cmp.vista = v; cmp.abierto = null; cmp.buscar = ''; pintarCompras(); window.scrollTo(0, 0); }
function cmpFiltrar(v){ cmp.buscar = v; const q = finQ(v); document.querySelectorAll('#compras-contenido [data-nombre]').forEach(tr=> tr.style.display = !q || finQ(tr.dataset.nombre).includes(q) ? '' : 'none'); }
function cmpBuscador(){ return `<input type="text" class="fin-buscar" placeholder="Buscar insumo" value="${escHtml(cmp.buscar)}" oninput="cmpFiltrar(this.value)">`; }
const cmpOculta = i => cmp.buscar && !finQ(i.nombre).includes(finQ(cmp.buscar)) ? ' style="display:none"' : '';

// ---------- Inventario ----------
// Cuánto comprar: lo que pusiste a mano, o (quiero tener − tengo) redondeado hacia arriba
function cmpComprarAuto(i){ const a = cmpArt(i), it = cmp.items[i.id]; if(a.objetivo == null || !it || it.tengo == null) return null; return Math.max(0, Math.ceil(Number(a.objetivo) - Number(it.tengo) - 1e-9)); }
function cmpComprar(i){ const it = cmp.items[i.id]; return it && it.comprar != null ? Number(it.comprar) : cmpComprarAuto(i); }
function cmpEnLista(i){ return cmpArt(i).activo || !!cmp.items[i.id]; }

function vistaInventarioCompras(){
  if(!cmp.lista) return `<div class="seccion-resumen">
    <div class="hint" style="margin:0 0 14px;">Cuenta lo que tienes de cada insumo; el sistema calcula cuánto comprar con la cantidad que quieres tener (se pone una vez en Ajustes).</div>
    <button type="button" class="primary" onclick="empezarConteoCompras()">Empezar conteo</button></div>`;
  const lista = cmp.insumos.filter(cmpEnLista).sort((a, b)=> a.nombre.localeCompare(b.nombre, 'es'));
  const grupos = [ ['Ingredientes', lista.filter(i=> i.tipo !== 'material')], ['Empaques', lista.filter(i=> i.tipo === 'material')] ];
  const fecha = new Date(cmp.lista.fecha + 'T12:00:00').toLocaleDateString('es-MX', { weekday:'long', day:'numeric', month:'long' });
  const sinObj = lista.filter(i=> cmpArt(i).objetivo == null).length;
  let html = `<div class="fin-titulo"><h3>Conteo del ${escHtml(fecha)}</h3></div>
    <div class="hint fin-nota">Pon cuánto tienes. "Comprar" se calcula solo; si viene temporada o quieres más, cámbialo a mano.${sinObj ? ` ${sinObj} ${sinObj === 1 ? 'insumo no tiene' : 'insumos no tienen'} "quiero tener": ponlo en Ajustes o escribe a mano cuánto comprar.` : ''}</div>
    ${lista.length ? cmpBuscador() : '<div class="empty">Todavía no hay insumos en la lista. En Ajustes marca los que compras seguido.</div>'}`;
  grupos.forEach(([titulo, arr])=>{
    if(!arr.length) return;
    html += `<div class="sub-titulo">${titulo}</div><div class="tabla-scroll"><table class="tabla-insumos cmp-tabla"><thead><tr><th>Insumo</th><th class="n">Tengo</th><th class="n">Quiero tener</th><th class="n">Comprar</th></tr></thead><tbody>
      ${arr.map(filaInventarioCompras).join('')}</tbody></table></div>`;
  });
  html += cmpAgregarOtro();
  if(lista.some(i=> cmpComprar(i) > 0)) html += `<button type="button" class="primary" style="margin-top:6px;" onclick="elegirVistaCompras('comprar')">Ir a comprar</button>`;
  return html;
}
function filaInventarioCompras(i){
  const a = cmpArt(i), it = cmp.items[i.id] || {};
  const auto = cmpComprarAuto(i), manual = it.comprar != null;
  const val = manual ? it.comprar : auto;
  const u = escHtml(cmpPlural(cmpUnidad(i), 2));
  return `<tr data-nombre="${escHtml(i.nombre)}"${cmpOculta(i)}>
    <td><b>${escHtml(i.nombre)}</b><div class="cmp-sub">${escHtml(cmpDescUnidad(i))}${!a.activo ? ' · solo esta vez' : ''}</div></td>
    <td class="n"><div class="cmp-cant"><input type="text" inputmode="decimal" data-k="ten-${i.id}" data-sel="1" value="${escHtml(cmpFmt(it.tengo))}" onchange="cambiarItemCompras(${i.id}, 'tengo', this.value)"><span>${u}</span></div></td>
    <td class="n">${a.objetivo != null ? cmpCantUnidad(a.objetivo, i) : '<span class="fin-falta">sin dato</span>'}</td>
    <td class="n"><div class="cmp-cant"><input type="text" inputmode="decimal" data-k="com-${i.id}" data-sel="1" class="${manual ? 'cmp-manual' : ''}" value="${escHtml(cmpFmt(val))}" onchange="cambiarItemCompras(${i.id}, 'comprar', this.value)"><span>${u}</span></div>
      ${manual ? `<div class="cmp-sub">a mano${auto != null ? ` · <a href="#" onclick="cambiarItemCompras(${i.id}, 'comprar', ''); return false;">volver a ${cmpFmt(auto)}</a>` : ''}</div>` : ''}</td></tr>`;
}
function cmpAgregarOtro(){
  const otros = cmp.insumos.filter(i=> !cmpEnLista(i)).sort((a, b)=> a.nombre.localeCompare(b.nombre, 'es'));
  return `<details class="cmp-otro"><summary>¿Hay algo que no está en la lista? Agrégalo aquí</summary>
    <div class="cmp-otro-cuerpo">
      <div class="field"><label for="cmp-otro-sel">Insumo de Finanzas</label>
        <select id="cmp-otro-sel"><option value="">Elige…</option>${otros.map(i=> `<option value="${i.id}">${escHtml(i.nombre)}</option>`).join('')}<option value="nuevo">Es nuevo (no está en Finanzas)</option></select></div>
      <div id="cmp-otro-nuevo" class="cmp-fila3" style="display:none;">
        <div class="field"><label for="cmp-otro-nombre">Nombre</label><input type="text" id="cmp-otro-nombre"></div>
        <div class="field"><label for="cmp-otro-unidad">Se mide en</label><select id="cmp-otro-unidad"><option value="g">kilos</option><option value="ml">litros</option><option value="pza">piezas</option></select></div>
      </div>
      <div class="field"><label for="cmp-otro-cant">¿Cuánto comprar?</label><input type="text" inputmode="decimal" id="cmp-otro-cant" placeholder="Ej. 2"></div>
      <button type="button" class="btn-secundario" onclick="agregarOtroCompras()">Agregar</button>
    </div></details>`;
}
document.addEventListener('change', e=>{ if(e.target && e.target.id === 'cmp-otro-sel') document.getElementById('cmp-otro-nuevo').style.display = e.target.value === 'nuevo' ? '' : 'none'; });

async function empezarConteoCompras(){
  const { data, error } = await sb.from('compras_listas').insert([{ fecha: fechaHoyStr() }]).select().single();
  if(error){ cmpMsg('No se pudo empezar: ' + error.message, 'err'); return; }
  cmp.lista = data; cmp.items = {}; cmp.movs = [];
  pintarCompras();
}
async function guardarItemCompras(insumoId, cambios){
  const prev = cmp.items[insumoId] || { lista_id: cmp.lista.id, insumo_id: insumoId, tengo: null, comprar: null };
  const fila = { lista_id: cmp.lista.id, insumo_id: insumoId, tengo: prev.tengo, comprar: prev.comprar, ...cambios };
  const { data, error } = await sb.from('compras_lista_items').upsert([fila], { onConflict: 'lista_id,insumo_id' }).select().single();
  if(error){ cmpMsg('No se guardó: ' + error.message, 'err'); return false; }
  cmp.items[insumoId] = data || fila;
  return true;
}
async function cambiarItemCompras(insumoId, campo, valor){
  const n = cmpNum(valor);
  if(String(valor).trim() !== '' && (n == null || n < 0)){ cmpMsg('Escribe un número.', 'err'); cmpRepintar(); return; }
  if(await guardarItemCompras(insumoId, { [campo]: n })) cmpMsg('Guardado', 'ok');
  cmpRepintar();
}
async function agregarOtroCompras(){
  const sel = document.getElementById('cmp-otro-sel').value;
  const cant = cmpNum(document.getElementById('cmp-otro-cant').value);
  if(!sel){ cmpMsg('Elige el insumo.', 'err'); return; }
  if(!(cant > 0)){ cmpMsg('Escribe cuánto comprar.', 'err'); return; }
  let id = Number(sel);
  if(sel === 'nuevo'){
    const nombre = document.getElementById('cmp-otro-nombre').value.trim();
    const unidad = document.getElementById('cmp-otro-unidad').value;
    if(!nombre){ cmpMsg('Escribe el nombre.', 'err'); return; }
    if(cmp.insumos.some(i=> finQ(i.nombre) === finQ(nombre))){ cmpMsg('Ya existe un insumo con ese nombre; elígelo en la lista.', 'err'); return; }
    const { data, error } = await sb.from('insumos').insert([{ nombre, unidad, tipo: 'insumo', categoria: 'Ingrediente' }]).select().single();
    if(error){ cmpMsg('No se pudo crear: ' + error.message, 'err'); return; }
    cmp.insumos.push({ ...data, tipo: 'insumo' }); id = data.id;
    if(typeof finCargado !== 'undefined') finCargado = false;   // Finanzas lo vuelve a leer
  }
  if(await guardarItemCompras(id, { comprar: cant })){ cmpMsg('Agregado', 'ok'); pintarCompras(); }
}

// ---------- Comprar (ruta por tiendas) ----------
function cmpComprado(id){ return cmp.movs.filter(m=> m.insumo_id === id && m.estado === 'comprado').reduce((s, m)=> s + (Number(m.cantidad) || 0) * (Number(m.contenido) || 0), 0); }
function cmpFalta(i){ const c = cmpComprar(i); if(!(c > 0)) return 0; return Math.max(0, c * cmpContenido(i) - cmpComprado(i.id)); }   // en g / ml / pzas
function cmpNoHabia(id, tienda){ return cmp.movs.some(m=> m.insumo_id === id && m.estado === 'no_habia' && m.tienda_id === tienda); }
// Precio de referencia: el más alto del mes; si este mes no hay, el más alto del mes pasado; si no, el de Finanzas
function cmpReferencia(i){
  const hoy = new Date(), mesA = hoy.getFullYear() * 12 + hoy.getMonth();
  const mesDe = d=> d.getFullYear() * 12 + d.getMonth();
  const h = cmp.hist.filter(x=> x.insumo_id === i.id && x.lista_id !== (cmp.lista && cmp.lista.id));
  for(const [m, txt] of [[mesA, 'más alto de ' + cmpMes(hoy)], [mesA - 1, 'más alto de ' + cmpMes(new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1))]]){
    const v = h.filter(x=> mesDe(x.fecha) === m).map(x=> x.pu);
    if(v.length) return { pu: Math.max(...v), txt };
  }
  const c = cmpContFinanzas(i);
  return c && i.precio != null ? { pu: Number(i.precio) / c, txt: 'de Finanzas' } : null;
}
function cmpComparar(pu, i){
  const r = cmpReferencia(i);
  if(pu == null || !r) return r ? `Precio ${r.txt}: ${cmpFmtPU(r.pu, i)}` : 'Sin precio anterior para comparar.';
  const d = pu / r.pu - 1;
  const txt = `${cmpFmtPU(pu, i)} · precio ${r.txt}: ${cmpFmtPU(r.pu, i)}`;
  if(d > 0.005) return `<b class="cmp-sube">▲ Subió ${finPct(d)}</b> · ${txt}`;
  if(d < -0.005) return `<b>▼ Bajó ${finPct(-d)}</b> · ${txt}`;
  return `<b>= Igual</b> · ${txt}`;
}

function vistaComprar(){
  if(!cmp.lista) return `<div class="empty">Primero haz el conteo en Inventario.</div>`;
  const pend = cmp.insumos.filter(i=> cmpFalta(i) > 0).sort((a, b)=> a.nombre.localeCompare(b.nombre, 'es'));
  const ruta = (cmp.lista.ruta || []).filter(id=> cmpTienda(id));
  const gastado = cmp.movs.filter(m=> m.estado === 'comprado' && m.precio != null).reduce((s, m)=> s + Number(m.precio) * Number(m.cantidad || 0), 0);
  let html = `<div class="fin-titulo"><h3>Tu ruta de hoy</h3></div>
    <div class="hint fin-nota">Toca las tiendas en el orden en que vas a ir. Lo que ya compraste se quita de las demás.</div>
    ${cmp.tiendas.length ? `<div class="chip-group cmp-ruta">${cmp.tiendas.map(t=>{ const n = ruta.indexOf(t.id); return `<div class="chip${n >= 0 ? ' selected' : ''}" onclick="rutaCompras(${t.id})">${n >= 0 ? (n + 1) + ' · ' : ''}${escHtml(t.nombre)}</div>`; }).join('')}</div>` : '<div class="empty">No hay tiendas. Agrégalas en Ajustes.</div>'}`;
  ruta.forEach((tid, n)=>{
    const aqui = pend.filter(i=> cmpArt(i).tiendas.includes(tid) && !cmpNoHabia(i.id, tid));
    html += `<div class="sub-titulo">${n + 1}. ${escHtml(cmpTienda(tid).nombre)}</div>` + (aqui.length ? aqui.map(i=> tarjetaCompra(i, tid)).join('') : '<div class="hint" style="margin:0 0 12px;">Nada pendiente aquí.</div>');
  });
  // Lo que falta y no se puede comprar en ninguna tienda de la ruta (no la tiene asignada, o en todas dijeron que no había)
  const sin = pend.filter(i=> !ruta.some(t=> cmpArt(i).tiendas.includes(t) && !cmpNoHabia(i.id, t)));
  if(sin.length) html += `<div class="sub-titulo">Falta y no está en tu ruta</div>` + sin.map(i=> tarjetaCompra(i, null)).join('');
  if(!pend.length) html += `<div class="msg ok" style="display:block; margin:12px 0;">Ya está todo lo de la lista.</div>`;
  const hechos = cmp.movs.slice().reverse();
  if(hechos.length) html += `<div class="sub-titulo">Ya comprado y no había</div>` + hechos.map(filaMovCompra).join('');
  html += `<div class="cmp-pie"><div><span class="cmp-sub">Gastado en esta compra</span><b>${fmtDinero(gastado)}</b></div>
    <button type="button" class="btn-secundario" onclick="terminarCompras()">Terminar compras</button></div>`;
  return html;
}
function tarjetaCompra(i, tid){
  const falta = cmpFalta(i), cont = cmpContenido(i);
  const otras = cmp.movs.filter(m=> m.insumo_id === i.id && m.estado === 'no_habia').map(m=> (cmpTienda(m.tienda_id) || {}).nombre).filter(Boolean);
  const abierto = cmp.abierto && cmp.abierto.id === i.id && cmp.abierto.tid === tid;
  return `<div class="cmp-item${abierto ? ' on' : ''}">
    <div class="cmp-item-top"><div><b>${escHtml(i.nombre)}</b>
      <div class="cmp-sub">Falta ${escHtml(cmpCantUnidad(Math.round(falta / cont * 100) / 100, i))}${cmpSuelto(i) ? '' : ` (${escHtml(cmpFmtCont(falta, i))})`}${otras.length ? ' · no había en ' + escHtml(otras.join(', ')) : ''}</div>
      <div class="cmp-sub">${cmpComparar(null, i)}</div></div>
      ${abierto ? '' : `<div class="cmp-botones"><button type="button" class="cmp-si" onclick="abrirCompra(${i.id}, ${tid})">✓ Compré</button>${tid ? `<button type="button" class="cmp-no" onclick="noHabiaCompras(${i.id}, ${tid})">✕ No había</button>` : ''}</div>`}</div>
    ${abierto ? formaCompra(i) : ''}</div>`;
}
function cmpPresentaciones(i){
  const base = [{ v: 'conteo', nombre: cmpUnidad(i), contenido: cmpContenido(i) }];
  cmp.pres.filter(p=> p.insumo_id === i.id).forEach(p=> base.push({ v: 'p' + p.id, nombre: p.nombre, contenido: Number(p.contenido) }));
  return base;
}
function formaCompra(i){
  const ops = cmpPresentaciones(i);
  const sel = cmp.abierto.pres || 'conteo';
  const p = ops.find(o=> o.v === sel) || ops[0];
  const cant = Math.max(1, Math.ceil(cmpFalta(i) / (p ? p.contenido : cmpContenido(i)) - 1e-9));
  return `<div class="cmp-forma">
    <div class="field"><label for="cmp-pres">¿Qué presentación había?</label>
      <select id="cmp-pres" onchange="cmp.abierto.pres = this.value; pintarCompras()">${ops.map(o=> `<option value="${o.v}"${o.v === sel ? ' selected' : ''}>${escHtml(o.nombre)} de ${escHtml(cmpFmtCont(o.contenido, i))}</option>`).join('')}<option value="otra"${sel === 'otra' ? ' selected' : ''}>Otra presentación…</option></select></div>
    ${sel === 'otra' ? `<div class="cmp-fila3">
      <div class="field"><label for="cmp-pres-nombre">Nombre</label><input type="text" id="cmp-pres-nombre" placeholder="Ej. bolsa"></div>
      <div class="field"><label for="cmp-pres-cont">Trae (${cmpUGrande(i)})</label><input type="text" inputmode="decimal" id="cmp-pres-cont" placeholder="Ej. ${cmpBase(i) === 'pza' ? '30' : '0.9'}" oninput="cmpCalcularCompra()"></div></div>` : ''}
    <div class="cmp-fila3">
      <div class="field"><label for="cmp-cant">¿Cuántas compraste?</label><input type="text" inputmode="decimal" id="cmp-cant" value="${sel === 'otra' ? '' : cant}" oninput="cmpCalcularCompra()"></div>
      <div class="field"><label for="cmp-precio">Precio de cada una (opcional)</label><input type="text" inputmode="decimal" id="cmp-precio" placeholder="$" oninput="cmpCalcularCompra()"></div>
    </div>
    <div class="cmp-sub" id="cmp-comp" style="margin-bottom:10px;"></div>
    <div class="botones-fila"><button type="button" class="primary" style="margin:0;" onclick="guardarCompra()">Guardar</button><button type="button" class="btn-secundario" onclick="cmp.abierto = null; pintarCompras()">Cancelar</button></div>
  </div>`;
}
function cmpLeerForma(){
  const i = cmpInsumo(cmp.abierto.id);
  const sel = cmp.abierto.pres || 'conteo';
  let nombre, contenido;
  if(sel === 'otra'){ nombre = (document.getElementById('cmp-pres-nombre') || {}).value; nombre = (nombre || '').trim(); const c = cmpNum((document.getElementById('cmp-pres-cont') || {}).value); contenido = c > 0 ? c * cmpFactor(i) : null; }
  else { const p = cmpPresentaciones(i).find(o=> o.v === sel); nombre = p.nombre; contenido = p.contenido; }
  return { i, sel, nombre, contenido, cantidad: cmpNum(document.getElementById('cmp-cant').value), precio: cmpNum(document.getElementById('cmp-precio').value) };
}
function cmpCalcularCompra(){
  const el = document.getElementById('cmp-comp'); if(!el || !cmp.abierto) return;
  const f = cmpLeerForma();
  const partes = [];
  if(f.contenido && f.cantidad > 0){
    const total = f.contenido * f.cantidad, falta = cmpFalta(f.i);
    partes.push(`Son ${escHtml(cmpFmtCont(total, f.i))}` + (total < falta - 1e-6 ? ` · faltarían ${escHtml(cmpFmtCont(falta - total, f.i))}` : ''));
    if(f.precio != null) partes.push('Total ' + fmtDinero(f.precio * f.cantidad));
  }
  partes.push(cmpComparar(f.precio != null && f.contenido ? f.precio / f.contenido : null, f.i));
  el.innerHTML = partes.join('<br>');
}
function abrirCompra(id, tid){ cmp.abierto = { id, tid, pres: 'conteo' }; pintarCompras(); const c = document.getElementById('cmp-cant'); if(c) c.focus(); }
async function guardarCompra(){
  const f = cmpLeerForma();
  if(f.sel === 'otra' && (!f.nombre || !f.contenido)){ cmpMsg('Escribe el nombre de la presentación y cuánto trae.', 'err'); return; }
  if(!(f.cantidad > 0)){ cmpMsg('Escribe cuántas compraste.', 'err'); return; }
  if(f.precio != null && f.precio < 0){ cmpMsg('El precio no puede ser negativo.', 'err'); return; }
  if(f.sel === 'otra' && !cmp.pres.some(p=> p.insumo_id === f.i.id && finQ(p.nombre) === finQ(f.nombre))){
    const { data } = await sb.from('compras_presentaciones').insert([{ insumo_id: f.i.id, nombre: f.nombre, contenido: f.contenido }]).select().single();
    if(data) cmp.pres.push(data);   // si falla, la compra se guarda igual
  }
  const mov = { lista_id: cmp.lista.id, insumo_id: f.i.id, tienda_id: cmp.abierto.tid, estado: 'comprado', presentacion: f.nombre, contenido: f.contenido, cantidad: f.cantidad, precio: f.precio };
  const { data, error } = await sb.from('compras_movimientos').insert([mov]).select().single();
  if(error){ cmpMsg('No se guardó: ' + error.message, 'err'); return; }
  cmp.movs.push(data || mov);
  cmp.abierto = null;
  cmpMsg('Guardado', 'ok');
  pintarCompras();
}
async function noHabiaCompras(id, tid){
  const mov = { lista_id: cmp.lista.id, insumo_id: id, tienda_id: tid, estado: 'no_habia' };
  const { data, error } = await sb.from('compras_movimientos').insert([mov]).select().single();
  if(error){ cmpMsg('No se guardó: ' + error.message, 'err'); return; }
  cmp.movs.push(data || mov);
  pintarCompras();
}
function filaMovCompra(m){
  const i = cmpInsumo(m.insumo_id); if(!i) return '';
  const t = cmpTienda(m.tienda_id);
  const det = m.estado === 'no_habia' ? '✕ No había'
    : `✓ ${cmpFmt(m.cantidad)} ${escHtml(cmpPlural(m.presentacion || '', Number(m.cantidad)))} de ${escHtml(cmpFmtCont(Number(m.contenido), i))}` + (m.precio != null ? ` · ${fmtDinero(m.precio)} c/u · total ${fmtDinero(m.precio * m.cantidad)}` : '');
  const comp = m.estado === 'comprado' && m.precio != null ? `<div class="cmp-sub">${cmpComparar(Number(m.precio) / Number(m.contenido), i)}</div>` : '';
  return `<div class="cmp-hecho"><div><b>${escHtml(i.nombre)}</b>${t ? ` <span class="cmp-sub">en ${escHtml(t.nombre)}</span>` : ''}<div class="cmp-sub">${det}</div>${comp}</div>
    <a href="#" onclick="deshacerMovCompras(${m.id}); return false;">Deshacer</a></div>`;
}
async function deshacerMovCompras(id){
  const { error } = await sb.from('compras_movimientos').delete().eq('id', id);
  if(error){ cmpMsg('No se pudo deshacer: ' + error.message, 'err'); return; }
  cmp.movs = cmp.movs.filter(m=> m.id !== id);
  pintarCompras();
}
async function rutaCompras(tid){
  const r = (cmp.lista.ruta || []).filter(id=> cmpTienda(id));
  const nueva = r.includes(tid) ? r.filter(x=> x !== tid) : [...r, tid];
  const { error } = await sb.from('compras_listas').update({ ruta: nueva }).eq('id', cmp.lista.id);
  if(error){ cmpMsg('No se guardó la ruta: ' + error.message, 'err'); return; }
  cmp.lista.ruta = nueva;
  pintarCompras();
}
async function terminarCompras(){
  const faltan = cmp.insumos.filter(i=> cmpFalta(i) > 0).length;
  if(!confirm(faltan ? `Quedan ${faltan} ${faltan === 1 ? 'insumo' : 'insumos'} sin comprar. ¿Terminar de todos modos?` : '¿Terminar esta compra?')) return;
  const { error } = await sb.from('compras_listas').update({ cerrada: true, cerrada_at: new Date().toISOString() }).eq('id', cmp.lista.id);
  if(error){ cmpMsg('No se pudo terminar: ' + error.message, 'err'); return; }
  cmp.cargado = false; cmp.abierto = null; cmp.vista = 'inventario';
  await cargarCompras();
  cmpMsg('Compra terminada', 'ok');
}

// ---------- Ajustes ----------
function vistaAjustesCompras(){
  const alfa = (a, b)=> a.nombre.localeCompare(b.nombre, 'es');
  const ins = cmp.insumos.filter(i=> i.tipo !== 'material').sort(alfa);
  const mat = cmp.insumos.filter(i=> i.tipo === 'material').sort(alfa);
  const tabla = arr=> `<div class="tabla-scroll"><table class="tabla-insumos cmp-tabla"><thead><tr><th>Insumo</th><th class="c">Lo compro seguido</th><th>Lo cuento en</th><th class="n">Trae</th><th class="n">Quiero tener</th></tr></thead>
    <tbody>${arr.map(filaAjusteCompras).join('')}</tbody></table></div>`;
  return `<div class="seccion-resumen">
    <div class="fin-titulo"><h3>Tiendas</h3></div>
    <div class="cmp-tiendas">${cmp.tiendas.map(t=> `<div class="cmp-tienda"><input type="text" data-k="tie-${t.id}" value="${escHtml(t.nombre)}" onchange="renombrarTiendaCompras(${t.id}, this.value)"><button type="button" class="ins-quitar" aria-label="Quitar" onclick="quitarTiendaCompras(${t.id})">×</button></div>`).join('')}
      <div class="cmp-tienda"><input type="text" id="cmp-tienda-nueva" placeholder="Nueva tienda (ej. Lizárraga)" onkeydown="if(event.key==='Enter'){event.preventDefault(); agregarTiendaCompras();}"><button type="button" class="btn-secundario" style="margin:0;" onclick="agregarTiendaCompras()">Agregar</button></div></div>
  </div>
  <div class="fin-titulo"><h3>Insumos</h3></div>
  <div class="hint fin-nota">Marca los que compras seguido (salen en el inventario). "Lo cuento en" es cómo lo cuentas en la bodega (costal, caja, cartera…), "Trae" cuánto viene en cada uno, y "Quiero tener" cuántos quieres tener al hacer la compra. Al marcarlo, eliges en qué tiendas lo compras. Salen de los insumos de Finanzas.</div>
  ${cmpBuscador()}
  <div class="sub-titulo">Ingredientes</div>${tabla(ins)}
  ${mat.length ? `<div class="sub-titulo">Empaques</div>${tabla(mat)}` : ''}`;
}
function filaAjusteCompras(i){
  const a = cmpArt(i);
  const contF = cmpContFinanzas(i);
  return `<tr data-nombre="${escHtml(i.nombre)}"${cmpOculta(i)}>
    <td><b>${escHtml(i.nombre)}</b></td>
    <td class="c"><input type="checkbox" class="cmp-check" data-k="act-${i.id}" aria-label="Lo compro seguido" ${a.activo ? 'checked' : ''} onchange="cambiarArtCompras(${i.id}, 'activo', this.checked)"></td>
    <td><input type="text" class="cmp-txt" data-k="uni-${i.id}" value="${escHtml(a.unidad_conteo || '')}" placeholder="${a.contenido || contF ? 'paquete' : cmpUGrande(i)}" onchange="cambiarArtCompras(${i.id}, 'unidad_conteo', this.value.trim() || null)"></td>
    <td class="n"><div class="cmp-cant"><input type="text" inputmode="decimal" data-k="con-${i.id}" data-sel="1" value="${a.contenido ? escHtml(cmpFmt(a.contenido / cmpFactor(i))) : ''}" placeholder="${contF ? escHtml(cmpFmt(contF / cmpFactor(i))) : ''}" onchange="cambiarArtCompras(${i.id}, 'contenido', this.value)"><span>${cmpUGrande(i)}</span></div></td>
    <td class="n"><input type="text" inputmode="decimal" class="cmp-num" data-k="obj-${i.id}" data-sel="1" value="${escHtml(cmpFmt(a.objetivo))}" onchange="cambiarArtCompras(${i.id}, 'objetivo', this.value)"></td>
  </tr>${a.activo ? `<tr class="cmp-tr2" data-nombre="${escHtml(i.nombre)}"${cmpOculta(i)}><td colspan="5"><div class="cmp-tchips"><span class="cmp-sub">Lo compro en:</span>${cmp.tiendas.map(t=> `<button type="button" class="cmp-tchip${a.tiendas.includes(t.id) ? ' on' : ''}" aria-pressed="${a.tiendas.includes(t.id)}" onclick="tiendaArtCompras(${i.id}, ${t.id})">${a.tiendas.includes(t.id) ? '✓ ' : ''}${escHtml(t.nombre)}</button>`).join('') || '<span class="cmp-sub">agrega tus tiendas arriba</span>'}</div></td></tr>` : ''}`;
}
async function guardarArtCompras(id, cambios){
  const i = cmpInsumo(id);
  const fila = { ...cmpArt(i), ...cambios, insumo_id: id };
  const { data, error } = await sb.from('compras_articulos').upsert([fila], { onConflict: 'insumo_id' }).select().single();
  if(error){ cmpMsg('No se guardó: ' + error.message, 'err'); return false; }
  cmp.arts[id] = { ...(data || fila), tiendas: (data || fila).tiendas || [] };
  return true;
}
async function cambiarArtCompras(id, campo, valor){
  let v = valor;
  if(campo === 'contenido' || campo === 'objetivo'){
    const n = cmpNum(valor);
    if(String(valor).trim() !== '' && (n == null || n < 0 || (campo === 'contenido' && n === 0))){ cmpMsg('Escribe un número.', 'err'); cmpRepintar(); return; }
    v = n == null ? null : campo === 'contenido' ? n * cmpFactor(cmpInsumo(id)) : n;
  }
  const cambios = { [campo]: v };
  if(campo === 'objetivo' && v != null) cambios.activo = true;   // si le pones cantidad ideal, es que lo compras seguido
  if(await guardarArtCompras(id, cambios)) cmpMsg('Guardado', 'ok');
  cmpRepintar();
}
async function tiendaArtCompras(id, tid){
  const t = cmpArt(cmpInsumo(id)).tiendas;
  if(await guardarArtCompras(id, { tiendas: t.includes(tid) ? t.filter(x=> x !== tid) : [...t, tid] })) pintarCompras();
}
async function agregarTiendaCompras(){
  const el = document.getElementById('cmp-tienda-nueva'), nombre = el.value.trim();
  if(!nombre) return;
  if(cmp.tiendas.some(t=> finQ(t.nombre) === finQ(nombre))){ cmpMsg('Esa tienda ya está.', 'err'); return; }
  const { data, error } = await sb.from('compras_tiendas').insert([{ nombre, orden: cmp.tiendas.length }]).select().single();
  if(error){ cmpMsg('No se guardó: ' + error.message, 'err'); return; }
  cmp.tiendas.push(data);
  pintarCompras();
  const n = document.getElementById('cmp-tienda-nueva'); if(n) n.focus();
}
async function renombrarTiendaCompras(id, nombre){
  nombre = nombre.trim();
  if(!nombre){ cmpRepintar(); return; }
  const { error } = await sb.from('compras_tiendas').update({ nombre }).eq('id', id);
  if(error){ cmpMsg('No se guardó: ' + error.message, 'err'); cmpRepintar(); return; }
  cmpTienda(id).nombre = nombre;
  cmpMsg('Guardado', 'ok');
  cmpRepintar();
}
async function quitarTiendaCompras(id){
  const t = cmpTienda(id);
  const usan = Object.values(cmp.arts).filter(a=> (a.tiendas || []).includes(id)).length;
  if(!confirm(`¿Quitar ${t.nombre}?` + (usan ? ` Se quita de ${usan} ${usan === 1 ? 'insumo' : 'insumos'}.` : ''))) return;
  const { error } = await sb.from('compras_tiendas').delete().eq('id', id);
  if(error){ cmpMsg('No se pudo quitar: ' + error.message, 'err'); return; }
  cmp.tiendas = cmp.tiendas.filter(x=> x.id !== id);
  // Los insumos que la tenían se actualizan (sin tienda borrada)
  for(const a of Object.values(cmp.arts).filter(a=> (a.tiendas || []).includes(id))) await guardarArtCompras(a.insumo_id, { tiendas: a.tiendas.filter(x=> x !== id) });
  pintarCompras();
}
