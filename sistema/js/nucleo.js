// Núcleo: conexión a Supabase, estado de catálogos y utilidades generales (fechas, dinero, ventanas).

const SUPABASE_URL = "https://cmdiowwxpectngfidpuc.supabase.co";
const SUPABASE_KEY = "sb_publishable_Maj56l0lrEIGoIhKtAcJnw_HpkWaHIL";
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let rolActual = null;   // perfil de quien entró: 'director' | 'colaborador' | 'produccion' (ver PERMISOS en sesion.js)
let categoriaActual = null;
let tamanosData = [];
let saboresPastelesData = [];
let saboresCupcakesData = [];
let individualesData = [];
let coronasData = [];
let panquesData = [];
let PANQUE_PRODUCTOS = []; // se llena desde la tabla "panques" de Supabase
let INDIVIDUAL_PRODUCTOS = []; // se llena desde la tabla "individuales" de Supabase
let catalogosListos = null;
function formatNombre(s){
  if(!s) return '';
  if(s === 'terminal') return 'Tarjeta';
  if(s === 'mixto') return 'Pago diferido';
  let t = s.replace(/^cc_/i, '');
  t = t.replace(/_/g, ' ');
  return t.replace(/\b\w/g, c => c.toUpperCase());
}
function mostrarDebug(texto){
  const el = document.getElementById('debug-banner');
  el.style.display = 'block';
  el.textContent = texto;
  console.error(texto);
}
function escHtml(s){
  return String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
// Dinero con separador de miles; si tiene centavos se ven con 2 decimales ($1,234.50)
function fmtDinero(n){ const v = Number(n)||0; return '$' + v.toLocaleString('es-MX', v % 1 ? {minimumFractionDigits:2, maximumFractionDigits:2} : {}); }
function fechaHoyStr(){
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}
function campoConBorrar(id, valor, extraAttrs){
  extraAttrs = extraAttrs || '';
  return `<input type="number" inputmode="numeric" class="mini-input" id="${id}" value="${valor}" ${extraAttrs}>`;
}
function fechaStrDesdeDate(d){
  return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
}
function fechaLocalPartes(iso){
  if(!iso) return {f:'', h:''};
  const d = new Date(iso);
  const f = d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');
  const h = String(d.getHours()).padStart(2,'0')+':'+String(d.getMinutes()).padStart(2,'0');
  return {f, h};
}
function rangoHoyISO(){
  const d = new Date(); const ini = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const fin = new Date(ini); fin.setDate(fin.getDate()+1);
  return [ini.toISOString(), fin.toISOString()];
}
function leerNum(id){ const v = document.getElementById(id).value; return v === '' ? 0 : (Number(v) || 0); }
function abrirModal(k){ document.getElementById(k+'-velo').classList.add('on'); document.getElementById(k+'-hoja').classList.add('on'); }
function cerrarModal(k){ document.getElementById(k+'-velo').classList.remove('on'); document.getElementById(k+'-hoja').classList.remove('on'); }

// ---------- Números con separador de miles en todos los campos numéricos ----------
// Los <input type="number"> se vuelven campos de texto que se ven como "1,000" o "45.50".
// Al leer .value el código recibe el número sin comas ("1000"), así que nada más cambia.
const _valorInput = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
function _formatoNum(v){
  const t = String(v ?? '').replace(/,/g, '');
  if(t === '' || t === '-' || isNaN(Number(t))) return t;
  const [ent, dec] = t.split('.');
  const conComas = Number(ent || 0).toLocaleString('en-US');
  return (t.startsWith('-') && conComas[0] !== '-' ? '-' : '') + conComas + (dec !== undefined ? '.' + dec : '');
}
function numConComas(el){
  if(el.dataset.num) return;
  el.dataset.num = '1';
  const crudo = _valorInput.get.call(el);
  el.type = 'text';
  if(!el.getAttribute('inputmode')) el.setAttribute('inputmode', 'decimal');
  el.setAttribute('autocomplete', 'off');
  Object.defineProperty(el, 'value', {
    configurable: true,
    get(){ return _valorInput.get.call(el).replace(/,/g, ''); },
    set(v){ _valorInput.set.call(el, document.activeElement === el ? String(v ?? '') : _formatoNum(v)); }
  });
  el.value = crudo;
  // En iPad (Safari) el "change" no se dispara si el valor final lo acomodó el código (al poner las comas, ej. 40,000),
  // y entonces no se guardaba. Regla: si la persona tecleó y el número quedó distinto al último guardado,
  // al salir del campo se dispara el "change" (una sola vez; en Chrome el change normal ya llega antes y no se repite).
  // El punto de partida es el valor con el que se pintó el campo (no el del momento del foco: a veces el foco llega antes que esto).
  let base = String(el.getAttribute('value') ?? '').replace(/,/g, '');
  let tecleo = el.dataset.tecleo === '1';
  el.addEventListener('input', ()=>{ tecleo = true; });
  el.addEventListener('change', ()=>{ base = el.value; tecleo = false; });
  el.addEventListener('blur', ()=>{
    if(tecleo && el.value !== base) el.dispatchEvent(new Event('change', { bubbles:true }));
    tecleo = false;
  });
  // Mientras escribe: solo números y un punto, y las comas se van acomodando
  el.addEventListener('input', ()=>{
    const antes = _valorInput.get.call(el), pos = el.selectionStart || 0;
    const digAntes = antes.slice(0, pos).replace(/[^0-9.]/g, '').length;
    let limpio = antes.replace(/[^0-9.]/g, '');
    const i = limpio.indexOf('.'); if(i >= 0) limpio = limpio.slice(0, i + 1) + limpio.slice(i + 1).replace(/\./g, '');
    const nuevo = _formatoNum(limpio);
    if(nuevo === antes) return;
    _valorInput.set.call(el, nuevo);
    let k = 0, p = 0; while(p < nuevo.length && k < digAntes){ if(/[0-9.]/.test(nuevo[p])) k++; p++; }
    try { el.setSelectionRange(p, p); } catch(_){}
  }, true);
}
function aplicarNumConComas(raiz){ (raiz.querySelectorAll ? raiz.querySelectorAll('input[type="number"]') : []).forEach(numConComas); }
aplicarNumConComas(document);
new MutationObserver(ms=> ms.forEach(m=> m.addedNodes.forEach(n=>{
  if(n.nodeType !== 1) return;
  if(n.matches && n.matches('input[type="number"]')) numConComas(n); else aplicarNumConComas(n);
}))).observe(document.documentElement, { childList:true, subtree:true });
