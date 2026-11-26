// Compras (solo directora): inventario, lista de compras por tienda y registro de lo que se compró.
// Datos en Supabase (sql/042): compras_tiendas, compras_articulos, compras_presentaciones,
// compras_listas, compras_lista_items, compras_movimientos. La base son los insumos de Finanzas (tabla insumos).
// Cantidades: el inventario se cuenta en la "unidad de conteo" de cada insumo (costal, caja...),
// y por dentro todo se convierte a g / ml / piezas para comparar presentaciones y precios.

let cmp = { tiendas: [], insumos: [], arts: {}, pres: [], lista: null, items: {}, movs: [], hist: [], equiv: {}, vista: 'inventario', abierto: null, buscar: '', cargado: false,
  tk: null, tkFotos: [], tkLeyendo: false, tkMes: null, tickets: [], tkAbierto: null, tkResultado: null };

const CMP_VISTAS = [ { id:'inventario', titulo:'Inventario' }, { id:'comprar', titulo:'Comprar' }, { id:'tickets', titulo:'Tickets y gastos' }, { id:'ajustes', titulo:'Ajustes' } ];

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
  const [ri, rt, ra, rp, rl, rh, rm, re, rti] = await Promise.all([
    sb.from('insumos').select('*').order('nombre'),
    sb.from('compras_tiendas').select('*').order('id'),
    sb.from('compras_articulos').select('*'),
    sb.from('compras_presentaciones').select('*').order('id'),
    sb.from('compras_listas').select('*').eq('cerrada', false).order('id', { ascending: false }).limit(1),
    sb.from('insumos_historial').select('*').gte('fecha', desde),
    sb.from('compras_movimientos').select('*').eq('estado', 'comprado').gte('created_at', desde),
    sb.from('compras_equivalencias').select('*'),
    sb.from('compras_ticket_items').select('*').gte('fecha', desde)
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
  (rti.data || []).forEach(cmpHistTicket);
  cmp.equiv = {}; (re.data || []).forEach(e=> cmp.equiv[e.clave] = e);
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
  const cuerpo = ({ inventario: vistaInventarioCompras, comprar: vistaComprar, tickets: vistaTicketsCompras, ajustes: vistaAjustesCompras })[cmp.vista]();
  cont.innerHTML = chips + '<div class="msg" id="cmp-msg"></div>' + cuerpo;
  if(msgPrev){ const m = document.getElementById('cmp-msg'); m.className = msgPrev[0]; m.textContent = msgPrev[1]; }
  if(k){ const el = cont.querySelector(`[data-k="${CSS.escape(k)}"]`); if(el){ el.focus(); if(el.select && el.dataset.sel) el.select(); } }
  if(cmp.abierto) cmpCalcularCompra();
}
function cmpRepintar(){ setTimeout(pintarCompras, 0); }
function elegirVistaCompras(v){ cmp.vista = v; cmp.abierto = null; cmp.buscar = ''; pintarCompras(); window.scrollTo(0, 0); if(v === 'tickets') cargarTicketsMes(); }
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
function cmpReferencia(i, ex){
  const hoy = ex && ex.fecha ? new Date(ex.fecha + 'T12:00:00') : new Date(), mesA = hoy.getFullYear() * 12 + hoy.getMonth();
  const mesDe = d=> d.getFullYear() * 12 + d.getMonth();
  // Al ver un ticket guardado no se compara contra sí mismo (ni contra el cambio de precio en Finanzas que hizo ese ticket)
  const propios = ex && ex.ticket ? cmp.hist.filter(x=> x.insumo_id === i.id && x.ticket_id === ex.ticket).map(x=> x.pu) : [];
  const h = cmp.hist.filter(x=> x.insumo_id === i.id && !(x.lista_id && cmp.lista && x.lista_id === cmp.lista.id) && !(ex && ex.ticket && x.ticket_id === ex.ticket)
    && !(x.ticket_id == null && x.lista_id == null && propios.some(p=> Math.abs(p - x.pu) <= p * 0.0001)));
  for(const [m, txt] of [[mesA, 'más alto de ' + cmpMes(hoy)], [mesA - 1, 'más alto de ' + cmpMes(new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1))]]){
    const v = h.filter(x=> mesDe(x.fecha) === m).map(x=> x.pu);
    if(v.length) return { pu: Math.max(...v), txt };
  }
  if(ex && ex.ticket) return null;
  const c = cmpContFinanzas(i);
  return c && i.precio != null ? { pu: Number(i.precio) / c, txt: 'de Finanzas' } : null;
}
function cmpComparar(pu, i, ex){
  const r = cmpReferencia(i, ex);
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

// ---------- Tickets y gastos ----------
// Foto del ticket → la IA lo lee (función bright-task, acción 'ticket') → se revisa → se guarda como gasto.
// Cada producto se liga a un insumo con lo que trae cada pieza; el sistema se acuerda para el siguiente ticket.
// Al guardar, el precio del insumo en Finanzas se actualiza (si no hay un ticket más reciente de ese insumo).
const cmpClave = s=> finQ(s).replace(/[^a-z0-9]+/g, ' ').trim();
function cmpHistTicket(t){ const i = cmpInsumo(t.insumo_id); if(i && Number(t.contenido) > 0 && Number(t.cantidad) > 0 && t.importe != null) cmp.hist.push({ insumo_id: t.insumo_id, fecha: new Date(t.fecha + 'T12:00:00'), pu: Number(t.importe) / Number(t.cantidad) / Number(t.contenido), ticket_id: t.ticket_id }); }
const cmpFotosDe = t=> (t.fotos && t.fotos.length ? t.fotos : [t.foto]).filter(Boolean);
const CMP_PAGOS = [ ['efectivo','Efectivo'], ['tarjeta','Tarjeta'], ['transferencia','Transferencia'], ['otro','Otro'] ];
function cmpMesActual(){ return fechaHoyStr().slice(0, 7); }
function cmpFechaCorta(f){ return new Date(f + 'T12:00:00').toLocaleDateString('es-MX', { weekday:'short', day:'numeric', month:'short' }); }

function vistaTicketsCompras(){
  let html = '';
  if(cmp.tkResultado) html += `<div class="cmp-resultado">${cmp.tkResultado}<a href="#" onclick="cmp.tkResultado = null; pintarCompras(); return false;">Cerrar</a></div>`;
  if(cmp.tk) return html + revisionTicket();
  html += `<div class="fin-titulo"><h3>Subir ticket</h3></div>
    <div class="hint fin-nota">Toma foto al ticket (o sube el PDF de la factura). Se lee solo; tú lo revisas y se guarda como gasto, con el precio de cada insumo.</div>
    ${cmp.tkLeyendo ? `<div class="loading" style="margin:0 0 18px;">Leyendo el ticket${cmp.tkFotos.length > 1 ? ` (${cmp.tkFotos.length} fotos)` : ''}…</div>`
      : cmp.tkFotos.length ? fotosPendientesTicket()
      : `<label class="primary cmp-subir">Tomar foto o elegir archivo<input type="file" accept="image/*,application/pdf" multiple style="display:none;" onchange="subirTicketCompras(this)"></label>`}`;
  html += listaTicketsMes();
  return html;
}

// Las fotos se juntan primero (un ticket largo puede ir en 2 o más fotos) y luego se leen todas juntas
async function subirTicketCompras(input){
  const fs = [...(input.files || [])]; input.value = '';
  for(const f of fs){
    if(cmp.tkFotos.length >= 5){ cmpMsg('Máximo 5 fotos por ticket.', 'err'); break; }
    try { cmp.tkFotos.push(await archivoABase64(f)); } catch(e){ cmpMsg(e.message || String(e), 'err'); }
  }
  cmp.tkResultado = null;
  pintarCompras();
}
function fotosPendientesTicket(){
  const n = cmp.tkFotos.length;
  return `<div class="cmp-fotos">${cmp.tkFotos.map((a, k)=> `<div class="cmp-foto">${/pdf/.test(a.tipo) ? '<span>PDF</span>' : `<img src="data:${a.tipo};base64,${a.base64}" alt="Foto ${k + 1}">`}
      <b>Parte ${k + 1}</b><button type="button" class="ins-quitar" aria-label="Quitar foto ${k + 1}" onclick="cmp.tkFotos.splice(${k}, 1); pintarCompras()">×</button></div>`).join('')}</div>
    <div class="hint" style="margin:0 0 10px;">${n === 1 ? '¿El ticket no salió completo? Agrega otra foto con la parte que falta; se leen juntas como un solo ticket.' : `Se van a leer las ${n} fotos como un solo ticket.`}</div>
    <div class="botones-fila"><button type="button" class="primary" style="margin:0;" onclick="leerTicketCompras()">Leer ticket</button>
      ${n < 5 ? `<label class="btn-secundario cmp-agregar-foto">+ Otra parte del ticket<input type="file" accept="image/*,application/pdf" multiple style="display:none;" onchange="subirTicketCompras(this)"></label>` : ''}</div>`;
}
async function leerTicketCompras(){
  if(!cmp.tkFotos.length) return;
  cmp.tkLeyendo = true; pintarCompras();
  try {
    const { data, error } = await sb.functions.invoke('bright-task', { body: { accion: 'ticket', archivos: cmp.tkFotos.map(a=> ({ archivo: a.base64, tipo: a.tipo })),
      insumos: cmp.insumos.map(i=> ({ id: i.id, nombre: i.nombre, unidad: i.unidad })), tiendas: cmp.tiendas.map(t=> t.nombre) } });
    if(error || !data || data.error || !data.lectura) throw new Error((data && data.error) || (error && error.message) || 'no se pudo leer');
    const L = data.lectura;
    if(L.es_ticket === false) throw new Error('eso no parece un ticket de compra');
    cmp.tk = armarTicket(L, cmp.tkFotos);
    cmp.tkFotos = [];
    cmpRevisarDuplicado();
  } catch(e){ cmpMsg('No se pudo leer el ticket: ' + (e.message || e) + '. Intenta con una foto más clara.', 'err'); }
  cmp.tkLeyendo = false;
  pintarCompras();
  window.scrollTo(0, 0);
}
function armarTicket(L, archivos){
  const nt = cmpClave(L.tienda || '');
  const tienda = nt ? cmp.tiendas.find(t=>{ const c = cmpClave(t.nombre); return c && (nt.includes(c) || c.includes(nt)); }) : null;
  const items = (Array.isArray(L.productos) ? L.productos : []).map(p=>{
    const eq = cmp.equiv[cmpClave(p.descripcion)];
    const idIA = cmpInsumo(Number(p.insumo_id)) ? Number(p.insumo_id) : null;
    return { descripcion: String(p.descripcion || '').trim(), cantidad: cmpNum(p.cantidad), importe: cmpNum(p.importe),
      insumo_id: eq ? eq.insumo_id : idIA, contenido: eq ? (eq.contenido != null ? Number(eq.contenido) : null) : (cmpNum(p.contenido) > 0 ? cmpNum(p.contenido) : null),
      origen: eq ? 'recordado' : idIA ? 'ia' : '' };
  });
  return { archivos, lectura: L, tienda_id: tienda ? tienda.id : (L.tienda ? 'nueva' : ''), tienda_nombre: String(L.tienda || '').trim(),
    fecha: /^\d{4}-\d{2}-\d{2}$/.test(L.fecha || '') ? L.fecha : fechaHoyStr(), hora: L.hora || null, folio: L.folio ? String(L.folio) : '',
    forma_pago: CMP_PAGOS.some(([v])=> v === L.forma_pago) ? L.forma_pago : '', total: cmpNum(L.total), items, dup: null };
}
async function cmpRevisarDuplicado(){
  const t = cmp.tk; if(!t || !t.fecha || t.total == null) return;
  const { data } = await sb.from('compras_tickets').select('id,folio,total,tienda_nombre').eq('fecha', t.fecha).eq('total', t.total);
  if(cmp.tk !== t) return;
  t.dup = (data || []).length ? data[0] : null;
  if(t.dup && cmp.vista === 'tickets') pintarCompras();
}
function revisionTicket(){
  const t = cmp.tk;
  const suma = t.items.reduce((s, x)=> s + (Number(x.importe) || 0), 0);
  const avisos = [];
  if(t.dup) avisos.push(`Ya hay un ticket guardado del mismo día y por el mismo total (${fmtDinero(t.dup.total)}${t.dup.tienda_nombre ? ', ' + escHtml(t.dup.tienda_nombre) : ''}). Revisa que no sea el mismo.`);
  if(t.total != null && t.items.length && Math.abs(suma - t.total) > 1) avisos.push(`Los productos suman ${fmtDinero(suma)} y el total dice ${fmtDinero(t.total)}. Revisa si falta o sobra algún renglón (o si hay impuestos o descuentos aparte).`);
  const opsTienda = cmp.tiendas.map(x=> `<option value="${x.id}"${t.tienda_id === x.id ? ' selected' : ''}>${escHtml(x.nombre)}</option>`).join('')
    + (t.tienda_nombre && !cmp.tiendas.some(x=> cmpClave(x.nombre) === cmpClave(t.tienda_nombre)) ? `<option value="nueva"${t.tienda_id === 'nueva' ? ' selected' : ''}>Nueva: ${escHtml(t.tienda_nombre)}</option>` : '');
  return `<div class="fin-titulo"><h3>Revisa el ticket</h3></div>
    <div class="hint fin-nota">Corrige lo que se haya leído mal. En cada producto elige qué insumo es y cuánto trae cada pieza; la próxima vez se acuerda solo.</div>
    ${avisos.map(a=> `<div class="cmp-aviso"><b>Ojo:</b> ${a}</div>`).join('')}
    <div class="cmp-tk-datos">
      <div class="field"><label for="tk-tienda">Tienda</label><select id="tk-tienda" data-k="tk-tienda" onchange="cmp.tk.tienda_id = this.value === 'nueva' || this.value === '' ? this.value : Number(this.value)"><option value="">Elige…</option>${opsTienda}</select></div>
      <div class="field"><label for="tk-fecha">Fecha</label><input type="date" id="tk-fecha" data-k="tk-fecha" value="${escHtml(t.fecha)}" onchange="cmp.tk.fecha = this.value; cmpRevisarDuplicado(); pintarCompras()"></div>
      <div class="field"><label for="tk-folio">Folio</label><input type="text" id="tk-folio" data-k="tk-folio" value="${escHtml(t.folio)}" onchange="cmp.tk.folio = this.value.trim()"></div>
      <div class="field"><label for="tk-pago">Forma de pago</label><select id="tk-pago" data-k="tk-pago" onchange="cmp.tk.forma_pago = this.value"><option value="">—</option>${CMP_PAGOS.map(([v, n])=> `<option value="${v}"${t.forma_pago === v ? ' selected' : ''}>${n}</option>`).join('')}</select></div>
      <div class="field"><label for="tk-total">Total pagado</label><input type="text" inputmode="decimal" id="tk-total" data-k="tk-total" value="${escHtml(cmpFmt(t.total))}" onchange="cmp.tk.total = cmpNum(this.value); cmpRevisarDuplicado(); pintarCompras()"></div>
    </div>
    <div class="sub-titulo">Productos (${t.items.length})</div>
    ${t.items.map(itemRevisionTicket).join('') || '<div class="hint">No se leyeron productos. Puedes guardarlo solo con el total.</div>'}
    <div class="botones-fila" style="margin-top:14px;"><button type="button" class="primary" style="margin:0;" onclick="guardarTicketCompras()">Guardar ticket</button><button type="button" class="btn-secundario" onclick="if(confirm('¿Descartar este ticket?')){ cmp.tk = null; pintarCompras(); }">Descartar</button></div>`;
}
function itemRevisionTicket(x, n){
  const i = x.insumo_id ? cmpInsumo(x.insumo_id) : null;
  const ops = cmp.insumos.slice().sort((a, b)=> a.nombre.localeCompare(b.nombre, 'es')).map(o=> `<option value="${o.id}"${o.id === x.insumo_id ? ' selected' : ''}>${escHtml(o.nombre)}</option>`).join('');
  let precio = '';
  if(i && x.contenido > 0 && x.cantidad > 0 && x.importe != null){
    const pu = x.importe / x.cantidad / x.contenido;
    precio = `<div class="cmp-sub">${fmtDinero(Math.round(x.importe / x.cantidad * 100) / 100)} c/u · ${cmpComparar(pu, i, { fecha: cmp.tk.fecha })}</div>`;
  } else if(i) precio = `<div class="cmp-sub"><span class="fin-falta">falta</span> cuánto trae cada pieza</div>`;
  return `<div class="cmp-item">
    <div><b>${escHtml(x.descripcion || 'Sin descripción')}</b>${x.origen === 'recordado' ? ' <span class="cmp-sub">· recordado</span>' : ''}</div>
    <div class="cmp-tk-item">
      <div class="field"><label>Cantidad</label><input type="text" inputmode="decimal" data-k="tki-c-${n}" value="${escHtml(cmpFmt(x.cantidad))}" onchange="cambiarItemTicket(${n}, 'cantidad', this.value)"></div>
      <div class="field"><label>Importe</label><input type="text" inputmode="decimal" data-k="tki-i-${n}" value="${escHtml(cmpFmt(x.importe))}" onchange="cambiarItemTicket(${n}, 'importe', this.value)"></div>
      <div class="field cmp-tk-ins"><label>Insumo</label><select data-k="tki-s-${n}" onchange="cambiarItemTicket(${n}, 'insumo_id', this.value)"><option value="">No es insumo (otro gasto)</option>${ops}</select></div>
      ${i ? `<div class="field"><label>Trae cada pieza (${cmpUGrande(i)})</label><input type="text" inputmode="decimal" data-k="tki-t-${n}" value="${x.contenido ? escHtml(cmpFmt(x.contenido / cmpFactor(i))) : ''}" onchange="cambiarItemTicket(${n}, 'contenido', this.value)"></div>` : ''}
    </div>${precio}</div>`;
}
function cambiarItemTicket(n, campo, valor){
  const x = cmp.tk.items[n];
  if(campo === 'insumo_id'){ const nuevo = valor ? Number(valor) : null; if(nuevo !== x.insumo_id){ x.insumo_id = nuevo; x.contenido = null; const a = nuevo ? cmp.arts[nuevo] : null; if(a && a.contenido) x.contenido = Number(a.contenido); x.origen = ''; } }
  else if(campo === 'contenido'){ const v = cmpNum(valor); const i = cmpInsumo(x.insumo_id); x.contenido = v > 0 && i ? v * cmpFactor(i) : null; }
  else { const v = cmpNum(valor); x[campo] = v != null && v >= 0 ? v : null; }
  cmpRepintar();
}

async function guardarTicketCompras(){
  const t = cmp.tk;
  if(!t.fecha){ cmpMsg('Pon la fecha del ticket.', 'err'); return; }
  if(t.total == null){ cmpMsg('Pon el total del ticket.', 'err'); return; }
  if(!t.tienda_id){ cmpMsg('Elige la tienda.', 'err'); return; }
  const malos = t.items.filter(x=> x.insumo_id && !(x.contenido > 0 && x.cantidad > 0 && x.importe != null));
  if(malos.length){ cmpMsg('Completa cantidad, importe y cuánto trae en: ' + malos.map(x=> x.descripcion).join(', ') + '. O márcalos como "No es insumo".', 'err'); return; }
  if(t.dup && !confirm('Ya hay un ticket del mismo día y total. ¿Guardarlo de todos modos?')) return;
  const boton = document.querySelector('#compras-contenido .botones-fila .primary'); if(boton){ boton.disabled = true; boton.textContent = 'Guardando…'; }
  try {
    // 1) Tienda nueva
    let tiendaId = t.tienda_id;
    if(tiendaId === 'nueva'){
      const { data, error } = await sb.from('compras_tiendas').insert([{ nombre: t.tienda_nombre, orden: cmp.tiendas.length }]).select().single();
      if(error) throw new Error('no se pudo crear la tienda: ' + error.message);
      cmp.tiendas.push(data); tiendaId = data.id;
    }
    // 2) Fotos (si alguna falla, el ticket se guarda igual)
    const fotos = [], marca = Date.now();
    for(const [k, a] of t.archivos.entries()){
      try {
        const bin = atob(a.base64), arr = new Uint8Array(bin.length);
        for(let j = 0; j < bin.length; j++) arr[j] = bin.charCodeAt(j);
        const ruta = `${t.fecha.slice(0, 7)}/${t.fecha}-${marca}-${k + 1}.${/pdf/.test(a.tipo) ? 'pdf' : 'jpg'}`;
        const { error } = await sb.storage.from('tickets').upload(ruta, new Blob([arr], { type: a.tipo }), { contentType: a.tipo });
        if(!error) fotos.push(ruta);
      } catch(e){ /* sin esa foto */ }
    }
    // 3) Ticket y productos
    const tienda = cmpTienda(tiendaId);
    const { data: tk, error: e1 } = await sb.from('compras_tickets').insert([{ tienda_id: tiendaId, tienda_nombre: tienda ? tienda.nombre : t.tienda_nombre, fecha: t.fecha, hora: t.hora,
      folio: t.folio || null, forma_pago: t.forma_pago || null, total: t.total, foto: fotos[0] || null, fotos, lectura: t.lectura }]).select().single();
    if(e1) throw new Error(e1.message);
    const filas = t.items.map(x=> ({ ticket_id: tk.id, fecha: t.fecha, descripcion: x.descripcion, cantidad: x.cantidad > 0 ? x.cantidad : null, importe: x.importe, insumo_id: x.insumo_id || null, contenido: x.insumo_id ? x.contenido : null }));
    if(filas.length){ const { error: e2 } = await sb.from('compras_ticket_items').insert(filas); if(e2) throw new Error(e2.message); }
    // 4) Memoria: qué insumo es cada descripción
    const eqs = {}; t.items.forEach(x=>{ const c = cmpClave(x.descripcion); if(c) eqs[c] = { clave: c, insumo_id: x.insumo_id || null, contenido: x.insumo_id ? x.contenido : null }; });
    if(Object.keys(eqs).length){ const { data } = await sb.from('compras_equivalencias').upsert(Object.values(eqs), { onConflict: 'clave' }).select(); (data || Object.values(eqs)).forEach(e=> cmp.equiv[e.clave] = e); }
    // 5) Comparación y precio en Finanzas (solo si no hay un ticket más reciente de ese insumo)
    const conIns = t.items.filter(x=> x.insumo_id);
    const lineas = conIns.map(x=>{ const i = cmpInsumo(x.insumo_id); return `<div><b>${escHtml(i.nombre)}</b>: ${cmpComparar(x.importe / x.cantidad / x.contenido, i, { fecha: t.fecha })}</div>`; });
    let actualizados = 0, impacto = null;
    if(conIns.length){
      const ids = [...new Set(conIns.map(x=> x.insumo_id))];
      const { data: nuevos } = await sb.from('compras_ticket_items').select('insumo_id,fecha').in('insumo_id', ids).gt('fecha', t.fecha);
      const hayNuevo = new Set((nuevos || []).map(r=> r.insumo_id));
      const cambios = ids.filter(id=> !hayNuevo.has(id)).map(id=>{
        const x = conIns.filter(y=> y.insumo_id === id).pop(), i = cmpInsumo(id);
        return { id, cantidad: i.unidad === 'kg' ? x.contenido / 1000 : x.contenido, precio: Math.round(x.importe / x.cantidad * 100) / 100 };
      });
      // Antes de cambiar los precios: cómo quedan los márgenes de los productos con el precio nuevo
      try { impacto = await cmpImpactoMargen(cambios); } catch(e){ impacto = null; }
      for(const c of cambios){
        const { error } = await sb.from('insumos').update({ cantidad: c.cantidad, precio: c.precio }).eq('id', c.id);
        if(!error){ Object.assign(cmpInsumo(c.id), { cantidad: c.cantidad, precio: c.precio }); actualizados++; }
      }
    }
    filas.forEach(cmpHistTicket);   // ya cuenta para el precio más alto del mes
    cmp.tkResultado = `<b>Ticket guardado: ${fmtDinero(t.total)}${tienda ? ' en ' + escHtml(tienda.nombre) : ''}.</b>${actualizados ? `<div>Se actualizó el precio de ${actualizados} ${actualizados === 1 ? 'insumo' : 'insumos'} en Finanzas.</div>` : ''}${lineas.join('')}${impactoHtml(impacto)}`;
    cmp.tk = null;
    cmp.tkMes = t.fecha.slice(0, 7);
    await cargarTicketsMes();
  } catch(e){
    cmpMsg('No se guardó el ticket: ' + (e.message || e), 'err');
    if(boton){ boton.disabled = false; boton.textContent = 'Guardar ticket'; }
  }
}

// Gastos del mes
async function cargarTicketsMes(){
  if(!cmp.tkMes) cmp.tkMes = cmpMesActual();
  const [a, m] = cmp.tkMes.split('-').map(Number);
  const fin = new Date(a, m, 1);
  const { data, error } = await sb.from('compras_tickets').select('id,fecha,hora,tienda_id,tienda_nombre,folio,forma_pago,total,foto,fotos').gte('fecha', cmp.tkMes + '-01').lt('fecha', fechaStrDesdeDate(fin)).order('fecha', { ascending: false });
  if(error){ cmpMsg('No se pudieron cargar los tickets: ' + error.message + '. ¿Ya se corrió el SQL 043?', 'err'); return; }
  cmp.tickets = data || [];
  if(cmp.vista === 'tickets') pintarCompras();
}
function listaTicketsMes(){
  const total = cmp.tickets.reduce((s, t)=> s + Number(t.total || 0), 0);
  const porTienda = {}; cmp.tickets.forEach(t=>{ const n = (cmpTienda(t.tienda_id) || {}).nombre || t.tienda_nombre || 'Sin tienda'; porTienda[n] = (porTienda[n] || 0) + Number(t.total || 0); });
  const mesTxt = cmp.tkMes ? new Date(cmp.tkMes + '-15T12:00:00').toLocaleDateString('es-MX', { month:'long', year:'numeric' }) : '';
  return `<div class="fin-titulo" style="margin-top:26px;"><h3>Gastos de ${escHtml(mesTxt)}</h3><input type="month" class="cmp-mes" value="${escHtml(cmp.tkMes || '')}" onchange="if(this.value){ cmp.tkMes = this.value; cmp.tkAbierto = null; cargarTicketsMes(); }"></div>
    <div class="totales-top" style="margin-bottom:14px;"><div class="total-box"><div class="tb-label">Total del mes</div><div class="tb-monto">${fmtDinero(total)}</div><div class="tb-sub">${cmp.tickets.length} ${cmp.tickets.length === 1 ? 'ticket' : 'tickets'}</div></div>
      ${Object.keys(porTienda).length ? `<div class="total-box caramelo"><div class="tb-label">Por tienda</div><div class="tb-sub" style="font-size:13.5px; line-height:1.6;">${Object.entries(porTienda).sort((x, y)=> y[1] - x[1]).map(([n, v])=> escHtml(n) + ' ' + fmtDinero(v)).join('<br>')}</div></div>` : ''}</div>
    ${cmp.tickets.map(filaTicketMes).join('') || '<div class="empty">No hay tickets en este mes.</div>'}`;
}
function filaTicketMes(t){
  const ab = cmp.tkAbierto && cmp.tkAbierto.id === t.id ? cmp.tkAbierto : null;
  const nombre = (cmpTienda(t.tienda_id) || {}).nombre || t.tienda_nombre || 'Sin tienda';
  const pago = (CMP_PAGOS.find(([v])=> v === t.forma_pago) || [, ''])[1];
  let det = '';
  if(ab){
    det = !ab.items ? '<div class="loading">Cargando…</div>' : `<div class="cmp-tk-det">${ab.items.map(x=>{ const i = x.insumo_id ? cmpInsumo(x.insumo_id) : null;
      return `<div class="cmp-tk-linea"><div>${escHtml(x.descripcion || '')}<div class="cmp-sub">${i ? escHtml(i.nombre) + (x.contenido && x.cantidad && x.importe != null ? ' · ' + cmpComparar(x.importe / x.cantidad / x.contenido, i, { ticket: t.id, fecha: t.fecha }) : '') : 'No es insumo'}</div></div><div class="n">${cmpFmt(x.cantidad)} · ${fmtDinero(x.importe)}</div></div>`; }).join('') || '<div class="hint">Sin productos.</div>'}
      <div class="botones-fila" style="margin-top:10px; flex-wrap:wrap;">${(ab.urls || []).map((u, k, arr)=> `<a class="btn-secundario cmp-ver-foto" href="${escHtml(u)}" target="_blank" rel="noopener">Ver foto${arr.length > 1 ? ' ' + (k + 1) : ''}</a>`).join('')}<button type="button" class="btn-borrar" onclick="borrarTicketCompras(${t.id})">Borrar ticket</button></div></div>`;
  }
  return `<div class="cmp-item${ab ? ' on' : ''}"><div class="cmp-item-top" onclick="abrirTicketMes(${t.id})" style="cursor:pointer;">
    <div><b>${escHtml(nombre)}</b><div class="cmp-sub">${escHtml(cmpFechaCorta(t.fecha))}${t.folio ? ' · folio ' + escHtml(t.folio) : ''}${pago ? ' · ' + pago : ''}</div></div>
    <div class="cmp-tk-total">${fmtDinero(t.total)}<span class="cmp-sub">${ab ? 'Ocultar' : 'Ver'}</span></div></div>${det}</div>`;
}
async function abrirTicketMes(id){
  if(cmp.tkAbierto && cmp.tkAbierto.id === id){ cmp.tkAbierto = null; pintarCompras(); return; }
  const t = cmp.tickets.find(x=> x.id === id);
  cmp.tkAbierto = { id }; pintarCompras();
  const rutas = cmpFotosDe(t);
  const [a, ...b] = await Promise.all([
    sb.from('compras_ticket_items').select('*').eq('ticket_id', id).order('id'),
    ...rutas.map(r=> sb.storage.from('tickets').createSignedUrl(r, 3600))
  ]);
  if(!cmp.tkAbierto || cmp.tkAbierto.id !== id) return;
  cmp.tkAbierto.items = a.data || [];
  cmp.tkAbierto.urls = b.map(x=> x && x.data ? x.data.signedUrl : null).filter(Boolean);
  pintarCompras();
}
async function borrarTicketCompras(id){
  const t = cmp.tickets.find(x=> x.id === id);
  if(!confirm(`¿Borrar el ticket de ${fmtDinero(t.total)}? El precio que ya se actualizó en Finanzas no cambia.`)) return;
  const { error } = await sb.from('compras_tickets').delete().eq('id', id);
  if(error){ cmpMsg('No se pudo borrar: ' + error.message, 'err'); return; }
  const rutas = cmpFotosDe(t); if(rutas.length) await sb.storage.from('tickets').remove(rutas);
  cmp.hist = cmp.hist.filter(h=> h.ticket_id !== id);
  cmp.tkAbierto = null;
  await cargarTicketsMes();
}

// ---------- Alertas de ganancia ----------
// Con los precios nuevos de un ticket, recalcula los productos de Finanzas y regresa los que pierden margen.
async function cmpImpactoMargen(cambios){
  if(!cambios.length || typeof resumenProducto !== 'function') return null;
  if(!finCargado) await cargarFinanzas();
  if(!finCargado) return null;
  const prods = fin.recetas.filter(r=> r.tipo === 'producto');
  const calcular = ()=>{ _memo.clear(); const m = {}; prods.forEach(p=>{ const r = resumenProducto(p); if(r.utilidad != null && !r.faltan.length) m[p.id] = r; }); return m; };
  const antes = calcular();
  cambios.forEach(c=>{ const i = insPorId(c.id); if(i) Object.assign(i, { cantidad: c.cantidad, precio: c.precio }); });
  const despues = calcular();
  _memo.clear();
  const comp = prods.filter(p=> antes[p.id] && despues[p.id]).map(p=> ({ p, a: antes[p.id], d: despues[p.id] }));
  return {
    bajan: comp.filter(x=> x.d.utilidad < x.a.utilidad - 0.005).sort((x, y)=> (x.d.pctUtil - x.a.pctUtil) - (y.d.pctUtil - y.a.pctUtil)),
    suben: comp.filter(x=> x.d.utilidad > x.a.utilidad + 0.005).length
  };
}
function impactoHtml(imp){
  if(!imp || (!imp.bajan.length && !imp.suben)) return '';
  const nombre = p=> escHtml(p.nombre) + (p.tamano ? ' ' + escHtml(finTamano(p.tamano).toLowerCase()) : '');
  // Solo se enlistan los que bajan al menos 0.1 puntos de ganancia; los demás se cuentan
  const notables = imp.bajan.filter(x=> x.a.pctUtil - x.d.pctUtil >= 0.001 || x.d.utilidad < 0);
  const max = 12, lista = notables.slice(0, max), resto = imp.bajan.length - lista.length;
  const filas = lista.map(({ p, a, d })=> `<li>${d.utilidad < 0 ? '<b class="cmp-sube">Ya no deja ganancia:</b> ' : ''}<b>${nombre(p)}</b>: ganancia ${finPct(a.pctUtil)} → <b>${finPct(d.pctUtil)}</b> (${fin2(d.utilidad - a.utilidad)} por pieza)</li>`).join('');
  return `<div class="cmp-impacto">${imp.bajan.length ? `<b>▼ ${imp.bajan.length} ${imp.bajan.length === 1 ? 'producto gana' : 'productos ganan'} menos con estos precios:</b><ul>${filas}</ul>${resto ? `<div>${lista.length ? 'Y' : 'Bajan muy poco:'} ${resto} ${resto === 1 ? 'producto' : 'productos'} más${lista.length ? ' con cambios más chicos' : ''} (velos en Finanzas → Productos y márgenes).</div>` : ''}` : ''}
    ${imp.suben ? `<div>▲ ${imp.suben} ${imp.suben === 1 ? 'producto gana' : 'productos ganan'} más.</div>` : ''}</div>`;
}
