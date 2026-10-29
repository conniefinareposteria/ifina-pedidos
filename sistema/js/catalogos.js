// Catálogos: precios y productos (se leen de Supabase), listas fijas de sabores y coronas.

// Nombre sin acentos, guiones ni espacios, y sin prefijos (cc, cheesecake, cuchareable) para comparar
function claveNombre(t){
  const ignorar = ['de','del','la','el','los','las','y','cc','cheesecake','cuchareable','individual','cupcake','panque'];
  return (t||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .split(/[^a-z0-9]+/).filter(w => w && !ignorar.includes(w)).map(w => w.length > 3 ? w.replace(/s$/, '') : w).join('');
}
// Convierte un nombre viejo del historial al nombre actual del catálogo (o null si ya no existe)
function nombreActual(n, lista){
  const k = claveNombre(n); if(!k) return null;
  return lista.find(x => claveNombre(x) === k) || lista.find(x => { const c = claveNombre(x); return c && (c.includes(k) || k.includes(c)); }) || null;
}
async function cargarCatalogos(){
  try{
    const [t, sp, sc, ind, cor, pan] = await Promise.all([
      sb.from('tamanos_pastel').select('*').order('precio'),
      sb.from('sabores_pasteles').select('*').order('nombre'),
      sb.from('sabores_cupcakes').select('*').order('nombre'),
      sb.from('individuales').select('*').order('nombre'),
      sb.from('coronas').select('*'),
      sb.from('panques').select('*').order('nombre')
    ]);
    coronasData = cor.data || [];
    panquesData = pan.data || [];
    PANQUE_PRODUCTOS = panquesData.map(r=>formatNombre(r.nombre));
    if(pan.error) mostrarDebug('No se pudo cargar el catálogo de panqués: ' + pan.error.message);

    if(cor.error) mostrarDebug('No se pudo cargar el catálogo de coronas: ' + cor.error.message);
    const errores = [t.error, sp.error, sc.error, ind.error].filter(Boolean);
    if(errores.length){
      mostrarDebug('Error al cargar catálogos: ' + errores.map(e=>e.message).join(' | '));
      return;
    }

    tamanosData = t.data || [];
    saboresPastelesData = sp.data || [];
    saboresCupcakesData = sc.data || [];
    individualesData = ind.data || [];
    // La lista de individuales de Productos del día sale del catálogo de Supabase
    INDIVIDUAL_PRODUCTOS = individualesData.filter(r=>r.nombre!=='cupcake').map(r=>formatNombre(r.nombre));

    if(tamanosData.length===0 && saboresPastelesData.length===0){
      mostrarDebug('Conexión OK pero las tablas regresaron vacías. Revisa que las políticas RLS se hayan creado.');
    }
  } catch(ex){
    mostrarDebug('Excepción al conectar con Supabase: ' + ex.message);
    return;
  }

  const selTamano = document.getElementById('sel-tamano');
  // Orden fijo de tamaños; los que no estén en la lista van al final
  const ORDEN_TAMANOS = ['cheesecake','tresleches','mini','chico','mediano','grande','extragrande','plancha50','plancha60'];
  const claveTam = s => (s||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/g,'');
  const posTam = s => { const i = ORDEN_TAMANOS.indexOf(claveTam(s)); return i === -1 ? 999 : i; };
  [...tamanosData].sort((a,b)=> posTam(a.tamano) - posTam(b.tamano)).forEach(row=>{
    const opt = document.createElement('option');
    opt.value = row.tamano;
    opt.textContent = etiquetaTamano(row.tamano);
    opt.dataset.precio = row.precio;
    selTamano.appendChild(opt);
  });

  const cupcakePrecio = (individualesData.find(r=>r.nombre==='cupcake')||{}).precio || 0;
  const ordenCup = n => { const i = (typeof CUPCAKE_SABORES !== 'undefined' ? CUPCAKE_SABORES : []).findIndex(x => claveNombre(x) === claveNombre(n)); return i < 0 ? 999 : i; };
  carritos['cart-cupcake'].items = saboresCupcakesData.slice().sort((a,b)=> ordenCup(a.nombre) - ordenCup(b.nombre) || (a.nombre||'').localeCompare(b.nombre||'')).map(r=>({nombre:r.nombre, precio:cupcakePrecio}));
  carritos['cart-individual'].items = individualesData.filter(r=>r.nombre!=='cupcake').map(r=>({nombre:r.nombre, precio:r.precio}));
  carritos['cart-panque'].items = panquesData.map(r=>({nombre:r.nombre, precio:r.precio}));
}
function precioCorona(tipo, tamano){
  const c = coronasData.find(r => (r.tipo||'').toLowerCase() === tipo && (r.tamano||'').toLowerCase() === tamano);
  return c ? Number(c.precio)||0 : 0;
}
function textoCorona(p){
  if(!p || !p.corona_tipo) return '';
  if(p.corona_tipo === 'incluida') return 'Corona incluida';
  const tam = p.corona_tamano === 'mini' ? ' mini' : '';
  if(p.corona_tipo === 'ambar') return `Corona ámbar${tam}`;
  if(p.corona_tipo === 'color') return `Corona de color${tam}${p.corona_color ? ' (' + p.corona_color + ')' : ''}`;
  return '';
}
// Orden oficial de los cupcakes (los tres últimos ya no se hacen seguido, van hasta abajo)
const CUPCAKE_SABORES = ["Limón","Pistache","Bi-cajeta","Cajeta","White velvet","Especial","Bi-especial","Coco","Caramelo","Chocolate","Choco phila","Zanahoria","Plátano","Choco cajeta","Choco caramelo"];
const PASTEL_SABORES = ["White velvet","Bi-cajeta","Bi-especial","Bi-chocolate","Pistache","Limón","Marmoleado","Vintage","Chocolate","Caramelo","Cajeta","Especial","Rayado","Zanahoria","Coco","Cheesecakes"];
const CORONA_TIPOS = ['Mini','Normal'];
function buscarPrecioIndividualCatalogo(nombreMostrado){
  // Convierte un nombre a sus palabras clave: sin acentos, sin "de/del/la",
  // sin prefijos (cc, cheesecake, cuchareable, individual) y sin plural.
  // Así "Carlota de limón" y "carlota_limon" quedan iguales,
  // y "CC fruto rojos" empata con "cuchareable_frutos_rojos".
  const ignorar = ['de','del','la','el','los','las','y','cc','cheesecake','cuchareable','individual'];
  const clave = s => (s||'').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
    .split(/[^a-z0-9]+/)
    .filter(w => w && !ignorar.includes(w))
    .map(w => w.length > 3 ? w.replace(/s$/, '') : w)
    .join('');
  const exacto = individualesData.find(r => formatNombre(r.nombre) === nombreMostrado);
  if(exacto) return exacto.precio;
  const objetivo = clave(nombreMostrado);
  if(!objetivo) return null;
  let match = individualesData.find(r => clave(r.nombre) === objetivo);
  if(!match){
    match = individualesData.find(r=>{
      const n = clave(r.nombre);
      return n && (n.includes(objetivo) || objetivo.includes(n));
    });
  }
  return match ? match.precio : null;
}
// ---------- Punto de venta (colaborador) ----------
const POS_CATS = {
  cupcakes:     { titulo:'Cupcakes',     tipo:'cupcake' },
  individuales: { titulo:'Cuchareables', tipo:'individual' },
  panques:      { titulo:'Panqués',      tipo:'panque' },
  pasteles:     { titulo:'Pasteles',     tipo:'pastel' },
  coronas:      { titulo:'Coronas',      tipo:'corona' }
};
function posPrecio(cat, nombre, tam){
  if(cat === 'cupcakes') return (individualesData.find(r=>r.nombre==='cupcake')||{}).precio ?? null;
  if(cat === 'individuales') return buscarPrecioIndividualCatalogo(nombre);
  if(cat === 'panques'){ const r = panquesData.find(x=>formatNombre(x.nombre) === nombre); return r ? r.precio : null; }
  if(cat === 'pasteles'){ const r = tamanosData.find(x=>x.tamano === tam); return r ? r.precio : null; }
  return null;
}
function posItemsCat(cat){
  if(cat === 'coronas') return CORONA_TIPOS;
  if(cat === 'cupcakes') return CUPCAKE_SABORES;
  if(cat === 'individuales') return INDIVIDUAL_PRODUCTOS;
  if(cat === 'panques') return PANQUE_PRODUCTOS;
  return PASTEL_SABORES;
}
// ---------- Coronas en el punto de venta ----------
// "Mini - 8 personas": las personas salen de Supabase (tamanos_pastel.personas)
function etiquetaTamano(tam){
  const r = tamanosData.find(x=> (x.tamano||'').toLowerCase() === (tam||'').toLowerCase());
  return formatNombre(tam) + (r && r.personas ? ' - ' + r.personas + ' personas' : '');
}
function claveSabor(t){ return (t||'').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g,'').replace(/[^a-z0-9]/g,''); }
function saborTraeCorona(nombre){
  const s = saboresPastelesData.find(x => claveSabor(x.nombre) === claveSabor(nombre));
  return !!(s && s.incluye_corona);
}

// El pedido se recoge en el local (no es domicilio ni recoger en casa)
function esEntregaLocal(p){ return !p.entrega || p.entrega === 'recoger' || p.entrega === 'local'; }
