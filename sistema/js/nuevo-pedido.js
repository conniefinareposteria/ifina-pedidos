// Nuevo pedido (agendar): carrito, corona, decorado, cliente, dirección, pago y guardado.

let carritos = {
  'cart-cupcake': { items: [], qtys: {} },
  'cart-individual': { items: [], qtys: {} },
  'cart-panque': { items: [], qtys: {} }
};
function renderCarrito(containerId){
  const carrito = carritos[containerId];
  const cont = document.getElementById(containerId);
  cont.innerHTML = '';
  carrito.items.forEach(item=>{
    if(!(item.nombre in carrito.qtys)) carrito.qtys[item.nombre] = 0;
    const row = document.createElement('div');
    row.className = 'cart-row';
    row.innerHTML = `
      <div class="cart-row-name">${formatNombre(item.nombre)}</div>
      <div class="qty-stepper">
        <button type="button" onclick="cambiarQty('${containerId}','${item.nombre}',-1)">−</button>
        <span id="qty-${containerId}-${item.nombre}">${carrito.qtys[item.nombre]}</span>
        <button type="button" onclick="cambiarQty('${containerId}','${item.nombre}',1)">+</button>
      </div>`;
    cont.appendChild(row);
  });
  const totalDiv = document.createElement('div');
  totalDiv.className = 'cart-total';
  totalDiv.id = containerId + '-total-line';
  cont.appendChild(totalDiv);
  actualizarTotalCarrito(containerId);
}
function cambiarQty(containerId, nombre, delta){
  const carrito = carritos[containerId];
  carrito.qtys[nombre] = Math.max(0, (carrito.qtys[nombre]||0) + delta);
  document.getElementById(`qty-${containerId}-${nombre}`).textContent = carrito.qtys[nombre];
  actualizarTotalCarrito(containerId);
}
function actualizarTotalCarrito(containerId){
  const carrito = carritos[containerId];
  let piezas = 0, total = 0;
  carrito.items.forEach(item=>{
    const q = carrito.qtys[item.nombre] || 0;
    piezas += q;
    total += q * item.precio;
  });
  const totalLine = document.getElementById(containerId + '-total-line');
  if(totalLine) totalLine.textContent = piezas > 0 ? `${piezas} piezas — $${total}` : 'Agrega cantidades arriba';
  document.getElementById('precio').value = total || '';
}
// ---------- Coronas ----------
let coronaQuiere = null;   // 'si' | 'no'
let coronaTipo = null;     // 'ambar' | 'color'

function coronaTamanoActual(){
  return (document.getElementById('sel-tamano').value || '').toLowerCase() === 'mini' ? 'mini' : 'normal';
}
function saborIncluyeCorona(){
  const sabor = document.getElementById('sel-sabor-pastel').value;
  const s = saboresPastelesData.find(x=>x.nombre === sabor);
  return !!(s && s.incluye_corona);
}
function precioBasePastel(){
  const opt = document.getElementById('sel-tamano').selectedOptions[0];
  return opt && opt.dataset.precio ? Number(opt.dataset.precio) : 0;
}
let decoradoActual = 'no';
function recalcularPrecioPastel(){
  if(categoriaActual !== 'pastel') return;
  const base = precioBasePastel();
  let extra = 0;
  if(!saborIncluyeCorona() && coronaQuiere === 'si' && coronaTipo) extra = precioCorona(coronaTipo, coronaTamanoActual());
  const hint = document.getElementById('precio-hint');
  if(decoradoActual === 'si'){
    // El decorado se cotiza: el precio lo escribe quien captura (no se llena solo)
    hint.innerHTML = `<b style="color:var(--rojo);">Pastel decorado: escribe el precio total.</b> Referencia: pastel ${fmtDinero(base)}${extra ? ' + corona ' + fmtDinero(extra) : ''}.`;
    return;
  }
  hint.textContent = 'Puedes editarlo si es un precio especial.';
  document.getElementById('precio').value = base ? base + extra : '';
}
function ponerDecorado(v){
  const antes = decoradoActual;
  decoradoActual = v;
  document.querySelectorAll('#decorado-chips .chip').forEach(c=>c.classList.toggle('selected', c.dataset.dec === v));
  document.getElementById('decorado-desc-wrap').style.display = v === 'si' ? 'block' : 'none';
  if(v === 'si' && antes !== 'si') document.getElementById('precio').value = '';
  if(v !== 'si') document.getElementById('decorado-desc').value = '';
  recalcularPrecioPastel();
}
document.querySelectorAll('#decorado-chips .chip').forEach(chip=> chip.addEventListener('click', ()=> ponerDecorado(chip.dataset.dec)));
function ponerCoronaChips(){
  document.querySelectorAll('#corona-si-no-chips .chip').forEach(c=>c.classList.toggle('selected', c.dataset.corona === coronaQuiere));
  document.querySelectorAll('#corona-tipo-chips .chip').forEach(c=>c.classList.toggle('selected', c.dataset.coronatipo === coronaTipo));
}
function actualizarCoronaUI(){
  const tamano = document.getElementById('sel-tamano').value;
  const sabor = document.getElementById('sel-sabor-pastel').value;
  const wrap = document.getElementById('corona-wrap');
  const decWrap = document.getElementById('decorado-wrap');
  if(categoriaActual !== 'pastel' || !tamano || !sabor){ wrap.style.display = 'none'; decWrap.style.display = 'none'; recalcularPrecioPastel(); return; }
  wrap.style.display = 'block';
  decWrap.style.display = puede('pedidos_decorados') ? 'block' : 'none';
  const incluida = saborIncluyeCorona();
  document.getElementById('corona-incluida').style.display = incluida ? 'block' : 'none';
  document.getElementById('corona-pregunta').style.display = incluida ? 'none' : 'block';
  const tam = coronaTamanoActual();
  document.getElementById('corona-tipo-label').textContent = 'Tipo de corona ' + (tam === 'mini' ? 'mini' : 'normal');
  document.querySelector('#corona-tipo-chips [data-coronatipo="ambar"]').textContent = `Ámbar (+${fmtDinero(precioCorona('ambar', tam))})`;
  document.querySelector('#corona-tipo-chips [data-coronatipo="color"]').textContent = `De color (+${fmtDinero(precioCorona('color', tam))})`;
  document.getElementById('corona-tipo-wrap').style.display = coronaQuiere === 'si' ? 'block' : 'none';
  document.getElementById('corona-color-wrap').style.display = (coronaQuiere === 'si' && coronaTipo === 'color') ? 'block' : 'none';
  ponerCoronaChips();
  recalcularPrecioPastel();
}
function reiniciarCorona(){
  decoradoActual = 'no';
  document.querySelectorAll('#decorado-chips .chip').forEach(c=>c.classList.toggle('selected', c.dataset.dec === 'no'));
  document.getElementById('decorado-desc').value = '';
  document.getElementById('decorado-desc-wrap').style.display = 'none';
  document.getElementById('decorado-wrap').style.display = 'none';
  coronaQuiere = null;
  coronaTipo = null;
  document.getElementById('corona-color').value = '';
  ponerCoronaChips();
  document.getElementById('corona-wrap').style.display = 'none';
}
document.querySelectorAll('#corona-si-no-chips .chip').forEach(chip=>{
  chip.addEventListener('click', ()=>{
    coronaQuiere = chip.dataset.corona;
    if(coronaQuiere === 'no'){ coronaTipo = null; document.getElementById('corona-color').value = ''; }
    actualizarCoronaUI();
  });
});
document.querySelectorAll('#corona-tipo-chips .chip').forEach(chip=>{
  chip.addEventListener('click', ()=>{
    coronaTipo = chip.dataset.coronatipo;
    if(coronaTipo !== 'color') document.getElementById('corona-color').value = '';
    actualizarCoronaUI();
  });
});
document.getElementById('sel-sabor-pastel').addEventListener('change', actualizarCoronaUI);
function limpiarCamposCategoria(){
  document.getElementById('sel-tamano').value = '';
  const selSabor = document.getElementById('sel-sabor-pastel');
  selSabor.innerHTML = '<option value="">Selecciona un tamaño primero</option>';
  carritos['cart-cupcake'].qtys = {};
  carritos['cart-individual'].qtys = {};
  carritos['cart-panque'].qtys = {};
  document.getElementById('precio').value = '';
  reiniciarCorona();
}
let entregaActual = null;
let metodoPagoActual = null;
// ---------- Clientes y direcciones ----------
const CAMPOS_DIR = [
  {k:'calle', label:'Calle'},
  {k:'numero_exterior', label:'Número exterior'},
  {k:'numero_interior', label:'Número interior (opcional)'},
  {k:'colonia', label:'Colonia o fraccionamiento'},
  {k:'codigo_postal', label:'Código postal'},
  {k:'ciudad', label:'Ciudad'},
  {k:'referencias', label:'Referencias (entre calles, color de fachada, privada, etc.)'}
];
function htmlFormDireccion(pre){
  return `
    <div class="field"><label>Calle</label><input type="text" id="${pre}-calle"></div>
    <div class="row2">
      <div class="field"><label>Número exterior</label><input type="text" id="${pre}-numero_exterior"></div>
      <div class="field"><label>Número interior</label><input type="text" id="${pre}-numero_interior" placeholder="Opcional"></div>
    </div>
    <div class="field"><label>Colonia o fraccionamiento</label><input type="text" id="${pre}-colonia"></div>
    <div class="row2">
      <div class="field"><label>Código postal</label><input type="text" id="${pre}-codigo_postal" inputmode="numeric" maxlength="5"></div>
      <div class="field"><label>Ciudad</label><input type="text" id="${pre}-ciudad" value="Culiacán"></div>
    </div>
    <div class="field"><label>Referencias</label><textarea id="${pre}-referencias" placeholder="Entre calles, color de fachada, privada, etc."></textarea></div>`;
}
function leerDireccion(pre){
  const d = {};
  CAMPOS_DIR.forEach(c=>{ d[c.k] = (document.getElementById(`${pre}-${c.k}`).value || '').trim(); });
  return d;
}
function direccionVacia(d){
  return !d.calle && !d.numero_exterior && !d.numero_interior && !d.colonia && !d.codigo_postal && !d.referencias;
}
function faltaEnDireccion(d){
  const faltan = [];
  if(!d.calle) faltan.push('calle');
  if(!d.numero_exterior) faltan.push('número exterior');
  if(!d.colonia) faltan.push('colonia');
  return faltan;
}
function textoDireccion(d){
  if(!d) return '';
  let t = [d.calle, d.numero_exterior].filter(Boolean).join(' ');
  if(d.numero_interior) t += ` int. ${d.numero_interior}`;
  const partes = [t];
  if(d.colonia) partes.push(`Col. ${d.colonia}`);
  if(d.codigo_postal) partes.push(`C.P. ${d.codigo_postal}`);
  if(d.ciudad) partes.push(d.ciudad);
  let s = partes.filter(Boolean).join(', ');
  if(d.referencias) s += `. Ref: ${d.referencias}`;
  return s;
}
function direccionDeCliente(c){
  if(!c || !c.calle) return null;
  const d = {};
  CAMPOS_DIR.forEach(x=>{ d[x.k] = c[x.k] || ''; });
  return d;
}
function nombreCompleto(c){
  if(!c) return '';
  return [c.nombre, c.apellido].map(x=>(x||'').trim()).filter(Boolean).join(' ');
}
let clienteActual = null;
let dirOpcion = null;
let busquedaTimer = null;
function limpiarResultados(){
  const r = document.getElementById('cliente-resultados');
  r.innerHTML = '';
  r.classList.remove('visible');
}
async function buscarClientes(){
  const texto = document.getElementById('cliente-busqueda').value;
  const q = texto.replace(/[,()"\\%*]/g, ' ').replace(/\s+/g,' ').trim();
  const cont = document.getElementById('cliente-resultados');
  if(q.length < 1){ limpiarResultados(); return; }

  const { data, error } = await sb.from('clientes')
    .select('*')
    // Nombre que empieza con lo escrito, o cualquier palabra del nombre (apellido) que empiece igual,
    // o teléfono que contenga los números escritos
    .or(`nombre.ilike."${q}*",nombre.ilike."* ${q}*",apellido.ilike."${q}*",apellido.ilike."* ${q}*",telefono.ilike."*${q}*"`)
    .order('nombre')
    .limit(12);

  if(document.getElementById('cliente-busqueda').value !== texto) return; // ya escribió otra cosa
  cont.classList.add('visible');
  if(error){
    cont.innerHTML = `<div class="sin-resultados">No se pudo buscar: ${escHtml(error.message)}</div>`;
    return;
  }
  if(!data || data.length === 0){
    cont.innerHTML = '<div class="sin-resultados">No se encontró ningún cliente. Agrégalo con "+ Cliente nuevo".</div>';
    return;
  }
  cont.innerHTML = '';
  data.forEach(c=>{
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'resultado-cliente';
    const dir = direccionDeCliente(c);
    b.innerHTML = `<div class="rc-nombre">${escHtml(nombreCompleto(c))}</div>
      <div class="rc-sub">${escHtml(c.telefono || 'Sin teléfono')}${dir && dir.colonia ? ' · ' + escHtml(dir.colonia) : ''}</div>`;
    b.onclick = () => seleccionarCliente(c);
    cont.appendChild(b);
  });
}
document.getElementById('cliente-busqueda').addEventListener('input', ()=>{
  clearTimeout(busquedaTimer);
  busquedaTimer = setTimeout(buscarClientes, 150);
});
document.getElementById('cliente-busqueda').addEventListener('keydown', e=>{
  if(e.key === 'Enter') e.preventDefault();
});
function seleccionarCliente(c){
  clienteActual = c;
  limpiarResultados();
  document.getElementById('cliente-busqueda').value = '';
  document.getElementById('cliente-buscar-wrap').style.display = 'none';
  document.getElementById('cliente-nuevo-wrap').style.display = 'none';
  const dir = direccionDeCliente(c);
  const card = document.getElementById('cliente-seleccionado');
  card.innerHTML = `
    <div class="cc-nombre">${escHtml(nombreCompleto(c))}</div>
    <div class="cc-linea">${escHtml(c.telefono || 'Sin teléfono')}</div>
    <div class="cc-linea">${dir ? escHtml(textoDireccion(dir)) : 'Sin dirección guardada'}</div>
    <a href="#" onclick="quitarCliente(); return false;">Cambiar cliente</a>`;
  card.style.display = 'block';
  document.getElementById('pedido-resto').style.display = 'block';
  document.getElementById('pedido-sin-cliente').style.display = 'none';
  dirOpcion = null;
  actualizarDireccionUI();
}
function quitarCliente(){
  clienteActual = null;
  dirOpcion = null;
  document.getElementById('cliente-seleccionado').style.display = 'none';
  document.getElementById('cliente-buscar-wrap').style.display = 'block';
  document.getElementById('pedido-resto').style.display = 'none';
  document.getElementById('pedido-sin-cliente').style.display = 'block';
  actualizarDireccionUI();
}
function abrirClienteNuevo(){
  const texto = document.getElementById('cliente-busqueda').value.trim();
  limpiarResultados();
  document.getElementById('cliente-buscar-wrap').style.display = 'none';
  document.getElementById('cliente-nuevo-wrap').style.display = 'block';
  document.getElementById('cn-msg').className = 'msg';
  // Si ya había escrito algo en el buscador, se pasa al campo que corresponda
  if(texto){
    if(/^[\d\s+()-]+$/.test(texto)) document.getElementById('cn-telefono').value = texto;
    else document.getElementById('cn-nombre').value = texto;
  }
  document.getElementById('cn-nombre').focus();
}
function limpiarFormCliente(){
  document.getElementById('cn-nombre').value = '';
  document.getElementById('cn-apellido').value = '';
  document.getElementById('cn-telefono').value = '';
  CAMPOS_DIR.forEach(c=>{ document.getElementById(`cn-${c.k}`).value = c.k === 'ciudad' ? 'Culiacán' : ''; });
  document.getElementById('cn-msg').className = 'msg';
}
function cancelarClienteNuevo(){
  limpiarFormCliente();
  document.getElementById('cliente-nuevo-wrap').style.display = 'none';
  document.getElementById('cliente-buscar-wrap').style.display = 'block';
}
async function guardarClienteNuevo(){
  const msg = document.getElementById('cn-msg');
  msg.className = 'msg';
  const nombre = document.getElementById('cn-nombre').value.trim();
  const apellido = document.getElementById('cn-apellido').value.trim();
  const telefono = document.getElementById('cn-telefono').value.trim();
  if(!nombre){ msg.className = 'msg err'; msg.textContent = 'Falta el nombre del cliente.'; return; }
  if(!apellido){ msg.className = 'msg err'; msg.textContent = 'Falta el apellido del cliente.'; return; }
  if(!telefono){ msg.className = 'msg err'; msg.textContent = 'Falta el teléfono.'; return; }

  const dir = leerDireccion('cn');
  const conDireccion = !direccionVacia(dir);
  if(conDireccion){
    const faltan = faltaEnDireccion(dir);
    if(faltan.length){
      msg.className = 'msg err';
      msg.textContent = 'A la dirección le falta: ' + faltan.join(', ') + '. Complétala o déjala vacía.';
      return;
    }
  }

  const nuevo = { nombre, apellido, telefono };
  CAMPOS_DIR.forEach(c=>{ nuevo[c.k] = conDireccion ? (dir[c.k] || null) : null; });

  const btn = document.getElementById('btn-guardar-cliente');
  btn.disabled = true; btn.textContent = 'Guardando...';
  const { data, error } = await sb.from('clientes').insert([nuevo]).select().single();
  btn.disabled = false; btn.textContent = 'Guardar cliente';

  if(error){
    msg.className = 'msg err';
    msg.textContent = 'No se pudo guardar el cliente: ' + error.message;
    return;
  }
  limpiarFormCliente();
  seleccionarCliente(data);
}
function actualizarDireccionUI(){
  const wrap = document.getElementById('direccion-wrap');
  const esDomicilio = entregaActual === 'domicilio';
  wrap.style.display = esDomicilio ? 'block' : 'none';
  if(!esDomicilio) return;

  const guardada = direccionDeCliente(clienteActual);
  const chips = document.getElementById('dir-opcion-chips');
  if(guardada){
    chips.style.display = 'flex';
    if(!dirOpcion) dirOpcion = 'guardada';
  } else {
    chips.style.display = 'none';
    dirOpcion = 'nueva';
  }
  chips.querySelectorAll('.chip').forEach(c=>c.classList.toggle('selected', c.dataset.dir === dirOpcion));

  const txt = document.getElementById('dir-guardada-texto');
  if(dirOpcion === 'guardada'){
    txt.innerHTML = `<div class="cc-linea" style="margin:0;">${escHtml(textoDireccion(guardada))}</div>`;
    txt.style.display = 'block';
  } else {
    txt.style.display = 'none';
  }
  document.getElementById('dir-nueva-form').style.display = dirOpcion === 'nueva' ? 'block' : 'none';
  document.getElementById('dir-nueva-hint').style.display = (dirOpcion === 'nueva' && clienteActual) ? 'block' : 'none';
}
let recibeOpcion = 'cliente';
function ponerRecibe(op){
  recibeOpcion = op;
  document.querySelectorAll('#recibe-chips .chip').forEach(c=>c.classList.toggle('selected', c.dataset.recibe === op));
  document.getElementById('recibe-otra-wrap').style.display = op === 'otra' ? 'block' : 'none';
  if(op !== 'otra'){
    document.getElementById('recibe-nombre').value = '';
    document.getElementById('recibe-telefono').value = '';
  }
}
document.querySelectorAll('#recibe-chips .chip').forEach(chip=>{
  chip.addEventListener('click', ()=> ponerRecibe(chip.dataset.recibe));
});
document.querySelectorAll('#dir-opcion-chips .chip').forEach(chip=>{
  chip.addEventListener('click', ()=>{
    dirOpcion = chip.dataset.dir;
    actualizarDireccionUI();
  });
});
document.getElementById('cn-direccion').innerHTML = htmlFormDireccion('cn');
document.getElementById('dir-nueva-form').innerHTML = htmlFormDireccion('pd');
document.querySelectorAll('#entrega-chips .chip').forEach(chip=>{
  chip.addEventListener('click', ()=>{
    document.querySelectorAll('#entrega-chips .chip').forEach(c=>c.classList.remove('selected'));
    chip.classList.add('selected');
    entregaActual = chip.dataset.entrega;
    actualizarDireccionUI();
    const esDom = entregaActual === 'domicilio';
    document.getElementById('recibe-wrap').style.display = esDom ? 'block' : 'none';
    if(!esDom) ponerRecibe('cliente');
    document.getElementById('hora-label').textContent = 'Hora';
  });
});
document.querySelectorAll('#metodo-pago-chips .chip').forEach(chip=>{
  chip.addEventListener('click', ()=>{
    document.querySelectorAll('#metodo-pago-chips .chip').forEach(c=>c.classList.remove('selected'));
    chip.classList.add('selected');
    metodoPagoActual = chip.dataset.metodo;
  });
});
let pagoDadoActual = null;
document.querySelectorAll('#pago-si-no-chips .chip').forEach(chip=>{
  chip.addEventListener('click', ()=>{
    document.querySelectorAll('#pago-si-no-chips .chip').forEach(c=>c.classList.remove('selected'));
    chip.classList.add('selected');
    pagoDadoActual = chip.dataset.pagosn;
    const esSi = pagoDadoActual === 'si';
    document.getElementById('pago-detalle').style.display = esSi ? 'block' : 'none';
    if(!esSi){
      document.getElementById('anticipo').value = '';
      metodoPagoActual = null;
      document.querySelectorAll('#metodo-pago-chips .chip').forEach(c=>c.classList.remove('selected'));
    }
    actualizarFaltaPago();
  });
});
function actualizarFaltaPago(){
  const total = parseFloat(document.getElementById('precio').value) || 0;
  const pagado = parseFloat(document.getElementById('anticipo').value) || 0;
  const falta = Math.max(0, total - pagado);
  document.getElementById('falta-pago-display').textContent = '$' + falta;
}
document.getElementById('anticipo').addEventListener('input', actualizarFaltaPago);
document.getElementById('precio').addEventListener('input', actualizarFaltaPago);
document.querySelectorAll('#categoria-chips .chip').forEach(chip=>{
  chip.addEventListener('click', ()=>{
    document.querySelectorAll('#categoria-chips .chip').forEach(c=>c.classList.remove('selected'));
    chip.classList.add('selected');
    categoriaActual = chip.dataset.cat;

    limpiarCamposCategoria();

    document.getElementById('detalle-pastel').style.display = categoriaActual==='pastel' ? 'block':'none';
    document.getElementById('detalle-cupcake').style.display = categoriaActual==='cupcake' ? 'block':'none';
    document.getElementById('detalle-individual').style.display = categoriaActual==='individual' ? 'block':'none';
    document.getElementById('detalle-panque').style.display = categoriaActual==='panque' ? 'block':'none';
    document.getElementById('precio-wrap').style.display = 'block';
    document.getElementById('precio-label').textContent = 'Total';

    if(categoriaActual==='cupcake'){
      renderCarrito('cart-cupcake');
    } else if(categoriaActual==='individual'){
      renderCarrito('cart-individual');
    } else if(categoriaActual==='panque'){
      renderCarrito('cart-panque');
    }
  });
});
document.getElementById('sel-tamano').addEventListener('change', (e)=>{
  const tamano = e.target.value;
  const opt = e.target.selectedOptions[0];
  document.getElementById('precio').value = opt && opt.dataset.precio ? opt.dataset.precio : '';

  const selSabor = document.getElementById('sel-sabor-pastel');
  selSabor.innerHTML = '<option value="">Selecciona...</option>';
  const esCheese = tamano.toLowerCase().includes('cheesecake');
  const lista = saboresPastelesData.filter(s=>{
    const esCC = s.nombre.startsWith('cc_');
    return esCheese ? esCC : !esCC;
  });
  lista.forEach(s=>{
    const opt = document.createElement('option');
    opt.value = s.nombre;
    opt.textContent = formatNombre(s.nombre);
    selSabor.appendChild(opt);
  });
  actualizarCoronaUI();
});
document.getElementById('form-pedido').addEventListener('submit', async (e)=>{
  e.preventDefault();
  const btn = document.getElementById('btn-guardar');
  const msg = document.getElementById('msg');
  msg.className = 'msg';

  if(!clienteActual){
    msg.className = 'msg err';
    msg.textContent = document.getElementById('cliente-nuevo-wrap').style.display === 'block'
      ? 'Primero toca "Guardar cliente" para dar de alta al cliente nuevo.'
      : 'Busca y selecciona al cliente, o agrégalo con "+ Cliente nuevo".';
    return;
  }

  if(!categoriaActual){
    msg.className = 'msg err';
    msg.textContent = 'Selecciona qué va a llevar el pedido (pastel, cupcake o individual).';
    return;
  }

  let tamano_o_sabor = '';
  let coronaDatos = { corona_tipo:null, corona_tamano:null, corona_color:null, corona_precio:null };
  let sabor = '';
  let precioCalculado = document.getElementById('precio').value || '0';

  if(categoriaActual === 'pastel'){
    tamano_o_sabor = document.getElementById('sel-tamano').value;
    sabor = document.getElementById('sel-sabor-pastel').value;
    if(!tamano_o_sabor){ msg.className='msg err'; msg.textContent='Selecciona el tamaño del pastel.'; return; }
    if(!sabor){ msg.className='msg err'; msg.textContent='Selecciona el sabor del pastel.'; return; }
    if(saborIncluyeCorona()){
      coronaDatos = { corona_tipo:'incluida', corona_tamano: coronaTamanoActual(), corona_color:null, corona_precio:0 };
    } else {
      if(!coronaQuiere){ msg.className='msg err'; msg.textContent='Indica si el pastel lleva corona.'; return; }
      if(coronaQuiere === 'si'){
        if(!coronaTipo){ msg.className='msg err'; msg.textContent='Elige si la corona es ámbar o de color.'; return; }
        const color = document.getElementById('corona-color').value.trim();
        if(coronaTipo === 'color' && !color){ msg.className='msg err'; msg.textContent='Escribe el color de la corona.'; return; }
        const tam = coronaTamanoActual();
        coronaDatos = { corona_tipo: coronaTipo, corona_tamano: tam, corona_color: coronaTipo === 'color' ? color : null, corona_precio: precioCorona(coronaTipo, tam) };
      }
    }
    if(decoradoActual === 'si'){
      if(!puede('pedidos_decorados')){ msg.className='msg err'; msg.textContent='Solo la directora puede agendar pasteles decorados.'; return; }
      if(!document.getElementById('decorado-desc').value.trim()){ msg.className='msg err'; msg.textContent='Escribe la descripción del decorado.'; return; }
      if(!(Number(document.getElementById('precio').value) > 0)){ msg.className='msg err'; msg.textContent='Es pastel decorado: escribe el precio total antes de guardar.'; return; }
    }
  } else if(categoriaActual === 'cupcake' || categoriaActual === 'individual' || categoriaActual === 'panque'){
    const containerId = {cupcake:'cart-cupcake', individual:'cart-individual', panque:'cart-panque'}[categoriaActual];
    const carrito = carritos[containerId];
    const seleccionados = carrito.items.filter(item => (carrito.qtys[item.nombre]||0) > 0);
    if(seleccionados.length === 0){
      msg.className = 'msg err';
      msg.textContent = 'Agrega al menos una cantidad mayor a 0.';
      return;
    }
    tamano_o_sabor = categoriaActual;
    sabor = seleccionados.map(item => `${carrito.qtys[item.nombre]} ${formatNombre(item.nombre)}`).join(', ');
  }

  if(!entregaActual){
    msg.className = 'msg err';
    msg.textContent = 'Indica si recoge en el local o es a domicilio.';
    return;
  }

  let direccionDetalle = null;
  if(entregaActual === 'domicilio'){
    direccionDetalle = dirOpcion === 'guardada' ? direccionDeCliente(clienteActual) : leerDireccion('pd');
    const faltan = direccionDetalle ? faltaEnDireccion(direccionDetalle) : ['calle','número exterior','colonia'];
    if(faltan.length){
      msg.className = 'msg err';
      msg.textContent = 'A la dirección de entrega le falta: ' + faltan.join(', ') + '.';
      return;
    }
  }

  let recibeNombre = '', recibeTelefono = '';
  if(entregaActual === 'domicilio' && recibeOpcion === 'otra'){
    recibeNombre = document.getElementById('recibe-nombre').value.trim();
    recibeTelefono = document.getElementById('recibe-telefono').value.trim();
    if(!recibeNombre || !recibeTelefono){
      msg.className = 'msg err';
      msg.textContent = 'Falta el nombre y el teléfono de la persona que recibe.';
      return;
    }
  }

  const fecha = document.getElementById('fecha_entrega').value;
  if(!fecha){
    msg.className = 'msg err';
    msg.textContent = 'Falta la fecha de entrega.';
    return;
  }

  let hora = document.getElementById('hora_entrega').value;
  if(!hora) hora = '11:00';
  const fecha_entrega = new Date(`${fecha}T${hora}:00`).toISOString();

  if(!pagoDadoActual){
    msg.className = 'msg err';
    msg.textContent = 'Indica si dio anticipo, ya pagó completo, o sigue pendiente.';
    return;
  }
  if(pagoDadoActual === 'si' && !metodoPagoActual){
    msg.className = 'msg err';
    msg.textContent = 'Selecciona el método de pago.';
    return;
  }

  const pedido = {
    cliente_id: clienteActual.id,
    nombre_cliente: nombreCompleto(clienteActual),
    telefono: clienteActual.telefono || '',
    categoria: categoriaActual,
    tamano_o_sabor: tamano_o_sabor,
    sabor: sabor,
    precio: precioCalculado || '0',
    fecha_entrega: fecha_entrega,
    entrega: entregaActual,
    direccion: direccionDetalle ? textoDireccion(direccionDetalle) : '',
    direccion_detalle: direccionDetalle,
    ...coronaDatos,
    decorado: categoriaActual === 'pastel' && decoradoActual === 'si',
    decorado_descripcion: (categoriaActual === 'pastel' && decoradoActual === 'si') ? document.getElementById('decorado-desc').value.trim() : null,
    recibe_nombre: recibeNombre || null,
    recibe_telefono: recibeTelefono || null,
    metodo_pago: metodoPagoActual || '',
    anticipo: document.getElementById('anticipo').value || '0',
    notas: document.getElementById('notas').value
  };

  btn.disabled = true;
  btn.textContent = 'Guardando...';

  const { error } = await sb.from('pedidos').insert([pedido]);

  btn.disabled = false;
  btn.textContent = 'Guardar pedido';

  if(error){
    msg.className = 'msg err';
    msg.textContent = 'No se pudo guardar: ' + error.message;
  } else {
    limpiarFormularioPedido();

    document.getElementById('form-pedido').style.display = 'none';
    document.getElementById('confirmacion').style.display = 'block';
    document.getElementById('conf-msg').className = 'msg';
    // En el local: si dejó anticipo (o pagó completo), ofrecer el comprobante impreso
    if(rolActual === 'colaborador' && (Number(pedido.anticipo)||0) > 0){
      ticketPendiente = { comprobante:true, fecha:new Date(), items:[itemTicketPedido(pedido)], subtotal:0, cort:0, total:0, metodo:null,
        metodoAnticipo: pedido.metodo_pago || null, recibe:0, msgId:'conf-msg', nota:'El pedido sí quedó guardado.' };
      document.getElementById('tk-sub').textContent = `${pedido.nombre_cliente || 'Pedido'} · pagó ${fmtDinero(pedido.anticipo)} de ${fmtDinero(pedido.precio)}`;
      abrirModal('tk');
    }
  }
});
// Deja el formulario de Nuevo pedido completamente limpio
function limpiarFormularioPedido(){
  document.getElementById('form-pedido').reset();
  categoriaActual = null;
  document.querySelectorAll('#form-pedido .chip').forEach(c=>c.classList.remove('selected'));
  document.getElementById('detalle-pastel').style.display='none';
  document.getElementById('detalle-cupcake').style.display='none';
  document.getElementById('detalle-individual').style.display='none';
  document.getElementById('detalle-panque').style.display='none';
  document.getElementById('precio-wrap').style.display='none';
  carritos['cart-cupcake'].qtys = {};
  carritos['cart-individual'].qtys = {};
  carritos['cart-panque'].qtys = {};
  entregaActual = null;
  metodoPagoActual = null;
  pagoDadoActual = null;
  document.getElementById('direccion-wrap').style.display = 'none';
  document.getElementById('pago-detalle').style.display = 'none';
  document.getElementById('recibe-wrap').style.display = 'none';
  reiniciarCorona();
  document.getElementById('falta-pago-display').textContent = '$0';
  clearTimeout(busquedaTimer);
  document.getElementById('cliente-busqueda').value = '';
  limpiarResultados();
  cancelarClienteNuevo();
  ponerRecibe('cliente');
  quitarCliente();
  document.getElementById('msg').className = 'msg';
}
function iniciarNuevoPedido(){
  document.getElementById('confirmacion').style.display = 'none';
  document.getElementById('form-pedido').style.display = 'block';
}
