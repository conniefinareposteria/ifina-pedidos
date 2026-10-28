// Catálogo (solo directora): fotos de cada producto para la página pública.
// Cada foto se sube dos veces a la carpeta "catalogo" de Supabase:
//   · la original tal cual (respaldo, no se pierde calidad)
//   · una copia para la página: hasta 2400 px por lado, JPG al 92 % (se ve igual y carga rápido)
// La primera foto de cada producto es la principal. Ver sql/020_fotos_catalogo.sql.

const FOTO_LADO_MAX = 2400;
const FOTO_CALIDAD = 0.92;
// Grupos que se muestran: tabla de Supabase, título y qué renglones entran
const CATALOGO_GRUPOS = [
  { tabla:'sabores_pasteles', titulo:'Pasteles',     filtro: r => !/^cc_/i.test(r.nombre) },
  { tabla:'sabores_pasteles', titulo:'Cheesecakes',  filtro: r => /^cc_/i.test(r.nombre) },
  { tabla:'sabores_cupcakes', titulo:'Cupcakes',     filtro: () => true },
  { tabla:'individuales',     titulo:'Cuchareables', filtro: r => r.nombre !== 'cupcake' },
  { tabla:'panques',          titulo:'Panqués',      filtro: () => true },
];
let fotosCatalogo = [];   // renglones de fotos_catalogo

function abrirCatalogo(){
  activarVistaDirectora('tab-catalogo', 'view-catalogo');
  cargarCatalogoFotos();
}
function datosDeTabla(tabla){
  return { sabores_pasteles: saboresPastelesData, sabores_cupcakes: saboresCupcakesData, individuales: individualesData, panques: panquesData }[tabla] || [];
}
function fotosDe(tabla, producto){
  return fotosCatalogo.filter(f=> f.tabla === tabla && f.producto === producto).sort((a,b)=> a.orden - b.orden || a.id - b.id);
}
async function cargarCatalogoFotos(){
  const cont = document.getElementById('catalogo-contenido');
  cont.className = 'loading'; cont.textContent = 'Cargando...';
  if(catalogosListos) await catalogosListos;
  const { data, error } = await sb.from('fotos_catalogo').select('*').order('orden');
  if(error){ cont.className = 'empty'; cont.textContent = 'No se pudieron cargar las fotos: ' + error.message + ' (revisa que ya se haya corrido el SQL de fotos).'; return; }
  fotosCatalogo = data || [];
  pintarCatalogoFotos();
}
function pintarCatalogoFotos(){
  const cont = document.getElementById('catalogo-contenido');
  cont.className = '';
  cont.innerHTML = CATALOGO_GRUPOS.map(g=>{
    const filas = datosDeTabla(g.tabla).filter(g.filtro).slice().sort((a,b)=> formatNombre(a.nombre).localeCompare(formatNombre(b.nombre), 'es'));
    if(!filas.length) return '';
    return `<div class="seccion-resumen"><h3>${g.titulo}</h3>${filas.map(r=> filaProductoFotos(g.tabla, r.nombre)).join('')}</div>`;
  }).join('');
}
function filaProductoFotos(tabla, producto){
  const fotos = fotosDe(tabla, producto);
  const id = 'cf-' + tabla + '-' + claveSabor(producto);
  const miniaturas = fotos.map((f, i)=> `<div class="cf-foto${i === 0 ? ' principal' : ''}">
      <img src="${escHtml(f.url)}" alt="" loading="lazy">
      ${i === 0 ? '<span class="cf-tag">Principal</span>' : `<button type="button" class="cf-btn" onclick="hacerPrincipal(${Number(f.id)})">Hacer principal</button>`}
      <button type="button" class="cf-quitar" aria-label="Quitar foto" onclick="quitarFoto(${Number(f.id)})">×</button>
    </div>`).join('');
  return `<div class="cf-producto" id="${id}">
    <div class="cf-cab"><b>${escHtml(formatNombre(producto))}</b><span class="hint" style="margin:0;">${fotos.length ? fotos.length + (fotos.length === 1 ? ' foto' : ' fotos') : 'Sin foto'}</span></div>
    <div class="cf-fotos">${miniaturas}
      <label class="cf-agregar">+ agregar foto<input type="file" accept="image/*" multiple hidden onchange="subirFotos(this, '${tabla}', '${escHtml(producto).replace(/'/g, '&#39;')}')"></label>
    </div>
    <div class="msg" id="${id}-msg"></div>
  </div>`;
}

// Copia para la página: respeta la orientación de la foto y reduce solo si pasa de 2400 px
async function copiaParaPagina(archivo){
  const bmp = await createImageBitmap(archivo, { imageOrientation:'from-image' });
  const escala = Math.min(1, FOTO_LADO_MAX / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * escala), h = Math.round(bmp.height * escala);
  const canvas = document.createElement('canvas'); canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close && bmp.close();
  return await new Promise((ok, mal)=> canvas.toBlob(b=> b ? ok(b) : mal(new Error('No se pudo preparar la foto')), 'image/jpeg', FOTO_CALIDAD));
}
async function subirFotos(input, tabla, producto){
  const archivos = [...input.files]; input.value = '';
  if(!archivos.length) return;
  const msg = document.getElementById('cf-' + tabla + '-' + claveSabor(producto) + '-msg');
  const base = tabla + '/' + claveSabor(producto) + '/';
  let orden = Math.max(0, ...fotosDe(tabla, producto).map(f=> f.orden + 1));
  let hechas = 0;
  for(const archivo of archivos){
    msg.className = 'msg ok'; msg.textContent = `Subiendo foto ${hechas + 1} de ${archivos.length}...`;
    try {
      const nombre = Date.now() + '-' + Math.random().toString(36).slice(2, 7);
      const ext = ((archivo.name || '').split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
      const rutaOriginal = base + nombre + '-original.' + ext;
      const ruta = base + nombre + '.jpg';
      const web = await copiaParaPagina(archivo);
      const almacen = sb.storage.from('catalogo');
      const r1 = await almacen.upload(rutaOriginal, archivo, { contentType: archivo.type || 'image/jpeg', upsert:false });
      if(r1.error) throw r1.error;
      const r2 = await almacen.upload(ruta, web, { contentType:'image/jpeg', upsert:false, cacheControl:'31536000' });
      if(r2.error) throw r2.error;
      const fila = { tabla, producto, orden: orden++, ruta, url: almacen.getPublicUrl(ruta).data.publicUrl,
        ruta_original: rutaOriginal, url_original: almacen.getPublicUrl(rutaOriginal).data.publicUrl };
      const { data, error } = await sb.from('fotos_catalogo').insert([fila]).select().single();
      if(error) throw error;
      fotosCatalogo.push(data);
      hechas++;
    } catch(e){
      msg.className = 'msg err'; msg.textContent = 'No se pudo subir una foto: ' + (e.message || e) + '. Las anteriores sí se guardaron.';
      break;
    }
  }
  pintarCatalogoFotos();
  const m = document.getElementById('cf-' + tabla + '-' + claveSabor(producto) + '-msg');
  if(hechas === archivos.length){ m.className = 'msg ok'; m.textContent = hechas === 1 ? 'Foto guardada. Ya aparece en la página.' : `${hechas} fotos guardadas. Ya aparecen en la página.`; }
}
async function hacerPrincipal(id){
  const f = fotosCatalogo.find(x=> x.id === id); if(!f) return;
  const nuevo = Math.min(...fotosDe(f.tabla, f.producto).map(x=> x.orden)) - 1;
  const { error } = await sb.from('fotos_catalogo').update({ orden: nuevo }).eq('id', id);
  if(error){ alert('No se pudo cambiar: ' + error.message); return; }
  f.orden = nuevo;
  pintarCatalogoFotos();
}
async function quitarFoto(id){
  const f = fotosCatalogo.find(x=> x.id === id); if(!f) return;
  if(!confirm(`¿Quitar esta foto de ${formatNombre(f.producto)}? Ya no se verá en la página.`)) return;
  const { error } = await sb.from('fotos_catalogo').delete().eq('id', id);
  if(error){ alert('No se pudo quitar: ' + error.message); return; }
  await sb.storage.from('catalogo').remove([f.ruta, f.ruta_original].filter(Boolean));
  fotosCatalogo = fotosCatalogo.filter(x=> x.id !== id);
  pintarCatalogoFotos();
}
