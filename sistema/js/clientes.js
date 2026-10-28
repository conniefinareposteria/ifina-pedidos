// Clientes (solo directora): búsqueda, ficha e historial de pedidos.

// ---------- Clientes (solo directora) ----------
let clientesTimer = null;
let clienteEditando = null;
function abrirClientes(){
  activarVistaDirectora('tab-clientes', 'view-clientes');
  cargarClientes();
}
async function cargarClientes(){
  const cont = document.getElementById('clientes-contenido');
  const texto = document.getElementById('clientes-busqueda').value;
  const q = texto.replace(/[,()"\\%*]/g, ' ').replace(/\s+/g,' ').trim();
  let consulta = sb.from('clientes').select('*').order('nombre').limit(300);
  if(q) consulta = consulta.or(`nombre.ilike."${q}*",nombre.ilike."* ${q}*",apellido.ilike."${q}*",apellido.ilike."* ${q}*",telefono.ilike."*${q}*"`);
  const { data, error } = await consulta;
  if(document.getElementById('clientes-busqueda').value !== texto) return;
  if(error){ cont.className = 'empty'; cont.textContent = 'No se pudieron cargar los clientes: ' + error.message; return; }
  if(!data || !data.length){ cont.className = 'empty'; cont.textContent = q ? 'No se encontró ningún cliente.' : 'Todavía no hay clientes guardados.'; return; }
  cont.className = 'lista-resultados visible';
  cont.innerHTML = '';
  data.forEach(c=>{
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'resultado-cliente';
    const dir = direccionDeCliente(c);
    b.innerHTML = `<div class="rc-nombre">${escHtml(nombreCompleto(c))}</div>
      <div class="rc-sub">${escHtml(c.telefono || 'Sin teléfono')}${dir && dir.colonia ? ' · ' + escHtml(dir.colonia) : ''}</div>`;
    b.onclick = () => abrirClienteDetalle(c);
    cont.appendChild(b);
  });
}
document.getElementById('clientes-busqueda').addEventListener('input', ()=>{
  clearTimeout(clientesTimer);
  clientesTimer = setTimeout(cargarClientes, 150);
});
function abrirClienteDetalle(c){
  clienteEditando = c;
  document.getElementById('cd-nombre').value = c.nombre || '';
  document.getElementById('cd-apellido').value = c.apellido || '';
  document.getElementById('cd-telefono').value = c.telefono || '';
  CAMPOS_DIR.forEach(x=>{ document.getElementById(`cd-${x.k}`).value = c[x.k] || (x.k === 'ciudad' ? 'Culiacán' : ''); });
  document.getElementById('cd-msg').className = 'msg';
  activarVistaDirectora('tab-clientes', 'view-cliente-detalle');
  cargarPedidosCliente();
}
async function guardarClienteEditado(){
  const c = clienteEditando; if(!c) return;
  const msg = document.getElementById('cd-msg'); msg.className = 'msg';
  const nombre = document.getElementById('cd-nombre').value.trim();
  const apellido = document.getElementById('cd-apellido').value.trim();
  const telefono = document.getElementById('cd-telefono').value.trim();
  if(!nombre){ msg.className = 'msg err'; msg.textContent = 'Falta el nombre del cliente.'; return; }
  if(!apellido){ msg.className = 'msg err'; msg.textContent = 'Falta el apellido del cliente.'; return; }
  if(!telefono){ msg.className = 'msg err'; msg.textContent = 'Falta el teléfono.'; return; }
  const dir = leerDireccion('cd');
  const conDireccion = !direccionVacia(dir);
  if(conDireccion){
    const faltan = faltaEnDireccion(dir);
    if(faltan.length){ msg.className = 'msg err'; msg.textContent = 'A la dirección le falta: ' + faltan.join(', ') + '. Complétala o déjala vacía.'; return; }
  }
  const cambios = { nombre, apellido, telefono };
  CAMPOS_DIR.forEach(x=>{ cambios[x.k] = conDireccion ? (dir[x.k] || null) : null; });
  const btn = document.getElementById('btn-cd-guardar'); btn.disabled = true; btn.textContent = 'Guardando...';
  const { data, error } = await sb.from('clientes').update(cambios).eq('id', c.id).select();
  btn.disabled = false; btn.textContent = 'Guardar cambios';
  if(error){ msg.className = 'msg err'; msg.textContent = 'No se pudo guardar: ' + error.message; return; }
  if(!data || !data.length){ msg.className = 'msg err'; msg.textContent = 'No se guardó. Revisa que ya se haya corrido el SQL de clientes.'; return; }
  clienteEditando = data[0];
  msg.className = 'msg ok'; msg.textContent = 'Cliente guardado.';
}
async function cargarPedidosCliente(){
  const c = clienteEditando; if(!c) return;
  const cont = document.getElementById('cd-pedidos');
  cont.className = 'loading'; cont.textContent = 'Cargando pedidos...';
  const tel = (c.telefono || '').replace(/[,()"\\%*]/g, '').trim();
  let q = sb.from('pedidos').select('*').order('fecha_entrega', {ascending:false});
  q = tel ? q.or(`cliente_id.eq.${Number(c.id)},telefono.eq."${tel}"`) : q.eq('cliente_id', c.id);
  const { data, error } = await q;
  const res = document.getElementById('cd-resumen'); res.textContent = '';
  if(error){ cont.className = 'empty'; cont.textContent = 'No se pudieron cargar los pedidos: ' + error.message; return; }
  if(!data || !data.length){ cont.className = 'empty'; cont.textContent = 'Este cliente todavía no tiene pedidos.'; return; }
  const total = data.reduce((a,p)=>a+(Number(p.precio)||0),0);
  const falta = data.reduce((a,p)=>a+Math.max(0,(Number(p.precio)||0)-pagadoDe(p)),0);
  res.textContent = `${data.length} pedido${data.length===1?'':'s'} · Total ${fmtDinero(total)}` + (falta>0 ? ` · Falta por pagar ${fmtDinero(falta)}` : '');
  let filas = '';
  data.forEach(p=>{
    pedidosPorId[p.id] = p;
    const d = p.fecha_entrega ? new Date(p.fecha_entrega) : null;
    const fecha = d ? d.toLocaleDateString('es-MX',{weekday:'short', day:'numeric', month:'short', year:'numeric'}) : 'Sin fecha';
    const hora = d ? d.toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'}) : '';
    const producto = {pastel:'Pastel', cupcake:'Cupcakes', individual:'Individuales', panque:'Panqués'}[p.categoria] || p.categoria || '';
    const tamano = p.categoria === 'pastel' ? formatNombre(p.tamano_o_sabor) : '—';
    const sabor = p.categoria === 'pastel' ? formatNombre(p.sabor) + (textoCorona(p) ? ' · ' + textoCorona(p) : '') : (p.sabor || '');
    const entrega = p.entrega === 'domicilio' ? 'Domicilio' : p.entrega === 'casa' ? 'Recoger en casa' : 'Recoge en local';
    const tot = Number(p.precio)||0, pag = pagadoDe(p), fal = Math.max(0, tot-pag);
    const metodo = pag > 0 && p.metodo_pago ? `<span class="sub">${escHtml(formatNombre(p.metodo_pago))}</span>` : '';
    filas += `<tr>
      <td class="c"><button type="button" class="btn-editar-fila" onclick="elegirAccionPedido(${Number(p.id)})">Editar</button></td>
      <td class="nowrap">${escHtml(fecha)}</td><td class="nowrap">${hora}</td><td class="nowrap">${producto}</td>
      <td class="nowrap">${escHtml(tamano)}</td><td class="det">${escHtml(sabor)}</td><td class="nowrap">${entrega}</td>
      <td class="dinero">${fmtDinero(tot)}</td><td class="dinero">${fmtDinero(pag)}${metodo}</td>
      <td class="dinero">${fal<=0 ? '<span class="falta-ok">✓ Pagado</span>' : `<span class="falta-pend">${fmtDinero(fal)}</span>`}</td>
      <td class="coment">${escHtml(p.notas || '')}</td></tr>`;
  });
  cont.className = '';
  cont.innerHTML = `<div class="tabla-wrap"><table class="tabla-pedidos"><thead><tr>
    <th></th><th>Fecha</th><th>Hora</th><th>Producto</th><th>Tamaño</th><th>Sabor / detalle</th><th>Entrega</th>
    <th class="dinero">Total</th><th class="dinero">Pagó</th><th class="dinero">Falta</th><th>Comentarios</th>
    </tr></thead><tbody>${filas}</tbody></table></div>`;
}
