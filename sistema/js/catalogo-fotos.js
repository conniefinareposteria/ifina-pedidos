// Catálogo (solo directora): fotos de cada producto para la página pública.
// Cada foto se sube dos veces a la carpeta "catalogo" de Supabase:
//   · la original tal cual (respaldo, no se pierde calidad)
//   · una copia para la página: hasta 2400 px por lado, JPG al 92 % (se ve igual y carga rápido)
// La primera foto de cada producto es la principal. Ver sql/020_fotos_catalogo.sql.

const FOTO_LADO_MAX = 2400;
const FOTO_CALIDAD = 0.92;
// Secciones (chips de arriba): una a la vez para no confundir productos que se repiten (ej. tres leches)
const CATALOGO_SECCIONES = [
  { id:'pagina',       titulo:'Página web' },
  { id:'pasteles',     titulo:'Pasteles',     tabla:'sabores_pasteles', filtro: r => !/^cc_/i.test(r.nombre) },
  { id:'cheesecakes',  titulo:'Cheesecakes',  tabla:'sabores_pasteles', filtro: r => /^cc_/i.test(r.nombre) },
  { id:'cupcakes',     titulo:'Cupcakes',     tabla:'sabores_cupcakes', filtro: () => true },
  { id:'cuchareables', titulo:'Cuchareables', tabla:'individuales',     filtro: r => r.nombre !== 'cupcake' },
  { id:'panques',      titulo:'Panqués',      tabla:'panques',          filtro: () => true },
];
// Fotos de la página que no son de un producto
const FOTOS_PAGINA = [
  { producto:'portada',           titulo:'Foto principal (portada)', nota:'La foto grande de hasta arriba. Se usa la principal.' },
  { producto:'visitanos',         titulo:'Visítanos',                nota:'La foto del final de la página, junto a la dirección. Se usa la principal.' },
  { producto:'galeria_decorados', titulo:'Galería de pasteles decorados', nota:'Aparecen todas en la sección Decorados.' },
];
let fotosCatalogo = [];   // renglones de fotos_catalogo
let decoracionesCat = []; // base blanca, corona de color, decorado simple, decorado de evento…
let catSeccion = 'pagina';
let ocultosCatalogo = new Set(); // "tabla|producto" que no se muestran en la página (sql/022)

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
  const [fot, dec, ocu] = await Promise.all([sb.from('fotos_catalogo').select('*').order('orden'), sb.from('decoraciones').select('nombre,orden').order('orden'), sb.from('productos_ocultos').select('tabla,producto')]);
  if(fot.error){ cont.className = 'empty'; cont.textContent = 'No se pudieron cargar las fotos: ' + fot.error.message; return; }
  fotosCatalogo = fot.data || [];
  decoracionesCat = dec.data || [];
  ocultosCatalogo = new Set((ocu.data || []).map(o=> o.tabla + '|' + o.producto));
  pintarCatalogoFotos();
}
function elegirSeccionCatalogo(id){ catSeccion = id; pintarCatalogoFotos(); }
function pintarCatalogoFotos(){
  const cont = document.getElementById('catalogo-contenido');
  cont.className = '';
  const chips = `<div class="chip-group cf-chips">${CATALOGO_SECCIONES.map(x=> `<div class="chip${x.id === catSeccion ? ' selected' : ''}" onclick="elegirSeccionCatalogo('${x.id}')">${x.titulo}</div>`).join('')}</div>`;
  const sec = CATALOGO_SECCIONES.find(x=> x.id === catSeccion) || CATALOGO_SECCIONES[0];
  let cuerpo;
  if(sec.id === 'pagina'){
    cuerpo = FOTOS_PAGINA.map(f=> filaProductoFotos('pagina', f.producto, f.titulo, f.nota)).join('')
      + (decoracionesCat.length ? `<h3 class="cf-sub">Hazlo especial</h3><div class="hint" style="margin:0 0 10px;">Las opciones que se suman al precio del pastel. Se usa la foto principal.</div>`
        + decoracionesCat.map(d=> filaProductoFotos('decoraciones', d.nombre, d.nombre)).join('') : '');
  } else {
    const filas = datosDeTabla(sec.tabla).filter(sec.filtro).slice().sort((a,b)=> formatNombre(a.nombre).localeCompare(formatNombre(b.nombre), 'es'));
    cuerpo = filas.map(r=> filaProductoFotos(sec.tabla, r.nombre, null, null, true)).join('') || '<div class="empty">Sin productos.</div>';
  }
  cont.innerHTML = chips + `<div class="seccion-resumen"><h3>${sec.titulo}</h3>${cuerpo}</div>`;
}
function idFila(tabla, producto){ return 'cf-' + tabla + '-' + claveSabor(producto); }
function filaProductoFotos(tabla, producto, titulo, nota, ocultable){
  const fotos = fotosDe(tabla, producto);
  const oculto = ocultable && ocultosCatalogo.has(tabla + '|' + producto);
  const pArg = escHtml(producto).replace(/'/g, '&#39;');
  const id = idFila(tabla, producto);
  const miniaturas = fotos.map((f, i)=> `<div class="cf-foto${i === 0 ? ' principal' : ''}">
      <img src="${escHtml(f.url)}" alt="" loading="lazy">
      ${i === 0 ? '<span class="cf-tag">Principal</span>' : `<button type="button" class="cf-btn" onclick="hacerPrincipal(${Number(f.id)})">Hacer principal</button>`}
      <button type="button" class="cf-quitar" aria-label="Quitar foto" onclick="quitarFoto(${Number(f.id)})">×</button>
    </div>`).join('');
  return `<div class="cf-producto${oculto ? ' oculto' : ''}" id="${id}">
    <div class="cf-cab"><b>${escHtml(titulo || formatNombre(producto))}</b><span class="hint" style="margin:0;">${fotos.length ? fotos.length + (fotos.length === 1 ? ' foto' : ' fotos') : 'Sin foto'}</span></div>
    ${ocultable ? `<div class="cf-estado"><span>${oculto ? 'No se muestra en la página' : 'Se muestra en la página'}</span>
      <button type="button" class="cf-ocultar" onclick="cambiarOcultoProducto('${tabla}', '${pArg}', ${!oculto})">${oculto ? 'Volver a mostrar' : 'Ocultar en la página'}</button></div>` : ''}
    ${nota ? `<div class="hint" style="margin:-4px 0 10px;">${escHtml(nota)}</div>` : ''}
    <div class="cf-fotos">${miniaturas}
      <label class="cf-agregar">+ agregar foto<input type="file" accept="image/*" multiple hidden onchange="subirFotos(this, '${tabla}', '${pArg}')"></label>
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
  const msg = document.getElementById(idFila(tabla, producto) + '-msg');
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
  const m = document.getElementById(idFila(tabla, producto) + '-msg');
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
// Ocultar / volver a mostrar un producto en la página (no cambia nada en el sistema ni en el punto de venta)
async function cambiarOcultoProducto(tabla, producto, ocultar){
  if(ocultar && !confirm(`¿Ocultar ${formatNombre(producto)} en la página? Se puede volver a mostrar cuando quieras.`)) return;
  const q = ocultar
    ? sb.from('productos_ocultos').insert([{ tabla, producto }])
    : sb.from('productos_ocultos').delete().eq('tabla', tabla).eq('producto', producto);
  const { error } = await q;
  if(error){ alert('No se pudo cambiar: ' + error.message); return; }
  if(ocultar) ocultosCatalogo.add(tabla + '|' + producto); else ocultosCatalogo.delete(tabla + '|' + producto);
  pintarCatalogoFotos();
}
