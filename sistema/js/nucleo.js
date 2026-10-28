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
function fmtDinero(n){ return '$' + (Number(n)||0).toLocaleString('es-MX'); }
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
