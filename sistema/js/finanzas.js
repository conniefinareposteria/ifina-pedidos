// Finanzas (solo directora). Es el Excel "Connie - Costeo" pasado al sistema, con la lógica corregida.
// Secciones (chips de arriba):
//  · Productos y márgenes: cada pastel por tamaño, de qué está armado (pan, relleno, cubierta, corona, caja, base…),
//    su costo, el costo fijo que le toca, la utilidad y el margen. Precio de venta sin IEPS.
//  · Subrecetas: mezclas, panes por tamaño, rellenos, betunes, coronas… con lo que rinde cada lote y su costo por g o pieza.
//  · Insumos: lo que se compra (presentación, precio, merma) y los premanejados (clara y yema salen del huevo).
//  · Empaques: cajas, bases y otros empaques, por pieza.
//  · Costos fijos: gastos del mes, ventas de cada mes, % de costo fijo, impuesto y punto de equilibrio.
//  · Calculadora: armar un producto sin guardarlo (y guardarlo si conviene).
// Datos en Supabase (sql/031, 032 y 033): insumos, insumos_historial, fin_recetas, fin_receta_partes, fin_costos_fijos, fin_config.
//
// Cómo se calcula (igual que el Excel, pero sin sus errores):
//  · Precio por g o pieza de un insumo = precio de la presentación / cantidad / (1 − merma). Kilos se pasan a gramos.
//  · Premanejado (sale de otro insumo) = precio por g del insumo base (sin su merma) / (1 − merma propia).
//    Así clara y yema cuestan por gramo lo mismo que el huevo y juntas suman el huevo completo.
//  · Subreceta: suma de sus ingredientes / lo que rinde / (1 − merma).
//  · Producto: ingredientes + empaque = costo variable. Precio sin impuesto = precio / (1 + tasa).
//    Costo fijo = precio sin impuesto × (costos fijos del mes / promedio de ventas del mes).
//    Utilidad = precio sin impuesto − costo variable − costo fijo.

let fin = { insumos: [], recetas: [], partes: [], fijos: [], config: {} };
let finCategoria = 'productos';
let finPila = [];              // editores abiertos (para regresar): { id } o { borrador: true }
let finSelector = null;        // { grupo, todo, crear } mientras se elige qué agregar
let finFiltroProd = 'Todos';
let finBorrador = null;        // calculadora (no se guarda hasta que se pide)
let finCargado = false;

const FIN_SECCIONES = [
  { id:'productos',  titulo:'Productos y márgenes' },
  { id:'subrecetas', titulo:'Subrecetas' },
  { id:'insumos',    titulo:'Insumos' },
  { id:'empaques',   titulo:'Empaques' },
  { id:'fijos',      titulo:'Costos fijos' },
  { id:'calculadora',titulo:'Calculadora' }
];
// Grupos de "de qué está armado". Cada insumo y subreceta tiene una de estas categorías;
// al agregar una caja solo salen cajas, al agregar relleno solo rellenos, etc.
const FIN_GRUPOS = [
  { id:'Pan',         titulo:'Pan',               boton:'Pan' },
  { id:'Mezcla',      titulo:'Mezcla de pan',     boton:'Mezcla de pan' },
  { id:'Relleno',     titulo:'Relleno',           boton:'Relleno' },
  { id:'Cubierta',    titulo:'Cubierta o betún',  boton:'Cubierta o betún' },
  { id:'Decoración',  titulo:'Decoración',        boton:'Decoración' },
  { id:'Corona',      titulo:'Corona',            boton:'Corona' },
  { id:'Ingrediente', titulo:'Ingredientes',      boton:'Ingrediente' },
  { id:'Caja',        titulo:'Caja',              boton:'Caja',         empaque:true },
  { id:'Base',        titulo:'Base',              boton:'Base',         empaque:true },
  { id:'Empaque',     titulo:'Otros empaques',    boton:'Otro empaque', empaque:true }
];
const FIN_BOTONES_PRODUCTO  = ['Pan','Relleno','Cubierta','Decoración','Corona','Caja','Base','Ingrediente','Empaque'];
const FIN_BOTONES_SUBRECETA = ['Ingrediente','Mezcla','Pan','Relleno','Cubierta','Decoración','Corona','Empaque'];
const FIN_CATS_SUBRECETA = ['Mezcla','Pan','Relleno','Cubierta','Decoración','Corona'];
const FIN_CATS_INSUMO = ['Ingrediente','Decoración','Relleno','Cubierta'];
const FIN_CATS_EMPAQUE = [ { id:'Caja', titulo:'Cajas', uno:'caja' }, { id:'Base', titulo:'Bases', uno:'base' }, { id:'Empaque', titulo:'Otros empaques', uno:'empaque' } ];
const FIN_CATS_PRODUCTO = ['Pastel','Cheesecake','Rollo','Cuchareable','Cupcake','Individual','Panqué','Otro'];
const FIN_TAMANOS = [ ['', 'Sin tamaño'], ['mini','Mini'], ['chico','Chico'], ['mediano','Mediano'], ['grande','Grande'], ['plancha','Plancha'] ];
const UNIDADES = { g:'g', kg:'kg', ml:'ml', pza:'piezas' };

// ---------- Utilidades ----------
const finNum = v => v === '' || v == null || isNaN(Number(v)) ? null : Number(v);
const fin2 = n => n == null || !isFinite(n) ? '—' : (n < 0 ? '−' : '') + '$' + Math.abs(n).toLocaleString('es-MX', { minimumFractionDigits:2, maximumFractionDigits:2 });
const finPct = n => n == null || !isFinite(n) ? '—' : (n * 100).toLocaleString('es-MX', { minimumFractionDigits:1, maximumFractionDigits:1 }) + '%';
const finCant = n => n == null ? '' : Number(n).toLocaleString('es-MX', { maximumFractionDigits:3 });
const finValIn = n => n == null ? '' : (Number(n) % 1 ? String(Math.round(Number(n) * 10000) / 10000) : String(n));
const finTamano = t => (FIN_TAMANOS.find(x=> x[0] === (t || '')) || [, t])[1];
const insPorId = id => fin.insumos.find(x=> x.id === id);
const recPorId = id => fin.recetas.find(x=> x.id === id);
function finQ(s){ return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }
function finMsg(texto, error){
  const m = document.getElementById('fin-msg'); if(!m) return;
  m.className = 'msg' + (texto ? (error ? ' err' : ' ok') : '');
  m.textContent = texto || '';
  clearTimeout(finMsg._t);
  if(texto && !error) finMsg._t = setTimeout(()=>{ if(m.textContent === texto){ m.className = 'msg'; m.textContent = ''; } }, 2500);
}
function finError(error, que){
  const t = error && error.message || '';
  if(/foreign key|violates.*restrict|still referenced/i.test(t)) return finMsg(`No se puede quitar: ${que || 'se'} usa en alguna receta.`, true);
  if(/duplicate|unique/i.test(t)) return finMsg('Ya existe uno con ese nombre' + (que ? ` (${que})` : '') + '.', true);
  if(/does not exist|schema cache|column/i.test(t)) return finMsg('Falta correr el SQL 033 de Finanzas en Supabase. ' + t, true);
  finMsg('No se pudo guardar: ' + t, true);
}

// ---------- Cálculos ----------
function unidadReceta(i){ return i.unidad === 'kg' ? 'g' : i.unidad; }
function precioCrudo(i, prof){                 // precio por g/ml/pza sin merma
  if(!i || (prof || 0) > 5) return null;
  if(i.base_id) return precioCrudo(insPorId(i.base_id), (prof || 0) + 1);
  const cant = i.unidad === 'kg' ? Number(i.cantidad) * 1000 : Number(i.cantidad);
  return cant > 0 && i.precio != null ? Number(i.precio) / cant : null;
}
function precioInsumo(i){ const c = precioCrudo(i); return c == null ? null : c / (1 - (Number(i.merma) || 0)); }
function partesDe(r){ return r === 'borrador' ? (finBorrador ? finBorrador.partes : []) : fin.partes.filter(p=> p.receta_id === r.id).sort((a, b)=> a.orden - b.orden || a.id - b.id); }
function itemDe(p){ return p.insumo_id ? insPorId(p.insumo_id) : recPorId(p.subreceta_id); }
function unidadItem(it){ return !it ? '' : it.tipo === 'subreceta' ? it.unidad : unidadReceta(it); }
function grupoItem(it){ return !it ? 'Ingrediente' : it.categoria || (it.tipo === 'material' ? 'Empaque' : 'Ingrediente'); }
const _memo = new Map();
function totalReceta(r, visit){              // { total, faltan[] }
  const key = r === 'borrador' ? 'borrador' : r.id;
  if(_memo.has(key)) return _memo.get(key);
  visit = visit || new Set();
  if(visit.has(key)) return { total: 0, faltan: ['(una subreceta se contiene a sí misma)'] };
  visit.add(key);
  let total = 0; const faltan = [];
  partesDe(r).forEach(p=>{
    const it = itemDe(p); const pu = precioParte(p, visit);
    if(pu == null || p.cantidad == null){ if(it) faltan.push(it.nombre); return; }
    total += Number(p.cantidad) * pu;
  });
  const res = { total, faltan };
  visit.delete(key);
  _memo.set(key, res);
  return res;
}
function precioSub(s, visit){
  if(!s) return null;
  const { total, faltan } = totalReceta(s, visit);
  if(faltan.length || !(Number(s.rendimiento) > 0)) return null;
  return total / Number(s.rendimiento) / (1 - (Number(s.merma) || 0));
}
function precioParte(p, visit){ return p.insumo_id ? precioInsumo(insPorId(p.insumo_id)) : precioSub(recPorId(p.subreceta_id), visit); }
function finConfig(clave, def){ return fin.config[clave] != null ? fin.config[clave] : def; }
function finImpuesto(){ const c = finConfig('impuesto', { nombre:'IEPS', tasa:0.08 }); return { nombre: c.nombre || 'Impuesto', tasa: Number(c.tasa) || 0 }; }
function totalFijos(){ return fin.fijos.reduce((s, f)=> s + (Number(f.costo_mensual) || 0) * (1 + (Number(f.prestacion) || 0)), 0); }
function promedioVentas(){ const v = finConfig('ventas_mensuales', []).map(x=> Number(x.venta)).filter(x=> x > 0); return v.length ? v.reduce((a, b)=> a + b, 0) / v.length : 0; }
function pctFijo(){ const p = promedioVentas(); return p > 0 ? totalFijos() / p : 0; }
function resumenProducto(r){
  const datos = r === 'borrador' ? finBorrador : r;
  const grupos = {}; let ingredientes = 0, empaque = 0; const faltan = [];
  partesDe(r).forEach(p=>{
    const it = itemDe(p), g = grupoItem(it), pu = precioParte(p);
    if(pu == null || p.cantidad == null){ if(it) faltan.push(it.nombre); return; }
    const v = Number(p.cantidad) * pu;
    grupos[g] = (grupos[g] || 0) + v;
    if((FIN_GRUPOS.find(x=> x.id === g) || {}).empaque) empaque += v; else ingredientes += v;
  });
  const variable = ingredientes + empaque;
  const precio = datos.precio_venta == null ? null : Number(datos.precio_venta);
  const imp = finImpuesto();
  const neto = precio == null ? null : precio / (1 + imp.tasa);
  const fijo = neto == null ? null : neto * pctFijo();
  const costoTotal = fijo == null ? null : variable + fijo;
  const utilidad = neto == null ? null : neto - costoTotal;
  return { grupos, ingredientes, empaque, variable, precio, neto, fijo, costoTotal, utilidad,
    pctUtil: neto ? utilidad / neto : null, margen: neto == null ? null : neto - variable, pctMargen: neto ? (neto - variable) / neto : null, faltan };
}
function porUnidad(pu, unidad){ return pu == null ? '—' : unidad === 'pza' ? fin2(pu) + ' /pza' : fin2(pu * 1000) + (unidad === 'ml' ? ' /l' : ' /kg'); }

// ---------- Carga ----------
function abrirFinanzas(){
  activarVistaDirectora('tab-finanzas', 'view-finanzas');
  cargarFinanzas();
}
async function cargarFinanzas(){
  const cont = document.getElementById('insumos-contenido');
  if(!finCargado){ cont.className = 'loading'; cont.textContent = 'Cargando...'; }
  const [a, b, c, d, e] = await Promise.all([
    sb.from('insumos').select('*').order('nombre'),
    sb.from('fin_recetas').select('*').order('orden'),
    sb.from('fin_receta_partes').select('*').order('orden'),
    sb.from('fin_costos_fijos').select('*').order('orden'),
    sb.from('fin_config').select('*')
  ]);
  const err = [a, b, c, d, e].find(x=> x.error);
  if(err){ cont.className = 'empty'; cont.textContent = 'No se pudo cargar Finanzas: ' + err.error.message + ' (revisa que ya se haya corrido el SQL 033 de Finanzas).'; return; }
  fin.insumos = (a.data || []).map(r=> ({ ...r, tipo: r.tipo || 'insumo' }));
  fin.recetas = b.data || []; fin.partes = c.data || []; fin.fijos = d.data || [];
  fin.config = {}; (e.data || []).forEach(x=> fin.config[x.clave] = x.valor);
  finCargado = true;
  pintarFinanzas();
}
function elegirCategoriaFinanzas(id){ finCategoria = id; finPila = []; finSelector = null; pintarFinanzas(); window.scrollTo(0, 0); }
// Repinta y deja el cursor donde estaba (cada campo tiene data-k)
function pintarFinanzas(cambioId){
  const cont = document.getElementById('insumos-contenido');
  let k = document.activeElement && document.activeElement.dataset ? document.activeElement.dataset.k : null;
  if(k && cambioId) k = k.replace('-nuevo-', '-' + cambioId + '-');   // fila recién creada: el cursor sigue en el mismo campo
  const msg = document.getElementById('fin-msg');
  const msgPrev = msg ? [msg.className, msg.textContent] : null;
  _memo.clear();
  cont.className = '';
  const chips = `<div class="chip-group cf-chips">${FIN_SECCIONES.map(c=> `<div class="chip${c.id === finCategoria ? ' selected' : ''}" onclick="elegirCategoriaFinanzas('${c.id}')">${c.titulo}</div>`).join('')}</div>`;
  const actual = finPila[finPila.length - 1];
  let cuerpo;
  if(actual) cuerpo = editorReceta(actual.borrador ? 'borrador' : recPorId(actual.id));
  else cuerpo = ({ productos: vistaProductos, subrecetas: vistaSubrecetas, insumos: vistaInsumos, empaques: vistaEmpaques, fijos: vistaFijos, calculadora: vistaCalculadora })[finCategoria]();
  cont.innerHTML = chips + '<div class="msg" id="fin-msg"></div>' + cuerpo;
  if(msgPrev){ const m = document.getElementById('fin-msg'); m.className = msgPrev[0]; m.textContent = msgPrev[1]; }
  if(k){ const el = cont.querySelector(`[data-k="${CSS.escape(k)}"]`); if(el){ el.focus(); if(el.select && el.dataset.sel) el.select(); } }
  const bus = document.getElementById('fin-sel-buscar'); if(bus && !k) bus.focus();
}

// ---------- Productos ----------
function vistaProductos(){
  const prods = fin.recetas.filter(r=> r.tipo === 'producto');
  const cats = ['Todos', ...FIN_CATS_PRODUCTO.filter(c=> prods.some(p=> p.categoria === c)), ...[...new Set(prods.map(p=> p.categoria).filter(c=> c && !FIN_CATS_PRODUCTO.includes(c)))]];
  if(!cats.includes(finFiltroProd)) finFiltroProd = 'Todos';
  const lista = prods.filter(p=> finFiltroProd === 'Todos' || p.categoria === finFiltroProd);
  const imp = finImpuesto();
  let filas = '', prev = null, sumas = { n:0, precio:0, variable:0, utilidad:0, pct:0 };
  lista.forEach(p=>{
    const r = resumenProducto(p);
    const nuevo = p.nombre !== prev; prev = p.nombre;
    if(r.utilidad != null){ sumas.n++; sumas.precio += r.precio; sumas.variable += r.variable; sumas.utilidad += r.utilidad; sumas.pct += r.pctUtil; }
    filas += `<tr class="fin-fila${nuevo ? ' fin-nuevo-grupo' : ''}" onclick="finAbrir(${p.id})">
      <td>${nuevo ? `<b>${escHtml(p.nombre)}</b>` : ''}</td><td>${escHtml(finTamano(p.tamano))}</td>
      <td class="n">${fin2(r.precio)}</td><td class="n">${fin2(r.variable)}${r.faltan.length ? ' <span class="fin-falta">falta precio</span>' : ''}</td>
      <td class="n">${fin2(r.fijo)}</td><td class="n"><b>${fin2(r.utilidad)}</b></td><td class="n">${finPct(r.pctUtil)}</td><td class="fin-ir">Ver ›</td></tr>`;
  });
  const prom = sumas.n ? `<tr class="fin-total"><td colspan="2">Promedio</td><td class="n">${fin2(sumas.precio / sumas.n)}</td><td class="n">${fin2(sumas.variable / sumas.n)}</td><td></td><td class="n">${fin2(sumas.utilidad / sumas.n)}</td><td class="n">${finPct(sumas.pct / sumas.n)}</td><td></td></tr>` : '';
  return `<div class="seccion-resumen fin-tabla">
    <div class="fin-titulo"><h3>Productos y márgenes</h3><button type="button" class="btn-secundario" onclick="finNuevaReceta('producto')">+ Nuevo producto</button></div>
    <div class="hint fin-nota">Toca un producto para ver de qué está armado y cambiarlo. Utilidad = precio sin ${escHtml(imp.nombre)} ${finPct(imp.tasa)} − ingredientes y empaque − costo fijo (${finPct(pctFijo())} de la venta).</div>
    <div class="chip-group fin-filtros">${cats.map(c=> `<div class="chip${c === finFiltroProd ? ' selected' : ''}" onclick="finFiltroProd='${escHtml(c)}'; pintarFinanzas()">${escHtml(c)}</div>`).join('')}</div>
    ${lista.length ? `<div class="tabla-scroll"><table class="tabla-insumos fin-lista">
      <thead><tr><th>Producto</th><th>Tamaño</th><th class="n">Precio</th><th class="n">Ingredientes y empaque</th><th class="n">Costo fijo</th><th class="n">Utilidad</th><th class="n">% utilidad</th><th></th></tr></thead>
      <tbody>${filas}${prom}</tbody></table></div>` : '<div class="empty">Todavía no hay productos.</div>'}
  </div>`;
}

// ---------- Subrecetas ----------
function vistaSubrecetas(){
  const subs = fin.recetas.filter(r=> r.tipo === 'subreceta');
  const grupos = [...FIN_CATS_SUBRECETA, ...new Set(subs.map(s=> s.categoria).filter(c=> !FIN_CATS_SUBRECETA.includes(c)))];
  const bloques = grupos.map(g=>{
    const ls = subs.filter(s=> s.categoria === g);
    if(!ls.length) return '';
    return `<tr class="fin-grupo-fila"><td colspan="6">${escHtml((FIN_GRUPOS.find(x=> x.id === g) || { titulo:g }).titulo)}</td></tr>` + ls.map(s=>{
      const t = totalReceta(s), pu = precioSub(s), usos = usosDe('s', s.id).length;
      return `<tr class="fin-fila" onclick="finAbrir(${s.id})"><td><b>${escHtml(s.nombre)}</b></td>
        <td class="n">${s.rendimiento ? finCant(s.rendimiento) + ' ' + (s.unidad === 'pza' ? 'pza' : 'g') : '—'}</td>
        <td class="n">${fin2(t.total)}${t.faltan.length ? ' <span class="fin-falta">falta precio</span>' : ''}</td>
        <td class="n"><b>${porUnidad(pu, s.unidad)}</b></td><td class="n">${usos ? usos + (usos === 1 ? ' receta' : ' recetas') : '—'}</td><td class="fin-ir">Ver ›</td></tr>`;
    }).join('');
  }).join('');
  const sinCat = subs.filter(s=> !s.categoria);
  return `<div class="seccion-resumen fin-tabla">
    <div class="fin-titulo"><h3>Subrecetas</h3><button type="button" class="btn-secundario" onclick="finNuevaReceta('subreceta')">+ Nueva subreceta</button></div>
    <div class="hint fin-nota">Lo que se prepara para armar los productos: mezclas, panes por tamaño, rellenos, betunes, coronas. Costo = ingredientes / lo que rinde, más merma.</div>
    <div class="tabla-scroll"><table class="tabla-insumos fin-lista">
      <thead><tr><th>Subreceta</th><th class="n">Rinde</th><th class="n">Costo del lote</th><th class="n">Costo</th><th class="n">Se usa en</th><th></th></tr></thead>
      <tbody>${bloques}${sinCat.map(s=> `<tr class="fin-fila" onclick="finAbrir(${s.id})"><td><b>${escHtml(s.nombre)}</b></td><td colspan="4">Sin categoría</td><td class="fin-ir">Ver ›</td></tr>`).join('')}</tbody></table></div>
  </div>`;
}
function usosDe(clase, id){
  return fin.partes.filter(p=> clase === 's' ? p.subreceta_id === id : p.insumo_id === id).map(p=> recPorId(p.receta_id)).filter(Boolean)
    .filter((r, i, a)=> a.indexOf(r) === i);
}
function nombreReceta(r){ return r.nombre + (r.tamano ? ' ' + finTamano(r.tamano).toLowerCase() : ''); }

// ---------- Editor de receta (producto, subreceta o calculadora) ----------
function finAbrir(id){ finPila.push({ id }); finSelector = null; pintarFinanzas(); window.scrollTo(0, 0); }
function finRegresar(){ finPila.pop(); finSelector = null; pintarFinanzas(); window.scrollTo(0, 0); }
function editorReceta(r){
  if(!r){ finPila.pop(); return '<div class="empty">Esa receta ya no existe.</div>'; }
  const borrador = r === 'borrador';
  const d = borrador ? finBorrador : r;
  const esProd = borrador || d.tipo === 'producto';
  const anterior = finPila[finPila.length - 2];
  const volverTxt = anterior ? (anterior.borrador ? 'Calculadora' : nombreReceta(recPorId(anterior.id) || { nombre:'Atrás' })) : (borrador ? null : esProd ? 'Productos' : 'Subrecetas');
  const partes = partesDe(r);
  const botones = esProd ? FIN_BOTONES_PRODUCTO : FIN_BOTONES_SUBRECETA;
  // Partes agrupadas
  const porGrupo = {};
  partes.forEach(p=>{ const g = grupoItem(itemDe(p)); (porGrupo[g] = porGrupo[g] || []).push(p); });
  const ordenGrupos = [...FIN_GRUPOS.map(g=> g.id), ...Object.keys(porGrupo).filter(g=> !FIN_GRUPOS.some(x=> x.id === g))];
  const grupos = ordenGrupos.filter(g=> porGrupo[g]).map(g=>{
    const info = FIN_GRUPOS.find(x=> x.id === g) || { titulo:g, boton:g };
    let sub = 0, falta = false;
    const filas = porGrupo[g].map(p=>{
      const it = itemDe(p), pu = precioParte(p), u = unidadItem(it);
      const v = pu == null || p.cantidad == null ? null : Number(p.cantidad) * pu;
      if(v == null) falta = true; else sub += v;
      const esSub = p.subreceta_id && it;
      return `<div class="fe-parte">
        <div class="fe-item">${esSub ? `<a href="#" onclick="finAbrirDesdeEditor(${it.id}); return false;" title="Ver cómo está hecha">${escHtml(it.nombre)} ›</a>` : escHtml(it ? it.nombre : '(ya no existe)')}
          <span class="fe-pu">${porUnidad(pu, u)}</span></div>
        <div class="fe-cant"><input type="number" inputmode="decimal" data-k="parte-${p.id}" data-sel="1" value="${finValIn(p.cantidad)}" placeholder="0" onchange="finCambiarParte(${p.id}, this.value)"><span>${u === 'pza' ? 'pza' : escHtml(u || '')}</span></div>
        <div class="fe-sub">${v == null ? '<span class="fin-falta">falta precio</span>' : fin2(v)}</div>
        <button type="button" class="ins-quitar" aria-label="Quitar ${escHtml(it ? it.nombre : '')}" onclick="finQuitarParte(${p.id})">×</button>
      </div>`;
    }).join('');
    return `<div class="fe-grupo"><div class="fe-grupo-cab"><b>${escHtml(info.titulo)}</b><span>${falta ? 'falta precio' : fin2(sub)}</span></div>${filas}
      <button type="button" class="link-agregar fe-mas" onclick="finAbrirSelector('${g}')">+ Agregar ${escHtml(info.boton.toLowerCase())}</button></div>`;
  }).join('');
  const agregar = `<div class="fe-agregar"><span>Agregar:</span>${botones.map(g=>{ const info = FIN_GRUPOS.find(x=> x.id === g); return `<button type="button" class="chip${finSelector && finSelector.grupo === g ? ' selected' : ''}" onclick="finAbrirSelector('${g}')">+ ${escHtml(info.boton)}</button>`; }).join('')}</div>`;
  // Cabecera
  const campo = (lbl, html, cls)=> `<div class="field${cls ? ' ' + cls : ''}"><label>${lbl}</label>${html}</div>`;
  const cab = [
    campo('Nombre', `<input type="text" data-k="fe-nombre" value="${escHtml(d.nombre || '')}" onchange="finCambiarReceta('nombre', this.value)">`, 'fe-nombre'),
    esProd ? campo('Tamaño', `<select data-k="fe-tamano" onchange="finCambiarReceta('tamano', this.value)">${FIN_TAMANOS.map(([v, t])=> `<option value="${v}"${(d.tamano || '') === v ? ' selected' : ''}>${t}</option>`).join('')}</select>`) : '',
    campo('Categoría', `<select data-k="fe-cat" onchange="finCambiarReceta('categoria', this.value)">${(esProd ? FIN_CATS_PRODUCTO : FIN_CATS_SUBRECETA).concat(d.categoria && !(esProd ? FIN_CATS_PRODUCTO : FIN_CATS_SUBRECETA).includes(d.categoria) ? [d.categoria] : []).map(c=> `<option${d.categoria === c ? ' selected' : ''}>${escHtml(c)}</option>`).join('')}</select>`),
    esProd ? campo('Precio de venta', `<div class="ins-precio"><span>$</span><input type="number" inputmode="decimal" data-k="fe-precio" value="${finValIn(d.precio_venta)}" placeholder="0" onchange="finCambiarReceta('precio_venta', this.value)"></div>`) : '',
    !esProd ? campo('Rinde', `<div class="ins-cant"><input type="number" inputmode="decimal" data-k="fe-rinde" value="${finValIn(d.rendimiento)}" placeholder="0" onchange="finCambiarReceta('rendimiento', this.value)"><select data-k="fe-unidad" onchange="finCambiarReceta('unidad', this.value)"><option value="g"${d.unidad !== 'pza' ? ' selected' : ''}>g</option><option value="pza"${d.unidad === 'pza' ? ' selected' : ''}>piezas</option></select></div>`) : '',
    !esProd ? campo('Merma', `<div class="ins-precio"><input type="number" inputmode="decimal" data-k="fe-merma" value="${finValIn(Math.round((Number(d.merma) || 0) * 1000) / 10)}" placeholder="0" onchange="finCambiarReceta('merma', this.value)"><span>%</span></div>`) : ''
  ].join('');
  // Resultado
  let resultado;
  if(esProd){
    const s = resumenProducto(r), imp = finImpuesto();
    const fila = (t, v, extra)=> `<div class="fe-res-fila${extra ? ' ' + extra : ''}"><span>${t}</span><b>${v}</b></div>`;
    const partesPct = Object.entries(s.grupos).sort((a, b)=> b[1] - a[1]).map(([g, v])=>{
      const pct = s.variable ? v / s.variable : 0;
      return `<div class="fe-barra"><span class="fe-barra-t">${escHtml((FIN_GRUPOS.find(x=> x.id === g) || { titulo:g }).titulo)}</span><span class="fe-barra-v"><i style="width:${Math.max(2, pct * 100)}%"></i></span><span class="fe-barra-n">${fin2(v)} · ${finPct(pct)}</span></div>`;
    }).join('');
    resultado = `<div class="fe-resultado">
      <h3>Cuánto cuesta y cuánto deja</h3>
      ${s.faltan.length ? `<div class="msg err">Falta precio de: ${escHtml([...new Set(s.faltan)].join(', '))}. Mientras, el costo sale incompleto.</div>` : ''}
      ${fila('Ingredientes', fin2(s.ingredientes))}
      ${fila('Empaque (caja, base…)', fin2(s.empaque))}
      ${fila('Costo de ingredientes y empaque', fin2(s.variable), 'fe-fuerte')}
      ${fila('Precio de venta', fin2(s.precio))}
      ${fila(`Precio sin ${escHtml(imp.nombre)} (${finPct(imp.tasa)})`, fin2(s.neto))}
      ${fila(`Costo fijo que le toca (${finPct(pctFijo())})`, fin2(s.fijo))}
      ${fila('Costo total', fin2(s.costoTotal))}
      ${fila('Utilidad', fin2(s.utilidad) + (s.pctUtil != null ? ` <small>(${finPct(s.pctUtil)})</small>` : ''), 'fe-fuerte fe-utilidad')}
      ${fila('Margen de contribución', fin2(s.margen) + (s.pctMargen != null ? ` <small>(${finPct(s.pctMargen)})</small>` : ''))}
      <div class="hint">Margen de contribución: lo que queda después de ingredientes y empaque, antes del costo fijo.</div>
      ${partesPct ? `<div class="fe-barras"><div class="sub-titulo">En qué se va el costo</div>${partesPct}</div>` : ''}
    </div>`;
  } else {
    const t = totalReceta(r), pu = precioSub(r), usos = usosDe('s', r.id);
    resultado = `<div class="fe-resultado">
      <h3>Costo</h3>
      ${t.faltan.length ? `<div class="msg err">Falta precio de: ${escHtml([...new Set(t.faltan)].join(', '))}.</div>` : ''}
      <div class="fe-res-fila"><span>Costo del lote</span><b>${fin2(t.total)}</b></div>
      <div class="fe-res-fila"><span>Rinde</span><b>${d.rendimiento ? finCant(d.rendimiento) + ' ' + (d.unidad === 'pza' ? 'pza' : 'g') : 'falta'}</b></div>
      <div class="fe-res-fila"><span>Merma</span><b>${finPct(Number(d.merma) || 0)}</b></div>
      <div class="fe-res-fila fe-fuerte"><span>Costo por ${d.unidad === 'pza' ? 'pieza' : 'kilo'}</span><b>${pu == null ? '—' : d.unidad === 'pza' ? fin2(pu) : fin2(pu * 1000)}</b></div>
      ${d.unidad !== 'pza' && pu != null ? `<div class="fe-res-fila"><span>Costo por gramo</span><b>$${pu.toLocaleString('es-MX', { minimumFractionDigits:4, maximumFractionDigits:4 })}</b></div>` : ''}
      <div class="sub-titulo" style="margin-top:14px;">Se usa en</div>
      <div class="fe-usos">${usos.length ? usos.map(u=> `<a href="#" onclick="finAbrirDesdeEditor(${u.id}); return false;">${escHtml(nombreReceta(u))}</a>`).join('') : '<span class="hint">Todavía en ninguna receta.</span>'}</div>
    </div>`;
  }
  const acciones = borrador
    ? `<div class="fe-acciones"><button type="button" class="primary" onclick="finGuardarBorrador()">Guardar como producto</button><button type="button" class="btn-secundario" onclick="finNuevoBorrador()">Empezar de nuevo</button></div>`
    : `<div class="fe-acciones"><button type="button" class="btn-secundario" onclick="finDuplicar(${r.id})">Duplicar</button><button type="button" class="btn-borrar" onclick="finBorrarReceta(${r.id})">Eliminar ${esProd ? 'producto' : 'subreceta'}</button></div>`;
  return `${volverTxt ? `<a href="#" class="link-accion" onclick="finRegresar(); return false;">← ${escHtml(volverTxt)}</a>` : ''}
    <div class="fin-editor">
      ${borrador ? '<div class="hint fin-nota">Arma un producto para ver cuánto cuesta y cuánto deja. No se guarda hasta que le das "Guardar como producto".</div>' : ''}
      <div class="fe-cab">${cab}</div>
      <div class="fe-cuerpo">
        <div class="fe-armado">
          <h3>De qué está armado</h3>
          ${grupos || '<div class="hint">Todavía no tiene nada. Empieza con los botones de abajo.</div>'}
          ${agregar}
          ${finSelector ? selectorHtml(r) : ''}
        </div>
        ${resultado}
      </div>
      ${acciones}
    </div>`;
}
function finAbrirDesdeEditor(id){ finPila.push({ id }); finSelector = null; pintarFinanzas(); window.scrollTo(0, 0); }

// Selector: al elegir "Caja" solo salen cajas (con buscador y opción de ver todo)
function finAbrirSelector(g){
  finSelector = finSelector && finSelector.grupo === g ? null : { grupo: g, todo: false, crear: false, q: '' };
  pintarFinanzas();
  const s = document.getElementById('fe-selector'); if(s) s.scrollIntoView({ block:'nearest', behavior:'smooth' });
}
function opcionesSelector(r){
  const actual = r === 'borrador' ? null : r;
  const prohib = new Set();
  if(actual && actual.tipo === 'subreceta'){                // no meter una subreceta dentro de sí misma
    const subeA = id=>{ prohib.add(id); fin.partes.filter(p=> p.subreceta_id === id).forEach(p=>{ if(!prohib.has(p.receta_id)) subeA(p.receta_id); }); };
    subeA(actual.id);
  }
  const items = [
    ...fin.insumos.map(i=> ({ clase:'i', id:i.id, nombre:i.nombre, grupo: grupoItem(i), pu: precioInsumo(i), u: unidadReceta(i), nota: i.base_id ? 'sale de ' + ((insPorId(i.base_id) || {}).nombre || '') : '' })),
    ...fin.recetas.filter(s=> s.tipo === 'subreceta' && !prohib.has(s.id)).map(s=> ({ clase:'s', id:s.id, nombre:s.nombre, grupo: s.categoria || 'Pan', pu: precioSub(s), u: s.unidad, nota:'subreceta' }))
  ];
  const q = finQ(finSelector.q);
  return items.filter(x=> (finSelector.todo || x.grupo === finSelector.grupo) && (!q || finQ(x.nombre).includes(q))).sort((a, b)=> a.nombre.localeCompare(b.nombre, 'es'));
}
function selectorHtml(r){
  const info = FIN_GRUPOS.find(x=> x.id === finSelector.grupo) || { titulo: finSelector.grupo, boton: finSelector.grupo };
  const ops = opcionesSelector(r);
  const esEmp = !!info.empaque;
  const crear = finSelector.crear ? `<div class="fe-crear">
      <div class="sub-titulo">Nuevo: ${escHtml(info.boton.toLowerCase())}</div>
      <div class="fe-crear-campos">
        <input type="text" id="fe-crear-nombre" data-k="fe-crear-nombre" placeholder="Nombre">
        ${esEmp ? '' : `<input type="number" inputmode="decimal" id="fe-crear-cant" placeholder="Cantidad" style="width:100px;"><select id="fe-crear-unidad">${Object.entries(UNIDADES).map(([k, t])=> `<option value="${k}">${t}</option>`).join('')}</select>`}
        <div class="ins-precio"><span>$</span><input type="number" inputmode="decimal" id="fe-crear-precio" placeholder="${esEmp ? 'Por pieza' : 'Precio'}"></div>
        <button type="button" class="primary" onclick="finCrearDesdeSelector()">Crear y agregar</button>
      </div>
      ${['Pan','Mezcla','Relleno','Cubierta','Corona'].includes(finSelector.grupo) ? '<div class="hint">Esto crea un insumo comprado. Si se prepara aquí (con su propia receta), créalo en Subrecetas.</div>' : ''}
    </div>` : '';
  return `<div class="fe-selector" id="fe-selector">
    <div class="fe-sel-cab"><b>Elige ${finSelector.todo ? 'cualquier cosa' : escHtml(info.boton.toLowerCase())}</b>
      <button type="button" class="ins-quitar" aria-label="Cerrar" onclick="finSelector=null; pintarFinanzas()">×</button></div>
    <input type="text" id="fin-sel-buscar" data-k="fin-sel-buscar" placeholder="Buscar" value="${escHtml(finSelector.q)}" oninput="finSelector.q=this.value; finRepintarOpciones()">
    <div class="fe-ops" id="fe-ops">${opsHtml(ops)}</div>
    <div class="fe-sel-pie">
      <label class="fe-todo"><input type="checkbox" ${finSelector.todo ? 'checked' : ''} onchange="finSelector.todo=this.checked; pintarFinanzas()"> Ver todo (no solo ${escHtml(info.boton.toLowerCase())})</label>
      <button type="button" class="link-agregar" onclick="finSelector.crear=!finSelector.crear; pintarFinanzas(); const e=document.getElementById('fe-crear-nombre'); if(e) e.focus();">+ Crear nuevo</button>
    </div>
    ${crear}
  </div>`;
}
function opsHtml(ops){
  return ops.length ? ops.map(x=> `<button type="button" class="fe-op" onclick="finAgregarParte('${x.clase}', ${x.id})"><span>${escHtml(x.nombre)}${x.nota ? ` <small>${escHtml(x.nota)}</small>` : ''}</span><span class="fe-op-pu">${porUnidad(x.pu, x.u)}</span></button>`).join('')
    : `<div class="hint" style="padding:10px;">No hay ${finSelector.q ? 'resultados' : 'nada en esta categoría todavía'}. ${finSelector.todo ? '' : 'Prueba "Ver todo" o créalo.'}</div>`;
}
function finRepintarOpciones(){
  const a = finPila[finPila.length - 1]; if(!a) return;
  _memo.clear();
  document.getElementById('fe-ops').innerHTML = opsHtml(opcionesSelector(a.borrador ? 'borrador' : recPorId(a.id)));
}
async function finCrearDesdeSelector(){
  const nombre = document.getElementById('fe-crear-nombre').value.trim();
  if(!nombre){ finMsg('Ponle nombre.', true); return; }
  const info = FIN_GRUPOS.find(x=> x.id === finSelector.grupo) || {};
  const precio = finNum(document.getElementById('fe-crear-precio').value);
  const datos = info.empaque
    ? { nombre, tipo:'material', categoria: finSelector.grupo, unidad:'pza', cantidad:1, precio, merma:0, updated_at: new Date().toISOString() }
    : { nombre, tipo:'insumo', categoria: ['Decoración','Relleno','Cubierta'].includes(finSelector.grupo) ? finSelector.grupo : 'Ingrediente', unidad: document.getElementById('fe-crear-unidad').value, cantidad: finNum(document.getElementById('fe-crear-cant').value), precio, merma:0, updated_at: new Date().toISOString() };
  const { data, error } = await sb.from('insumos').insert([datos]).select().single();
  if(error) return finError(error, nombre);
  fin.insumos.push(data);
  finAgregarParte('i', data.id);
}
async function finAgregarParte(clase, id){
  const a = finPila[finPila.length - 1];
  const r = a.borrador ? 'borrador' : recPorId(a.id);
  const it = clase === 'i' ? insPorId(id) : recPorId(id);
  const parte = { insumo_id: clase === 'i' ? id : null, subreceta_id: clase === 's' ? id : null, cantidad: unidadItem(it) === 'pza' ? 1 : null, orden: partesDe(r).length };
  let nueva;
  if(r === 'borrador'){ nueva = { ...parte, id: -(Date.now()), receta_id: 'borrador' }; finBorrador.partes.push(nueva); }
  else {
    const { data, error } = await sb.from('fin_receta_partes').insert([{ ...parte, receta_id: r.id }]).select().single();
    if(error) return finError(error);
    nueva = data; fin.partes.push(data);
  }
  finSelector = null;
  pintarFinanzas();
  const inp = document.querySelector(`[data-k="parte-${nueva.id}"]`);
  if(inp){ inp.scrollIntoView({ block:'center', behavior:'smooth' }); if(nueva.cantidad == null) inp.focus(); }
  finMsg(`Agregado: ${it.nombre}${nueva.cantidad == null ? '. Escribe la cantidad.' : ''}`);
}
async function finCambiarParte(id, valor){
  const cantidad = finNum(valor);
  if(id < 0){ const p = finBorrador.partes.find(x=> x.id === id); if(p) p.cantidad = cantidad; pintarFinanzas(); return; }
  const { data, error } = await sb.from('fin_receta_partes').update({ cantidad }).eq('id', id).select().single();
  if(error) return finError(error);
  const i = fin.partes.findIndex(x=> x.id === id); if(i >= 0) fin.partes[i] = data || { ...fin.partes[i], cantidad };
  finMsg('Guardado');
  pintarFinanzas();
}
async function finQuitarParte(id){
  if(id < 0){ finBorrador.partes = finBorrador.partes.filter(x=> x.id !== id); pintarFinanzas(); return; }
  const { error } = await sb.from('fin_receta_partes').delete().eq('id', id);
  if(error) return finError(error);
  fin.partes = fin.partes.filter(x=> x.id !== id);
  finMsg('Quitado');
  pintarFinanzas();
}
async function finCambiarReceta(campo, valor){
  const a = finPila[finPila.length - 1]; if(!a) return;
  let v = valor;
  if(['precio_venta','rendimiento'].includes(campo)) v = finNum(valor);
  if(campo === 'merma') v = Math.min(0.99, Math.max(0, (finNum(valor) || 0) / 100));
  if(campo === 'nombre'){ v = String(valor).trim(); if(!v){ finMsg('Necesita nombre.', true); pintarFinanzas(); return; } }
  if(a.borrador){ finBorrador[campo] = v; pintarFinanzas(); return; }
  const { data, error } = await sb.from('fin_recetas').update({ [campo]: v, updated_at: new Date().toISOString() }).eq('id', a.id).select().single();
  if(error){ finError(error, campo === 'nombre' || campo === 'tamano' ? 'mismo nombre y tamaño' : ''); pintarFinanzas(); return; }
  const i = fin.recetas.findIndex(x=> x.id === a.id); if(i >= 0) fin.recetas[i] = data || { ...fin.recetas[i], [campo]: v };
  finMsg('Guardado');
  pintarFinanzas();
}
function nombreLibre(tipo, base, tamano){
  let n = base, k = 2;
  while(fin.recetas.some(r=> r.tipo === tipo && r.nombre === n && (r.tamano || '') === (tamano || ''))) n = base + ' ' + k++;
  return n;
}
async function finNuevaReceta(tipo){
  const datos = tipo === 'producto'
    ? { tipo, nombre: nombreLibre(tipo, 'Producto nuevo', 'chico'), tamano:'chico', categoria: finFiltroProd !== 'Todos' ? finFiltroProd : 'Pastel', unidad:'pza', orden: fin.recetas.length }
    : { tipo, nombre: nombreLibre(tipo, 'Subreceta nueva', ''), tamano:'', categoria:'Relleno', unidad:'g', merma:0, orden: fin.recetas.length };
  const { data, error } = await sb.from('fin_recetas').insert([datos]).select().single();
  if(error) return finError(error);
  fin.recetas.push(data);
  finPila = [{ id: data.id }]; finSelector = null;
  pintarFinanzas(); window.scrollTo(0, 0);
  const n = document.querySelector('[data-k="fe-nombre"]'); if(n){ n.focus(); n.select(); }
}
async function finDuplicar(id){
  const r = recPorId(id); if(!r) return;
  const { id: _i, created_at, updated_at, ...resto } = r;
  const datos = { ...resto, nombre: nombreLibre(r.tipo, r.nombre + ' (copia)', r.tamano), orden: fin.recetas.length };
  const { data, error } = await sb.from('fin_recetas').insert([datos]).select().single();
  if(error) return finError(error);
  fin.recetas.push(data);
  const partes = partesDe(r).map(p=> ({ receta_id: data.id, insumo_id: p.insumo_id, subreceta_id: p.subreceta_id, cantidad: p.cantidad, orden: p.orden }));
  if(partes.length){
    const res = await sb.from('fin_receta_partes').insert(partes).select();
    if(res.error) return finError(res.error);
    fin.partes.push(...(res.data || []));
  }
  finPila[finPila.length - 1] = { id: data.id };
  pintarFinanzas(); window.scrollTo(0, 0);
  finMsg('Copia creada. Cámbiale el nombre o el tamaño.');
}
async function finBorrarReceta(id){
  const r = recPorId(id); if(!r) return;
  const usos = usosDe('s', id);
  if(usos.length){ finMsg(`No se puede eliminar: se usa en ${usos.map(nombreReceta).join(', ')}. Quítala de ahí primero.`, true); return; }
  if(!confirm(`¿Eliminar "${nombreReceta(r)}"?`)) return;
  const { error } = await sb.from('fin_recetas').delete().eq('id', id);
  if(error) return finError(error, r.nombre);
  fin.recetas = fin.recetas.filter(x=> x.id !== id);
  fin.partes = fin.partes.filter(x=> x.receta_id !== id);
  finPila.pop(); finSelector = null;
  pintarFinanzas();
  finMsg('Eliminado');
}

// ---------- Calculadora ----------
function finNuevoBorrador(){ finBorrador = { nombre:'Pastel nuevo', tamano:'chico', categoria:'Pastel', precio_venta:null, partes:[] }; finSelector = null; pintarFinanzas(); }
function vistaCalculadora(){
  if(!finBorrador) finBorrador = { nombre:'Pastel nuevo', tamano:'chico', categoria:'Pastel', precio_venta:null, partes:[] };
  finPila = [{ borrador:true }];
  return editorReceta('borrador');
}
async function finGuardarBorrador(){
  const b = finBorrador;
  const datos = { tipo:'producto', nombre: nombreLibre('producto', (b.nombre || 'Producto nuevo').trim(), b.tamano), tamano: b.tamano || '', categoria: b.categoria, unidad:'pza', precio_venta: b.precio_venta, orden: fin.recetas.length };
  const { data, error } = await sb.from('fin_recetas').insert([datos]).select().single();
  if(error) return finError(error);
  fin.recetas.push(data);
  if(b.partes.length){
    const res = await sb.from('fin_receta_partes').insert(b.partes.map((p, k)=> ({ receta_id: data.id, insumo_id: p.insumo_id, subreceta_id: p.subreceta_id, cantidad: p.cantidad, orden: k }))).select();
    if(res.error) return finError(res.error);
    fin.partes.push(...(res.data || []));
  }
  finBorrador = null;
  finCategoria = 'productos'; finPila = [{ id: data.id }]; finSelector = null;
  pintarFinanzas(); window.scrollTo(0, 0);
  finMsg('Guardado en Productos.');
}

// ---------- Insumos ----------
function filaInsumo(r){
  const id = r.id ? Number(r.id) : 'nuevo';
  const fecha = r.updated_at ? new Date(r.updated_at).toLocaleDateString('es-MX', { day:'numeric', month:'short' }) : '';
  const k = 'ins-' + id + '-';
  return `<tr data-id="${id}" data-tipo="insumo" data-nombre="${escHtml(finQ(r.nombre))}">
    <td><input type="text" class="ins-nombre" data-k="${k}n" value="${escHtml(r.nombre || '')}" placeholder="Ej. Harina" onchange="guardarInsumo(this)"></td>
    <td class="ins-cant"><input type="number" inputmode="decimal" class="ins-cantidad" data-k="${k}c" value="${r.cantidad ?? ''}" placeholder="1000" onchange="guardarInsumo(this)">
      <select class="ins-unidad" data-k="${k}u" onchange="guardarInsumo(this)" aria-label="Unidad">${Object.entries(UNIDADES).map(([u, t])=> `<option value="${u}"${(r.unidad || 'g') === u ? ' selected' : ''}>${t}</option>`).join('')}</select></td>
    <td><div class="ins-precio"><span>$</span><input type="number" inputmode="decimal" class="ins-precio-in" data-k="${k}p" value="${r.precio == null ? '' : (r.precio % 1 ? Number(r.precio).toFixed(2) : r.precio)}" placeholder="0" onchange="guardarInsumo(this)"></div></td>
    <td><div class="ins-precio"><input type="number" inputmode="decimal" class="ins-merma" data-k="${k}m" value="${finValIn(Math.round((Number(r.merma) || 0) * 1000) / 10)}" placeholder="0" onchange="guardarInsumo(this)" style="width:56px;"><span>%</span></div></td>
    <td class="ins-pieza">${r.id ? porUnidad(precioInsumo(r), unidadReceta(r)) : ''}</td>
    <td><select class="ins-cat" data-k="${k}g" onchange="guardarInsumo(this)" aria-label="Categoría">${FIN_CATS_INSUMO.concat(r.categoria && !FIN_CATS_INSUMO.includes(r.categoria) ? [r.categoria] : []).map(c=> `<option${(r.categoria || 'Ingrediente') === c ? ' selected' : ''}>${escHtml(c)}</option>`).join('')}</select></td>
    <td class="ins-estado">${fecha ? 'Act. ' + fecha : ''}</td>
    <td class="c">${r.id ? `<button type="button" class="ins-quitar" aria-label="Quitar" onclick="quitarInsumo(${id})">×</button>` : ''}</td>
  </tr>`;
}
function filaPremanejado(r){
  const id = r.id ? Number(r.id) : 'nuevo', k = 'pre-' + id + '-';
  const bases = fin.insumos.filter(i=> i.tipo === 'insumo' && !i.base_id && i.id !== r.id).sort((a, b)=> a.nombre.localeCompare(b.nombre, 'es'));
  return `<tr data-id="${id}" data-tipo="premanejado">
    <td><input type="text" class="ins-nombre" data-k="${k}n" value="${escHtml(r.nombre || '')}" placeholder="Ej. Clara de huevo" onchange="guardarPremanejado(this)"></td>
    <td><select class="pre-base" data-k="${k}b" onchange="guardarPremanejado(this)"><option value="">Elige…</option>${bases.map(b=> `<option value="${b.id}"${r.base_id === b.id ? ' selected' : ''}>${escHtml(b.nombre)}</option>`).join('')}</select></td>
    <td><div class="ins-precio"><input type="number" inputmode="decimal" class="ins-merma" data-k="${k}m" value="${finValIn(Math.round((Number(r.merma) || 0) * 1000) / 10)}" placeholder="0" onchange="guardarPremanejado(this)" style="width:56px;"><span>%</span></div></td>
    <td class="ins-pieza">${r.id ? porUnidad(precioInsumo(r), 'g') : ''}</td>
    <td class="c">${r.id ? `<button type="button" class="ins-quitar" aria-label="Quitar" onclick="quitarInsumo(${id})">×</button>` : ''}</td>
  </tr>`;
}
function vistaInsumos(){
  const ins = fin.insumos.filter(i=> i.tipo === 'insumo' && !i.base_id);
  const pre = fin.insumos.filter(i=> i.tipo === 'insumo' && i.base_id);
  return `<div class="seccion-resumen fin-tabla"><h3>Insumos</h3>
    <div class="hint fin-nota">Lo que compras: cuánto trae la presentación, cuánto cuesta y cuánto se pierde (merma: cáscaras, lo que queda en el bote…). El costo real ya incluye la merma. Se guarda solo al cambiar un dato; cada cambio de precio queda en el historial.</div>
    <input type="text" class="fin-buscar" placeholder="Buscar insumo" oninput="finFiltrarFilas('insumos-filas-insumo', this.value)">
    <div class="tabla-scroll"><table class="tabla-insumos">
      <thead><tr><th>Insumo</th><th>Presentación</th><th>Precio</th><th>Merma</th><th>Costo real</th><th>Categoría</th><th></th><th></th></tr></thead>
      <tbody id="insumos-filas-insumo">${ins.map(filaInsumo).join('')}</tbody>
    </table></div>
    <button type="button" class="btn-secundario" onclick="agregarFilaInsumo('insumo')">+ Agregar insumo</button>
  </div>
  <div class="seccion-resumen fin-tabla"><h3>Premanejados</h3>
    <div class="hint fin-nota">Salen de otro insumo y cuestan lo mismo por gramo (más su merma). Ej. la clara y la yema salen del huevo: juntas suman lo que cuesta el huevo.</div>
    <div class="tabla-scroll"><table class="tabla-insumos">
      <thead><tr><th>Premanejado</th><th>Sale de</th><th>Merma</th><th>Costo real</th><th></th></tr></thead>
      <tbody id="insumos-filas-premanejado">${pre.map(filaPremanejado).join('')}</tbody>
    </table></div>
    <button type="button" class="btn-secundario" onclick="agregarFilaInsumo('premanejado')">+ Agregar premanejado</button>
  </div>`;
}
function finFiltrarFilas(tbody, q){
  q = finQ(q);
  document.querySelectorAll('#' + tbody + ' tr').forEach(tr=>{ tr.style.display = !q || (tr.dataset.nombre || '').includes(q) || tr.dataset.id === 'nuevo' ? '' : 'none'; });
}
function agregarFilaInsumo(tipo, cat){
  const tb = document.getElementById(tipo === 'material' ? 'insumos-filas-material-' + cat : 'insumos-filas-' + tipo);
  const ya = tb.querySelector('tr[data-id="nuevo"]');
  if(ya){ ya.querySelector('.ins-nombre').focus(); return; }
  tb.insertAdjacentHTML('beforeend', tipo === 'premanejado' ? filaPremanejado({}) : tipo === 'material' ? filaMaterial({ categoria: cat }) : filaInsumo({}));
  tb.querySelector('tr[data-id="nuevo"] .ins-nombre').focus();
}
async function finGuardarInsumoFila(tr, datos){
  if(!datos.nombre){ if(tr.dataset.id !== 'nuevo') finMsg('Necesita nombre.', true); return; }
  const est = tr.querySelector('.ins-estado'); if(est) est.textContent = 'Guardando...';
  const esNuevo = tr.dataset.id === 'nuevo';
  datos.updated_at = new Date().toISOString();
  const q = esNuevo ? sb.from('insumos').insert([datos]).select().single() : sb.from('insumos').update(datos).eq('id', Number(tr.dataset.id)).select().single();
  const { data, error } = await q;
  if(error){ if(est) est.textContent = ''; return finError(error, datos.nombre); }
  const i = fin.insumos.findIndex(x=> x.id === data.id);
  if(i >= 0) fin.insumos[i] = data; else fin.insumos.push(data);
  finMsg('Guardado: ' + data.nombre);
  pintarFinanzas(esNuevo ? data.id : null);
}
function guardarInsumo(el){
  const tr = el.closest('tr');
  const v = s=> tr.querySelector(s).value;
  const cantidad = finNum(v('.ins-cantidad')), precio = finNum(v('.ins-precio-in'));
  finGuardarInsumoFila(tr, { nombre: v('.ins-nombre').trim(), tipo:'insumo', unidad: v('.ins-unidad'), categoria: v('.ins-cat'),
    cantidad: cantidad > 0 ? cantidad : null, precio: precio >= 0 ? precio : null, merma: Math.min(0.99, Math.max(0, (finNum(v('.ins-merma')) || 0) / 100)) });
}
function guardarPremanejado(el){
  const tr = el.closest('tr');
  const v = s=> tr.querySelector(s).value;
  const base = finNum(v('.pre-base'));
  if(!base && tr.dataset.id === 'nuevo' && el.classList.contains('ins-nombre')){ finMsg('Ahora elige de qué insumo sale.'); return; }
  finGuardarInsumoFila(tr, { nombre: v('.ins-nombre').trim(), tipo:'insumo', categoria:'Ingrediente', unidad:'g', cantidad:null, precio:null, base_id: base, merma: Math.min(0.99, Math.max(0, (finNum(v('.ins-merma')) || 0) / 100)) });
}
async function quitarInsumo(id){
  const r = insPorId(id); if(!r) return;
  const usos = usosDe('i', id);
  if(usos.length){ finMsg(`No se puede quitar "${r.nombre}": se usa en ${usos.slice(0, 6).map(nombreReceta).join(', ')}${usos.length > 6 ? ' y ' + (usos.length - 6) + ' más' : ''}.`, true); return; }
  const deriv = fin.insumos.filter(i=> i.base_id === id);
  if(deriv.length){ finMsg(`No se puede quitar "${r.nombre}": de ahí salen ${deriv.map(i=> i.nombre).join(', ')}.`, true); return; }
  if(!confirm(`¿Quitar "${r.nombre}"? También se borra su historial de precios.`)) return;
  const { error } = await sb.from('insumos').delete().eq('id', id);
  if(error) return finError(error, r.nombre);
  fin.insumos = fin.insumos.filter(x=> x.id !== id);
  finMsg('Quitado: ' + r.nombre);
  pintarFinanzas();
}

// ---------- Empaques ----------
function filaMaterial(r){
  const id = r.id ? Number(r.id) : 'nuevo', k = 'mat-' + id + '-';
  const fecha = r.updated_at ? new Date(r.updated_at).toLocaleDateString('es-MX', { day:'numeric', month:'short' }) : '';
  return `<tr data-id="${id}" data-tipo="material" data-cat="${escHtml(r.categoria || 'Empaque')}">
    <td><input type="text" class="ins-nombre" data-k="${k}n" value="${escHtml(r.nombre || '')}" placeholder="Ej. Caja chica 12 pulgadas" onchange="guardarMaterial(this)"></td>
    <td><input type="number" inputmode="decimal" class="ins-cantidad" data-k="${k}c" value="${r.cantidad ?? ''}" placeholder="1" onchange="guardarMaterial(this)" style="width:78px;"></td>
    <td><div class="ins-precio"><span>$</span><input type="number" inputmode="decimal" class="ins-precio-in" data-k="${k}p" value="${r.precio == null ? '' : (r.precio % 1 ? Number(r.precio).toFixed(2) : r.precio)}" placeholder="0" onchange="guardarMaterial(this)"></div></td>
    <td class="ins-pieza">${r.id ? porUnidad(precioInsumo(r), 'pza') : ''}</td>
    <td><select class="ins-cat" data-k="${k}g" onchange="guardarMaterial(this)" aria-label="Tipo">${FIN_CATS_EMPAQUE.map(c=> `<option value="${c.id}"${(r.categoria || 'Empaque') === c.id ? ' selected' : ''}>${c.titulo}</option>`).join('')}</select></td>
    <td class="ins-estado">${fecha ? 'Act. ' + fecha : ''}</td>
    <td class="c">${r.id ? `<button type="button" class="ins-quitar" aria-label="Quitar" onclick="quitarInsumo(${id})">×</button>` : ''}</td>
  </tr>`;
}
function vistaEmpaques(){
  const mats = fin.insumos.filter(i=> i.tipo === 'material');
  return FIN_CATS_EMPAQUE.map(c=> `<div class="seccion-resumen fin-tabla"><h3>${c.titulo}</h3>
    ${c.id === 'Caja' ? '<div class="hint fin-nota">Cajas, bases y otros empaques por pieza (si compras un paquete, pon cuántas piezas trae y el precio del paquete). Lo que agregues aquí sale en los productos al tocar "+ Caja", "+ Base" u "+ Otro empaque".</div>' : ''}
    <div class="tabla-scroll"><table class="tabla-insumos">
      <thead><tr><th>${c.id === 'Empaque' ? 'Empaque' : c.titulo.slice(0, -1)}</th><th>Piezas</th><th>Precio</th><th>Por pieza</th><th>Tipo</th><th></th><th></th></tr></thead>
      <tbody id="insumos-filas-material-${c.id}">${mats.filter(m=> (m.categoria || 'Empaque') === c.id).map(filaMaterial).join('')}</tbody>
    </table></div>
    <button type="button" class="btn-secundario" onclick="agregarFilaInsumo('material', '${c.id}')">+ Agregar ${c.uno}</button>
  </div>`).join('');
}
function guardarMaterial(el){
  const tr = el.closest('tr');
  const v = s=> tr.querySelector(s).value;
  const cantidad = finNum(v('.ins-cantidad')), precio = finNum(v('.ins-precio-in'));
  finGuardarInsumoFila(tr, { nombre: v('.ins-nombre').trim(), tipo:'material', unidad:'pza', categoria: v('.ins-cat'),
    cantidad: cantidad > 0 ? cantidad : (tr.dataset.id === 'nuevo' ? 1 : null), precio: precio >= 0 ? precio : null, merma: 0 });
}

// ---------- Costos fijos ----------
function vistaFijos(){
  const total = totalFijos(), prom = promedioVentas(), pct = pctFijo(), imp = finImpuesto();
  const ventas = finConfig('ventas_mensuales', []);
  const filas = fin.fijos.map(f=>{
    const k = 'fij-' + f.id + '-', tm = (Number(f.costo_mensual) || 0) * (1 + (Number(f.prestacion) || 0));
    return `<tr data-id="${f.id}">
      <td><input type="text" data-k="${k}c" value="${escHtml(f.concepto || '')}" onchange="finGuardarFijo(${f.id}, 'concepto', this.value)" placeholder="Ej. Renta"></td>
      <td><input type="text" data-k="${k}d" value="${escHtml(f.detalle || '')}" onchange="finGuardarFijo(${f.id}, 'detalle', this.value)" placeholder="Ej. Local"></td>
      <td><div class="ins-precio"><span>$</span><input type="number" inputmode="decimal" data-k="${k}m" value="${finValIn(f.costo_mensual)}" onchange="finGuardarFijo(${f.id}, 'costo_mensual', this.value)" placeholder="0"></div></td>
      <td><div class="ins-precio"><input type="number" inputmode="decimal" data-k="${k}p" value="${finValIn(Math.round((Number(f.prestacion) || 0) * 1000) / 10)}" onchange="finGuardarFijo(${f.id}, 'prestacion', this.value)" placeholder="0" style="width:56px;"><span>%</span></div></td>
      <td class="ins-pieza">${fin2(tm)}</td><td class="ins-pieza">${fin2(tm / 30.4)}</td>
      <td class="c"><button type="button" class="ins-quitar" aria-label="Quitar" onclick="finQuitarFijo(${f.id})">×</button></td></tr>`;
  }).join('');
  const filasV = ventas.map((v, i)=> `<tr><td><input type="text" data-k="ven-${i}-m" value="${escHtml(v.mes || '')}" onchange="finGuardarVenta(${i}, 'mes', this.value)" placeholder="Ej. Junio 2026"></td>
    <td><div class="ins-precio"><span>$</span><input type="number" inputmode="decimal" data-k="ven-${i}-v" value="${finValIn(v.venta)}" onchange="finGuardarVenta(${i}, 'venta', this.value)" placeholder="0" style="width:110px;"></div></td>
    <td class="c"><button type="button" class="ins-quitar" aria-label="Quitar" onclick="finQuitarVenta(${i})">×</button></td></tr>`).join('');
  const banda = pct <= 0.25 ? 'De 0% a 25%: hay espacio para invertir en estrategia.' : pct < 0.5 ? 'De 26% a 49%: dentro de lo sano; buscar ahorros donde se pueda.' : '50% o más: los gastos fijos son muy altos para lo que se vende.';
  // Punto de equilibrio con el promedio de los productos (precio sin impuesto)
  const prods = fin.recetas.filter(r=> r.tipo === 'producto').map(resumenProducto).filter(s=> s.neto != null);
  const ticket = prods.length ? prods.reduce((a, s)=> a + s.neto, 0) / prods.length : 0;
  const variable = prods.length ? prods.reduce((a, s)=> a + s.variable, 0) / prods.length : 0;
  const bruta = ticket - variable;
  const unidades = bruta > 0 ? total / bruta : null;
  const fila = (t, v, extra)=> `<div class="fe-res-fila${extra ? ' ' + extra : ''}"><span>${t}</span><b>${v}</b></div>`;
  return `<div class="seccion-resumen fin-tabla"><h3>Costos fijos del mes</h3>
    <div class="hint fin-nota">Lo que se paga cada mes aunque no vendas: renta, sueldos, luz, gas, agua, seguros… Prestación es el % extra de un sueldo (IMSS, aguinaldo…).</div>
    <div class="tabla-scroll"><table class="tabla-insumos">
      <thead><tr><th>Concepto</th><th>Detalle</th><th>Costo mensual</th><th>Prestación</th><th>Total mensual</th><th>Por día</th><th></th></tr></thead>
      <tbody id="fin-fijos">${filas}<tr class="fin-total"><td colspan="4">Total</td><td class="ins-pieza">${fin2(total)}</td><td class="ins-pieza">${fin2(total / 30.4)}</td><td></td></tr></tbody>
    </table></div>
    <button type="button" class="btn-secundario" onclick="finAgregarFijo()">+ Agregar gasto fijo</button>
  </div>
  <div class="fin-dos">
    <div class="seccion-resumen fin-tabla"><h3>Ventas de cada mes</h3>
      <div class="hint fin-nota">Con estas se saca la venta promedio. Más adelante saldrán solas de las ventas y pedidos del sistema.</div>
      <div class="tabla-scroll"><table class="tabla-insumos" style="min-width:0;"><thead><tr><th>Mes</th><th>Venta</th><th></th></tr></thead>
        <tbody>${filasV}<tr class="fin-total"><td>Promedio</td><td class="ins-pieza">${fin2(prom)}</td><td></td></tr></tbody></table></div>
      <button type="button" class="btn-secundario" onclick="finAgregarVenta()">+ Agregar mes</button>
    </div>
    <div class="seccion-resumen fin-tabla"><h3>Resultado</h3>
      <div class="fe-resultado fe-sola">
        ${fila('Costos fijos del mes', fin2(total))}
        ${fila('Venta promedio del mes', fin2(prom))}
        ${fila('% de costo fijo', finPct(pct), 'fe-fuerte')}
        <div class="hint">${banda} A cada producto le toca este % de su precio sin impuesto.</div>
        <div class="sub-titulo" style="margin-top:16px;">Impuesto que se le quita al precio</div>
        <div class="fin-imp"><input type="text" data-k="imp-n" value="${escHtml(imp.nombre)}" onchange="finGuardarImpuesto('nombre', this.value)" style="width:110px;">
          <div class="ins-precio"><input type="number" inputmode="decimal" data-k="imp-t" value="${finValIn(Math.round(imp.tasa * 1000) / 10)}" onchange="finGuardarImpuesto('tasa', this.value)" style="width:64px;"><span>%</span></div></div>
      </div>
    </div>
  </div>
  <div class="seccion-resumen fin-tabla"><h3>Punto de equilibrio</h3>
    <div class="hint fin-nota">Cuánto hay que vender para cubrir los costos fijos (ni ganar ni perder), tomando el promedio de los productos de la lista (precio sin ${escHtml(imp.nombre)}).</div>
    <div class="fe-resultado fe-sola">
      ${fila('Venta promedio por producto (sin impuesto)', fin2(ticket))}
      ${fila('Costo de ingredientes y empaque promedio', fin2(variable))}
      ${fila('Lo que deja cada producto para los fijos', fin2(bruta))}
      ${fila('Productos al mes para cubrir los fijos', unidades == null ? '—' : finCant(Math.ceil(unidades)), 'fe-fuerte')}
      ${fila('Productos a la semana', unidades == null ? '—' : finCant(Math.ceil(unidades / 4.34)))}
      ${fila('Venta mínima del mes (sin impuesto)', unidades == null ? '—' : fin2(unidades * ticket))}
    </div>
  </div>`;
}
async function finGuardarFijo(id, campo, valor){
  let v = valor;
  if(campo === 'costo_mensual') v = finNum(valor);
  if(campo === 'prestacion') v = Math.max(0, (finNum(valor) || 0) / 100);
  if(campo === 'concepto' && !String(valor).trim()){ finMsg('Necesita concepto.', true); return; }
  const { data, error } = await sb.from('fin_costos_fijos').update({ [campo]: v }).eq('id', id).select().single();
  if(error) return finError(error);
  const i = fin.fijos.findIndex(x=> x.id === id); if(i >= 0) fin.fijos[i] = data || { ...fin.fijos[i], [campo]: v };
  finMsg('Guardado'); pintarFinanzas();
}
async function finAgregarFijo(){
  const { data, error } = await sb.from('fin_costos_fijos').insert([{ concepto:'Nuevo gasto', orden: fin.fijos.length }]).select().single();
  if(error) return finError(error);
  fin.fijos.push(data); pintarFinanzas();
  const e = document.querySelector(`[data-k="fij-${data.id}-c"]`); if(e){ e.focus(); e.select(); }
}
async function finQuitarFijo(id){
  const f = fin.fijos.find(x=> x.id === id); if(!f) return;
  if(!confirm(`¿Quitar "${f.concepto}"?`)) return;
  const { error } = await sb.from('fin_costos_fijos').delete().eq('id', id);
  if(error) return finError(error);
  fin.fijos = fin.fijos.filter(x=> x.id !== id); pintarFinanzas();
}
async function finGuardarConfig(clave, valor){
  const { error } = await sb.from('fin_config').upsert({ clave, valor });
  if(error) return finError(error);
  fin.config[clave] = valor; finMsg('Guardado'); pintarFinanzas();
}
function finGuardarVenta(i, campo, valor){
  const v = finConfig('ventas_mensuales', []).map(x=> ({ ...x }));
  v[i][campo] = campo === 'venta' ? finNum(valor) : valor;
  finGuardarConfig('ventas_mensuales', v);
}
function finAgregarVenta(){ finGuardarConfig('ventas_mensuales', [...finConfig('ventas_mensuales', []), { mes:'', venta:null }]); }
function finQuitarVenta(i){ const v = finConfig('ventas_mensuales', []).slice(); v.splice(i, 1); finGuardarConfig('ventas_mensuales', v); }
function finGuardarImpuesto(campo, valor){
  const imp = { ...finImpuesto() };
  if(campo === 'tasa') imp.tasa = Math.max(0, (finNum(valor) || 0) / 100); else imp.nombre = String(valor).trim() || 'Impuesto';
  finGuardarConfig('impuesto', imp);
}
