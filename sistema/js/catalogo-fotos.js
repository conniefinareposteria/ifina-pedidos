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
  const proporcion = proporcionFoto(tabla);
  const miniaturas = fotos.map((f, i)=> `<div class="cf-foto${i === 0 ? ' principal' : ''}" data-id="${Number(f.id)}" style="aspect-ratio:${proporcion};">
      <img src="${escHtml(f.url)}" alt="" loading="lazy" style="${estiloEncuadre(f)}">
      ${proporcion ? `<button type="button" class="cf-enc" onclick="abrirEncuadre(${Number(f.id)})">Encuadrar</button>` : ''}
      ${i === 0 ? '<span class="cf-tag">Principal</span>' : `<button type="button" class="cf-btn" onclick="hacerPrincipal(${Number(f.id)})">Hacer principal</button>`}
      <button type="button" class="cf-quitar" aria-label="Quitar foto" onclick="quitarFoto(${Number(f.id)})">×</button>
    </div>`).join('');
  return `<div class="cf-producto${oculto ? ' oculto' : ''}" id="${id}">
    <div class="cf-cab"><b>${escHtml(titulo || formatNombre(producto))}</b><span class="hint" style="margin:0;">${fotos.length ? fotos.length + (fotos.length === 1 ? ' foto' : ' fotos') : 'Sin foto'}</span></div>
    ${ocultable ? `<div class="cf-estado"><span>${oculto ? 'No se muestra en la página' : 'Se muestra en la página'}</span>
      <button type="button" class="cf-ocultar" onclick="cambiarOcultoProducto('${tabla}', '${pArg}', ${!oculto})">${oculto ? 'Volver a mostrar' : 'Ocultar en la página'}</button></div>` : ''}
    ${nota ? `<div class="hint" style="margin:-4px 0 10px;">${escHtml(nota)}</div>` : ''}
    ${fotos.length > 1 ? '<div class="hint" style="margin:0 0 8px;">Para cambiar el orden, deja presionada una foto y arrástrala. La de la izquierda es la principal.</div>' : ''}
    <div class="cf-fotos">${miniaturas}
      <label class="cf-agregar">+ agregar foto<input type="file" accept="image/*" multiple hidden onchange="subirFotos(this, '${tabla}', '${pArg}')"></label>
    </div>
    ${ocultable ? detalleProductoHtml(tabla, producto, id) : ''}
    <div class="msg" id="${id}-msg"></div>
  </div>`;
}
// ---------- De qué está hecho + incluye corona (sql/023) ----------
function filaCatalogo(tabla, producto){ return datosDeTabla(tabla).find(r=> r.nombre === producto) || {}; }
function detalleProductoHtml(tabla, producto, id){
  const r = filaCatalogo(tabla, producto);
  const campo = (k, label, ph) => `<div class="field"><label>${label}</label><input type="text" id="${id}-${k}" value="${escHtml(r[k] || '')}" placeholder="${ph}"></div>`;
  const corona = tabla === 'sabores_pasteles' ? `<div class="field"><label>Incluye corona</label>
      <div class="chip-group" id="${id}-corona">
        <div class="chip${r.incluye_corona ? ' selected' : ''}" data-v="si" onclick="elegirCoronaCatalogo('${id}','si')">Sí</div>
        <div class="chip${r.incluye_corona ? '' : ' selected'}" data-v="no" onclick="elegirCoronaCatalogo('${id}','no')">No</div>
      </div><div class="hint" style="margin:6px 0 0;">Aplica en todo el sistema: punto de venta, nuevo pedido y página.</div></div>` : '';
  const esCheese = tabla === 'sabores_pasteles' && /^cc_/i.test(producto);
  // Cheesecakes: Base / Betún / Por encima. Pasteles: Pan / Relleno / Por encima / Por debajo / Algo más. Panqués: solo Pan y Betún. Los demás: Pan / Relleno / Betún / Algo más.
  const campos = esCheese
    ? `<div class="row3">${campo('pan','Base','Ej. cheesecake')}${campo('betun','Betún','Ej. mermelada')}${campo('descripcion','Por encima','Ej. frutos rojos')}</div>`
    : tabla === 'panques'
    ? `<div class="row2">${campo('pan','Pan','Ej. plátano')}${campo('betun','Betún','Ej. glaseado')}</div>`
    : tabla === 'sabores_pasteles'
    ? (()=>{ const doble = !!r.betun_abajo;   // "Doble betún" (Bi Cajeta, Bi Chocolate…): por encima y por debajo
      const opciones = Array.isArray(r.relleno_opciones) ? r.relleno_opciones : [];
      const elige = opciones.length >= 2;      // "Relleno a elegir" (ej. Vintage: mermelada de fresa o cajeta)
      const filaOpc = v => `<div class="cf-opc"><input type="text" class="ropc" value="${escHtml(v)}" placeholder="Ej. cajeta"><button type="button" aria-label="Quitar opción" onclick="this.parentElement.remove()">×</button></div>`;
      return `<div class="row2">${campo('pan','Pan','Ej. vainilla')}<div class="field" id="${id}-relleno-wrap" style="${elige ? 'display:none;' : ''}"><label>Relleno</label><input type="text" id="${id}-relleno" value="${escHtml(r.relleno || '')}" placeholder="Ej. cajeta"></div></div>
    <div class="field"><label>¿El cliente elige el relleno?</label><div class="chip-group" id="${id}-elige">
      <div class="chip${elige ? ' selected' : ''}" data-v="si" onclick="elegirRellenoOpc('${id}','si')">Sí</div>
      <div class="chip${elige ? '' : ' selected'}" data-v="no" onclick="elegirRellenoOpc('${id}','no')">No</div></div></div>
    <div class="field" id="${id}-opc-wrap" style="${elige ? '' : 'display:none;'}"><label>Opciones de relleno</label>
      <div id="${id}-opc">${(elige ? opciones : ['', '']).map(filaOpc).join('')}</div>
      <button type="button" class="link-accion" style="margin:4px 0 0; background:none; border:none; cursor:pointer;" onclick="agregarOpcionRelleno('${id}')">+ agregar opción</button></div>
    <div class="field"><label>Doble betún</label><div class="chip-group" id="${id}-doble">
      <div class="chip${doble ? ' selected' : ''}" data-v="si" onclick="elegirDobleBetun('${id}','si')">Sí</div>
      <div class="chip${doble ? '' : ' selected'}" data-v="no" onclick="elegirDobleBetun('${id}','no')">No</div></div></div>
    <div class="row2"><div class="field"><label id="${id}-betun-lbl">${doble ? 'Por encima' : 'Betún'}</label><input type="text" id="${id}-betun" value="${escHtml(r.betun || '')}" placeholder="Ej. merengue"></div>
      <div class="field" id="${id}-abajo-wrap" style="${doble ? '' : 'display:none;'}"><label>Por debajo</label><input type="text" id="${id}-betun_abajo" value="${escHtml(r.betun_abajo || '')}" placeholder="Ej. cajeta"></div></div>
    ${campo('descripcion','Algo más (opcional)','Ej. con nuez')}`; })()
    : `<div class="row3">${campo('pan','Pan','Ej. vainilla')}${campo('relleno','Relleno','Ej. cajeta')}${campo('betun','Betún','Ej. merengue')}</div>
    ${campo('descripcion','Algo más (opcional)','Ej. con nuez')}`;
  return `<div class="cf-detalle">
    ${campos}
    ${corona}
    <button type="button" class="cf-guardar" onclick="guardarDetalleProducto('${tabla}', '${escHtml(producto).replace(/'/g, '&#39;')}')">Guardar</button>
  </div>`;
}
function elegirRellenoOpc(id, v){
  document.querySelectorAll('#' + id + '-elige .chip').forEach(c=> c.classList.toggle('selected', c.dataset.v === v));
  document.getElementById(id + '-opc-wrap').style.display = v === 'si' ? '' : 'none';
  document.getElementById(id + '-relleno-wrap').style.display = v === 'si' ? 'none' : '';
}
function agregarOpcionRelleno(id){
  const d = document.createElement('div'); d.className = 'cf-opc';
  d.innerHTML = '<input type="text" class="ropc" placeholder="Ej. cajeta"><button type="button" aria-label="Quitar opción" onclick="this.parentElement.remove()">×</button>';
  document.getElementById(id + '-opc').appendChild(d);
  d.querySelector('input').focus();
}
function elegirDobleBetun(id, v){
  document.querySelectorAll('#' + id + '-doble .chip').forEach(c=> c.classList.toggle('selected', c.dataset.v === v));
  document.getElementById(id + '-abajo-wrap').style.display = v === 'si' ? '' : 'none';
  document.getElementById(id + '-betun-lbl').textContent = v === 'si' ? 'Por encima' : 'Betún';
}
function elegirCoronaCatalogo(id, v){
  document.querySelectorAll('#' + id + '-corona .chip').forEach(c=> c.classList.toggle('selected', c.dataset.v === v));
}
async function guardarDetalleProducto(tabla, producto){
  const id = idFila(tabla, producto);
  const actual = filaCatalogo(tabla, producto);
  // Campos que no se muestran (ej. Relleno en panqués) conservan lo que ya tenían
  const val = k => { const el = document.getElementById(id + '-' + k); return el ? el.value.trim() : (actual[k] || ''); };
  const msg = document.getElementById(id + '-msg');
  const sel = document.querySelector('#' + id + '-corona .chip.selected');
  const incluye = tabla === 'sabores_pasteles' && sel ? sel.dataset.v === 'si' : null;
  const datos = { pan: val('pan'), relleno: val('relleno'), betun: val('betun'), descripcion: val('descripcion') };
  if(tabla === 'sabores_pasteles'){
    const doble = document.querySelector('#' + id + '-doble .chip.selected');
    datos.betun_abajo = doble && doble.dataset.v === 'si' ? val('betun_abajo') : '';
    const elige = document.querySelector('#' + id + '-elige .chip.selected');
    if(elige){
      if(elige.dataset.v === 'si'){
        const opc = [...document.querySelectorAll('#' + id + '-opc .ropc')].map(x=> x.value.trim()).filter(Boolean);
        if(opc.length < 2){ msg.className = 'msg err'; msg.textContent = 'Escribe al menos dos opciones de relleno (o marca No).'; return; }
        datos.relleno_opciones = opc;
      } else datos.relleno_opciones = null;
    }
  }
  msg.className = 'msg ok'; msg.textContent = 'Guardando...';
  const { error } = await sb.rpc('catalogo_guardar_producto', { p_tabla: tabla, p_nombre: producto, p_pan: datos.pan, p_relleno: datos.relleno, p_betun: datos.betun, p_descripcion: datos.descripcion, p_incluye_corona: incluye, ...(tabla === 'sabores_pasteles' ? { p_betun_abajo: datos.betun_abajo, ...('relleno_opciones' in datos ? { p_relleno_opciones: datos.relleno_opciones } : {}) } : {}) });
  if(error){ msg.className = 'msg err'; msg.textContent = 'No se pudo guardar: ' + error.message + ' (revisa que ya se haya corrido el SQL del catálogo).'; return; }
  // Se actualiza también en memoria para que punto de venta y nuevo pedido usen el cambio sin recargar
  const r = filaCatalogo(tabla, producto);
  Object.keys(datos).forEach(k=> r[k] = datos[k] || null);
  if(incluye !== null) r.incluye_corona = incluye;
  msg.className = 'msg ok'; msg.textContent = 'Guardado. Ya aparece así en la página.';
}

// ---------- Reordenar fotos: dejar presionada y arrastrar ----------
let cfArrastre = null;
document.addEventListener('pointerdown', e=>{
  const foto = e.target.closest && e.target.closest('#view-catalogo .cf-foto');
  if(!foto || e.target.closest('button')) return;
  const inicio = { x:e.clientX, y:e.clientY };
  const timer = setTimeout(()=>{
    cfArrastre = { foto, cont: foto.parentElement, x0: inicio.x, y0: inicio.y };
    foto.classList.add('arrastrando');
    if(navigator.vibrate) try{ navigator.vibrate(15); }catch(_){}
  }, 350);
  const mover = ev=>{
    if(!cfArrastre){ if(Math.abs(ev.clientX - inicio.x) > 8 || Math.abs(ev.clientY - inicio.y) > 8) soltar(); return; }
    const a = cfArrastre;
    a.foto.style.transform = `translate(${ev.clientX - a.x0}px, ${ev.clientY - a.y0}px)`;
    a.foto.style.pointerEvents = 'none';
    const bajo = document.elementFromPoint(ev.clientX, ev.clientY);
    const otra = bajo && bajo.closest('.cf-foto');
    if(otra && otra !== a.foto && otra.parentElement === a.cont){
      const lista = [...a.cont.querySelectorAll('.cf-foto')];
      const antes = lista.indexOf(otra) < lista.indexOf(a.foto);
      const r0 = a.foto.getBoundingClientRect();
      a.cont.insertBefore(a.foto, antes ? otra : otra.nextSibling);
      const r1 = a.foto.getBoundingClientRect();
      a.x0 += r1.left - r0.left; a.y0 += r1.top - r0.top;   // la foto sigue bajo el dedo
      a.foto.style.transform = `translate(${ev.clientX - a.x0}px, ${ev.clientY - a.y0}px)`;
    }
  };
  const soltar = ()=>{
    clearTimeout(timer);
    document.removeEventListener('pointermove', mover);
    document.removeEventListener('pointerup', soltar);
    document.removeEventListener('pointercancel', soltar);
    if(!cfArrastre) return;
    const a = cfArrastre; cfArrastre = null;
    a.foto.classList.remove('arrastrando'); a.foto.style.transform = ''; a.foto.style.pointerEvents = '';
    guardarOrdenFotos([...a.cont.querySelectorAll('.cf-foto')].map(x=> Number(x.dataset.id)));
  };
  document.addEventListener('pointermove', mover);
  document.addEventListener('pointerup', soltar);
  document.addEventListener('pointercancel', soltar);
});
// Mientras se arrastra, que la pantalla no se desplace
document.addEventListener('touchmove', e=>{ if(cfArrastre) e.preventDefault(); }, { passive:false });
document.addEventListener('contextmenu', e=>{ if(e.target.closest && e.target.closest('#view-catalogo .cf-foto')) e.preventDefault(); });
async function guardarOrdenFotos(ids){
  const cambios = ids.map((id, i)=> ({ f: fotosCatalogo.find(x=> x.id === id), orden: i })).filter(x=> x.f && x.f.orden !== x.orden);
  if(!cambios.length){ pintarCatalogoFotos(); return; }
  const res = await Promise.all(cambios.map(x=> sb.from('fotos_catalogo').update({ orden: x.orden }).eq('id', x.f.id)));
  const err = res.find(x=> x.error);
  if(err){ alert('No se pudo guardar el orden: ' + err.error.message); }
  else cambios.forEach(x=> x.f.orden = x.orden);
  pintarCatalogoFotos();
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

// ---------- Encuadrar: mover y acercar la foto dentro del recuadro de la tarjeta (sql/026) ----------
// Mismo recuadro que en la página: pasteles y cheesecakes 4:5, cupcakes/cuchareables/panqués 3:4.
function proporcionFoto(tabla){ return tabla === 'sabores_pasteles' ? '4/5' : ['sabores_cupcakes','individuales','panques'].includes(tabla) ? '3/4' : ''; }
function estiloEncuadre(f){
  const x = f.pos_x ?? 50, y = f.pos_y ?? 50, z = f.zoom ?? 1;
  return `object-position:${x}% ${y}%;transform:scale(${z});transform-origin:${x}% ${y}%;`;
}
let encFoto = null, encX = 50, encY = 50, encZ = 1;
function abrirEncuadre(id){
  const f = fotosCatalogo.find(x=> x.id === id); if(!f) return;
  encFoto = f; encX = f.pos_x ?? 50; encY = f.pos_y ?? 50; encZ = f.zoom ?? 1;
  document.getElementById('enc-marco').style.aspectRatio = proporcionFoto(f.tabla);
  document.getElementById('enc-img').src = f.url;
  document.getElementById('enc-zoom').value = encZ;
  document.getElementById('enc-msg').className = 'msg';
  pintarEncuadre();
  abrirModal('enc');
}
function pintarEncuadre(){ document.getElementById('enc-img').setAttribute('style', estiloEncuadre({ pos_x:encX, pos_y:encY, zoom:encZ })); }
function restablecerEncuadre(){ encX = 50; encY = 50; encZ = 1; document.getElementById('enc-zoom').value = 1; pintarEncuadre(); }
document.getElementById('enc-zoom').addEventListener('input', e=>{ encZ = Number(e.target.value) || 1; pintarEncuadre(); });
(function(){
  const marco = document.getElementById('enc-marco');
  let ult = null;
  marco.addEventListener('pointerdown', e=>{ ult = { x:e.clientX, y:e.clientY }; marco.setPointerCapture(e.pointerId); e.preventDefault(); });
  marco.addEventListener('pointermove', e=>{
    if(!ult) return;
    const img = document.getElementById('enc-img');
    const fw = marco.clientWidth, fh = marco.clientHeight, iw = img.naturalWidth || fw, ih = img.naturalHeight || fh;
    const s0 = Math.max(fw / iw, fh / ih);
    const ox = iw * s0 - fw, oy = ih * s0 - fh;          // lo que sobra de la foto a los lados / arriba y abajo
    const rx = encZ * ox + (encZ - 1) * fw, ry = encZ * oy + (encZ - 1) * fh;
    if(rx > 0.5) encX = Math.min(100, Math.max(0, encX - (e.clientX - ult.x) * 100 / rx));
    if(ry > 0.5) encY = Math.min(100, Math.max(0, encY - (e.clientY - ult.y) * 100 / ry));
    ult = { x:e.clientX, y:e.clientY };
    pintarEncuadre();
  });
  const fin = ()=>{ ult = null; };
  marco.addEventListener('pointerup', fin); marco.addEventListener('pointercancel', fin);
})();
async function guardarEncuadre(){
  const f = encFoto; if(!f) return;
  const msg = document.getElementById('enc-msg'); msg.className = 'msg';
  const datos = { pos_x: Math.round(encX * 10) / 10, pos_y: Math.round(encY * 10) / 10, zoom: Math.round(encZ * 100) / 100 };
  const btn = document.getElementById('enc-guardar'); btn.disabled = true;
  const { error } = await sb.from('fotos_catalogo').update(datos).eq('id', f.id);
  btn.disabled = false;
  if(error){ msg.className = 'msg err'; msg.textContent = 'No se pudo guardar: ' + error.message + ' (revisa que ya se haya corrido el SQL del encuadre).'; return; }
  Object.assign(f, datos);
  cerrarModal('enc');
  pintarCatalogoFotos();
}
