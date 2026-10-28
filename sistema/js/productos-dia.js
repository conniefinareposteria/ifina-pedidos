// Productos del día (colaborador): inicio y cierre por sección, corte de caja, mermas y cortesías.

let cierreDiaActual = null;
function itemsDeSeccion(sec){
  if(sec === 'cupcakes') return CUPCAKE_SABORES;
  if(sec === 'coronas') return CORONA_TIPOS;
  if(sec === 'panques') return PANQUE_PRODUCTOS;
  return INDIVIDUAL_PRODUCTOS;
}
let seccionActual = null;
let tandasCount = {};
async function abrirProductosDia(){
  document.getElementById('tab-nuevo').classList.remove('active');
  document.getElementById('tab-lista').classList.remove('active');
  document.getElementById('tab-productos').classList.add('active');
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.getElementById('view-productos').classList.add('active');

  const fecha = fechaHoyStr();
  const fechaLegible = new Date().toLocaleDateString('es-MX', {weekday:'long', day:'numeric', month:'long', year:'numeric'});
  document.getElementById('productos-dia-fecha').textContent = fechaLegible.charAt(0).toUpperCase() + fechaLegible.slice(1);

  const { data, error } = await sb.from('cierres_dia').select('*').eq('fecha', fecha).maybeSingle();
  if(error){
    document.getElementById('productos-dia-msg').className = 'msg err';
    document.getElementById('productos-dia-msg').textContent = 'Error al cargar: ' + error.message;
    return;
  }
  cierreDiaActual = data || { fecha, cupcakes:{}, individuales:{}, pasteles:{}, panques:{}, coronas:{}, corte_caja:{}, cupcakes_listo:false, individuales_listo:false, pasteles_listo:false, panques_listo:false, caja_listo:false, cerrado:false };
  actualizarChecksHub();
  cargarMermaCortesiaHoy();
}
function actualizarChecksHub(){
  document.getElementById('check-cupcakes').innerHTML = cierreDiaActual.cupcakes_listo ? '<span class="check-ok">✓</span>' : '';
  document.getElementById('check-individuales').innerHTML = cierreDiaActual.individuales_listo ? '<span class="check-ok">✓</span>' : '';
  document.getElementById('check-pasteles').innerHTML = cierreDiaActual.pasteles_listo ? '<span class="check-ok">✓</span>' : '';
  document.getElementById('check-panques').innerHTML = cierreDiaActual.panques_listo ? '<span class="check-ok">✓</span>' : '';
  document.getElementById('check-coronas').innerHTML = cierreDiaActual.coronas_listo ? '<span class="check-ok">✓</span>' : '';
  document.getElementById('check-caja').innerHTML = cierreDiaActual.caja_listo ? '<span class="check-ok">✓</span>' : '';
  const msg = document.getElementById('productos-dia-msg');
  if(cierreDiaActual.cerrado){
    msg.className = 'msg ok';
    msg.textContent = 'Este día ya está cerrado.';
  } else {
    msg.className = 'msg';
  }
}
let modoActual = null;
let nivelSeccion = 'chooser';
function volverAProductosDia(){
  document.getElementById('view-seccion').classList.remove('active');
  document.getElementById('view-productos').classList.add('active');
  cargarMermaCortesiaHoy();
}
function irAtras(){
  if(nivelSeccion === 'editor' && seccionActual !== 'caja'){
    abrirSeccion(seccionActual);
  } else {
    volverAProductosDia();
  }
}
function mostrarBuscadorSeccion(si){
  document.getElementById('seccion-buscar').value = '';
  document.getElementById('seccion-buscar-wrap').style.display = si ? 'block' : 'none';
}
function filtrarSeccion(){
  const norm = t => String(t||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
  const q = norm(document.getElementById('seccion-buscar').value);
  document.querySelectorAll('#seccion-filas .seccion-item').forEach(el=>{
    const n = el.querySelector('.nombre-item');
    el.style.display = !q || (n && norm(n.textContent).includes(q)) ? '' : 'none';
  });
}
function abrirSeccion(tipo){
  mostrarBuscadorSeccion(false);
  if(tipo === 'caja'){
    return abrirSeccionCaja();
  }
  seccionActual = tipo;
  nivelSeccion = 'chooser';
  const nombres = {cupcakes:'Cupcakes', individuales:'Cuchareables', pasteles:'Pasteles', panques:'Panqués', coronas:'Coronas ámbar'};
  document.getElementById('seccion-titulo').textContent = nombres[tipo];
  document.getElementById('btn-guardar-seccion').style.display = 'none';
  document.getElementById('btn-finalizar-seccion').style.display = 'none';
  document.getElementById('seccion-msg').className = 'msg';

  const cont = document.getElementById('seccion-filas');
  cont.innerHTML = `
    <div class="cart-list">
      <div class="cart-row" style="cursor:pointer;" onclick="abrirModoSeccion('inicio')">
        <div class="cart-row-name">Inicio de día</div><div>›</div>
      </div>
      <div class="cart-row" style="cursor:pointer;" onclick="abrirModoSeccion('cierre')">
        <div class="cart-row-name">Cierre de día</div><div>›</div>
      </div>
    </div>`;

  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.getElementById('view-seccion').classList.add('active');
}
let invBase = {};      // existencia con la que arranca hoy, por sección
let invVendHoy = {};   // vendido hoy en el punto de venta, por sección
let invMermaHoy = {};  // merma registrada hoy en el punto de venta
let invCortHoy = {};   // cortesías registradas hoy en el punto de venta

async function cargarInventarioSeccion(cat){
  const [base, mov] = await Promise.all([existenciaInicial(fechaHoyStr()), movimientosHoy()]);
  invBase = base[cat] || {};
  invVendHoy = mov.v[cat] || {};
  invMermaHoy = mov.m[cat] || {};
  invCortHoy = mov.c[cat] || {};
}
function recalcQueda(i){
  const v = id => parseFloat(document.getElementById(id)?.value) || 0;
  const q = v(`f_${i}_exis`) + v(`f_${i}_in_0`) - v(`f_${i}_vend`) - v(`f_${i}_merma`) - v(`f_${i}_cortesia`);
  document.getElementById(`f_${i}_queda`).value = Math.max(0, q);
}
function recalcQuedaPastel(i, tam){
  const v = id => parseFloat(document.getElementById(id)?.value) || 0;
  const q = v(`fp_${i}_${tam}_exis`) + v(`fp_${i}_${tam}_in`) - v(`fp_${i}_${tam}_vend`) - v(`fp_${i}_${tam}_merma`) - v(`fp_${i}_${tam}_cortesia`);
  document.getElementById(`fp_${i}_${tam}_queda`).value = Math.max(0, q);
}
async function abrirModoSeccion(modo){
  if(seccionActual === 'pasteles'){
    return abrirModoSeccionPasteles(modo);
  }
  if(catalogosListos) await catalogosListos;
  modoActual = modo;
  nivelSeccion = 'editor';
  tandasCount = {};
  const items = itemsDeSeccion(seccionActual);
  const datosHoy = cierreDiaActual[seccionActual] || {};
  const cont = document.getElementById('seccion-filas');
  cont.innerHTML = '<div class="loading">Calculando existencias...</div>';
  try { await cargarInventarioSeccion(seccionActual); }
  catch(e){ cont.innerHTML = `<div class="empty">No se pudieron calcular las existencias: ${escHtml(e.message)}</div>`; return; }

  mostrarBuscadorSeccion(seccionActual !== 'coronas');
  document.getElementById('seccion-titulo').textContent =
    ({cupcakes:'Cupcakes', individuales:'Cuchareables', panques:'Panqués', coronas:'Coronas ámbar'}[seccionActual]) + ' — ' + (modo === 'inicio' ? 'Inicio de día' : 'Cierre de día');
  cont.innerHTML = '';
  const gris = 'background:var(--cream-deep); color:var(--muted);';

  items.forEach((nombre, i)=>{
    tandasCount[i] = 1;
    const prev = datosHoy[nombre] || {};
    const exis = invBase[nombre + '|'] || 0;
    let camposHtml = `<div><label class="mini-label">Exis</label><input type="number" class="mini-input" id="f_${i}_exis" value="${exis}" disabled style="${gris}"></div>`;

    if(modo === 'inicio'){
      camposHtml += `<div><label class="mini-label">IN</label><div id="in-wrap-${i}">${campoConBorrar(`f_${i}_in_0`, prev.in || '', `onkeydown="siEnterBajar(event, ${i})"`)}</div></div>`;
    } else {
      const vend = invVendHoy[nombre + '|'] || 0;
      camposHtml += `<div><label class="mini-label">IN</label><input type="number" class="mini-input" id="f_${i}_in_0" value="${prev.in || 0}" disabled style="${gris}"></div>`;
      camposHtml += `<div><label class="mini-label">Vendido</label><input type="number" class="mini-input" id="f_${i}_vend" value="${vend}" disabled style="${gris}"></div>`;
      camposHtml += `<div><label class="mini-label">M</label><input type="number" class="mini-input" id="f_${i}_merma" value="${invMermaHoy[nombre + '|'] || 0}" disabled style="${gris}"></div>`;
      camposHtml += `<div><label class="mini-label">Cortesía</label><input type="number" class="mini-input" id="f_${i}_cortesia" value="${invCortHoy[nombre + '|'] || 0}" disabled style="${gris}"></div>`;
      camposHtml += `<div><label class="mini-label">Queda</label><input type="number" class="mini-input" id="f_${i}_queda" disabled style="${gris} font-weight:700;"></div>`;
    }

    const div = document.createElement('div');
    div.className = 'seccion-item';
    div.innerHTML = `
      <div class="nombre-item">${nombre}</div>
      <div class="campos-fila">${camposHtml}</div>
      ${modo === 'inicio' ? `<a href="#" class="link-agregar" onclick="agregarTanda(${i}); return false;">+ agregar tanda</a>` : ''}
    `;
    cont.appendChild(div);
    if(modo === 'cierre') recalcQueda(i);
  });
  if(modo === 'cierre'){
    const nota = document.createElement('div');
    nota.className = 'hint';
    nota.style.margin = '4px 0 10px';
    nota.textContent = 'Vendido, merma y cortesía salen solos del punto de venta. Lo que queda pasa como existencia al siguiente día.';
    cont.prepend(nota);
  }

  document.getElementById('btn-guardar-seccion').style.display = 'block';
  document.getElementById('btn-finalizar-seccion').style.display = modo === 'cierre' ? 'block' : 'none';
  document.getElementById('seccion-msg').className = 'msg';
}
function agregarTanda(i){
  const n = tandasCount[i];
  tandasCount[i] = n + 1;
  const wrap = document.getElementById('in-wrap-'+i);
  const extra = document.createElement('div');
  extra.className = 'tanda-extra';
  extra.innerHTML = campoConBorrar(`f_${i}_in_${n}`, '');
  wrap.appendChild(extra);
  document.getElementById(`f_${i}_in_${n}`).focus();
}
function siEnterBajar(event, i){
  if(event.key !== 'Enter') return;
  event.preventDefault();
  const items = itemsDeSeccion(seccionActual);
  if(i + 1 < items.length){
    const siguiente = document.getElementById(`f_${i+1}_in_0`);
    if(siguiente) siguiente.focus();
  }
}
function campoPastelHtml(idx, tam, modo, prevTam, exis, vend){
  const gris = 'background:var(--cream-deep); color:var(--muted);';
  let html = `<div><label class="mini-label">Exis</label><input type="number" class="mini-input" id="fp_${idx}_${tam}_exis" value="${exis}" disabled style="${gris}"></div>`;
  if(modo === 'inicio'){
    html += `<div>
      <label class="mini-label">IN</label>
      <div style="display:flex; gap:6px; align-items:center;" id="inwrap_p_${idx}_${tam}">
        <input type="number" inputmode="numeric" class="mini-input" id="fp_${idx}_${tam}_in_0" value="${prevTam.in || ''}">
        <a href="#" class="link-agregar" style="margin:0; white-space:nowrap;" onclick="agregarTandaPastel(${idx}, '${tam}'); return false;">+ tanda</a>
      </div>
    </div>`;
  } else {
    html += `<div><label class="mini-label">IN</label><input type="number" class="mini-input" id="fp_${idx}_${tam}_in" value="${prevTam.in || 0}" disabled style="${gris}"></div>`;
    html += `<div><label class="mini-label">Vendido</label><input type="number" class="mini-input" id="fp_${idx}_${tam}_vend" value="${vend}" disabled style="${gris}"></div>`;
    html += `<div><label class="mini-label">M</label><input type="number" class="mini-input" id="fp_${idx}_${tam}_merma" value="${prevTam._merma || 0}" disabled style="${gris}"></div>`;
    html += `<div><label class="mini-label">Cortesía</label><input type="number" class="mini-input" id="fp_${idx}_${tam}_cortesia" value="${prevTam._cortesia || 0}" disabled style="${gris}"></div>`;
    html += `<div><label class="mini-label">Queda</label><input type="number" class="mini-input" id="fp_${idx}_${tam}_queda" disabled style="${gris} font-weight:700;"></div>`;
  }
  return html;
}
let tandasPastel = {};
function agregarTandaPastel(idx, tam){
  const key = idx + '_' + tam;
  const n = tandasPastel[key] || 1;
  tandasPastel[key] = n + 1;
  const wrap = document.getElementById(`inwrap_p_${idx}_${tam}`);
  const input = document.createElement('input');
  input.type = 'number';
  input.inputMode = 'numeric';
  input.className = 'mini-input';
  input.style.maxWidth = '70px';
  input.id = `fp_${idx}_${tam}_in_${n}`;
  const boton = wrap.querySelector('a');
  wrap.insertBefore(input, boton);
  input.focus();
}
async function abrirModoSeccionPasteles(modo){
  modoActual = modo;
  nivelSeccion = 'editor';
  tandasPastel = {};
  const datosHoy = cierreDiaActual.pasteles || {};
  const cont = document.getElementById('seccion-filas');
  cont.innerHTML = '<div class="loading">Calculando existencias...</div>';
  try { await cargarInventarioSeccion('pasteles'); }
  catch(e){ cont.innerHTML = `<div class="empty">No se pudieron calcular las existencias: ${escHtml(e.message)}</div>`; return; }

  mostrarBuscadorSeccion(true);
  document.getElementById('seccion-titulo').textContent = 'Pasteles — ' + (modo === 'inicio' ? 'Inicio de día' : 'Cierre de día');
  cont.innerHTML = '';

  let seMostroAlgo = false;
  PASTEL_SABORES.forEach((nombre, i)=>{
    const prev = datosHoy[nombre] || {};
    const prevMini = prev.mini || {};
    const prevChico = prev.chico || {};
    const exisMini = invBase[nombre + '|mini'] || 0, exisChico = invBase[nombre + '|chico'] || 0;
    const vendMini = invVendHoy[nombre + '|mini'] || 0, vendChico = invVendHoy[nombre + '|chico'] || 0;
    const hayMini = exisMini + (Number(prevMini.in)||0) > 0;
    const hayChico = exisChico + (Number(prevChico.in)||0) > 0;

    if(modo === 'cierre' && !hayMini && !hayChico) return;

    let bloques = '';
    if(modo !== 'cierre' || hayMini){
      bloques += `<div style="font-size:11px; font-weight:700; color:var(--cocoa-soft); letter-spacing:.1em; margin-bottom:3px;">MINI</div>
      <div style="display:flex; gap:7px; margin-bottom:10px; flex-wrap:wrap;">${campoPastelHtml(i,'mini',modo,{...prevMini, _merma: invMermaHoy[nombre+'|mini']||0, _cortesia: invCortHoy[nombre+'|mini']||0},exisMini,vendMini)}</div>`;
    }
    if(modo !== 'cierre' || hayChico){
      bloques += `<div style="font-size:11px; font-weight:700; color:var(--cocoa-soft); letter-spacing:.1em; margin-bottom:3px;">CHICO</div>
      <div style="display:flex; gap:7px; flex-wrap:wrap;">${campoPastelHtml(i,'chico',modo,{...prevChico, _merma: invMermaHoy[nombre+'|chico']||0, _cortesia: invCortHoy[nombre+'|chico']||0},exisChico,vendChico)}</div>`;
    }

    const div = document.createElement('div');
    div.className = 'seccion-item';
    div.innerHTML = `<div class="nombre-item">${nombre}</div>${bloques}`;
    cont.appendChild(div);
    if(modo === 'cierre'){ if(hayMini) recalcQuedaPastel(i,'mini'); if(hayChico) recalcQuedaPastel(i,'chico'); }
    seMostroAlgo = true;
  });

  if(modo === 'cierre' && !seMostroAlgo){
    cont.innerHTML = '<div class="empty">No hay pasteles en existencia hoy.</div>';
  }

  document.getElementById('btn-guardar-seccion').style.display = 'block';
  document.getElementById('btn-finalizar-seccion').style.display = modo === 'cierre' ? 'block' : 'none';
  document.getElementById('seccion-msg').className = 'msg';
}
async function guardarSeccionPasteles(finalizar){
  const existente = cierreDiaActual.pasteles || {};
  const resultado = {};

  PASTEL_SABORES.forEach((nombre, i)=>{
    const prevItem = existente[nombre] || { mini:{exis:0,in:0,cierre:0,merma:0,cortesia:0}, chico:{exis:0,in:0,cierre:0,merma:0,cortesia:0} };
    const nuevoItem = { mini: {...prevItem.mini}, chico: {...prevItem.chico} };

    ['mini','chico'].forEach(tam=>{
      nuevoItem[tam].exis = invBase[nombre + '|' + tam] || 0;
      if(modoActual === 'inicio'){
        let inTotal = 0;
        let t = 0;
        while(document.getElementById(`fp_${i}_${tam}_in_${t}`)){
          inTotal += parseFloat(document.getElementById(`fp_${i}_${tam}_in_${t}`).value) || 0;
          t++;
        }
        nuevoItem[tam].in = inTotal;
      }
      nuevoItem[tam].merma = invMermaHoy[nombre + '|' + tam] || 0;
      nuevoItem[tam].cortesia = invCortHoy[nombre + '|' + tam] || 0;
      // Lo que queda se calcula siempre: Exis + IN − vendido − merma − cortesía
      nuevoItem[tam].vendidos = invVendHoy[nombre + '|' + tam] || 0;
      nuevoItem[tam].cierre = Math.max(0, (nuevoItem[tam].exis||0) + (Number(nuevoItem[tam].in)||0) - nuevoItem[tam].vendidos - (Number(nuevoItem[tam].merma)||0) - (Number(nuevoItem[tam].cortesia)||0));
    });

    resultado[nombre] = nuevoItem;
  });

  const msg = document.getElementById('seccion-msg');
  const fecha = fechaHoyStr();
  const payload = { fecha, pasteles: resultado };
  if(finalizar && modoActual === 'cierre') payload.pasteles_listo = true;

  const { data: sesion } = await sb.auth.getSession();
  if(!cierreDiaActual.id) payload.abierto_por = sesion.session.user.id;

  const { data, error } = await sb.from('cierres_dia').upsert(payload, { onConflict: 'fecha' }).select().maybeSingle();

  if(error){
    msg.className = 'msg err';
    msg.textContent = 'No se pudo guardar: ' + error.message;
    return;
  }

  cierreDiaActual = data;
  msg.className = 'msg ok';
  msg.textContent = finalizar ? (modoActual === 'cierre' ? 'Cierre finalizado.' : 'Inicio guardado.') : 'Guardado.';

  if(finalizar){
    setTimeout(()=>{
      if(modoActual === 'cierre'){
        volverAProductosDia();
        actualizarChecksHub();
      } else {
        abrirSeccion('pasteles');
      }
    }, 700);
  }
}
const DENOMINACIONES = [1000, 500, 200, 100, 50, 20, 10, 5, 2, 1];
let fondoCajaAyer = 0;
let cajaAuto = null;   // ventas del día tomadas del punto de venta

function totalVentasCorte(cc){
  cc = cc || {};
  if(cc.version === 2) return (cc.venta_efectivo||0) + (cc.venta_tarjeta||0) + (cc.venta_transferencia||0);
  return (cc.venta_efectivo||0)+(cc.venta_tarjeta||0)+(cc.venta_transferencia||0)+(cc.venta_local||0)+(cc.venta_pedidos||0);
}
async function abrirSeccionCaja(){
  seccionActual = 'caja';
  nivelSeccion = 'editor';
  modoActual = 'caja';
  document.getElementById('seccion-titulo').textContent = 'Corte de caja';
  const cont = document.getElementById('seccion-filas');
  cont.innerHTML = '<div class="loading">Cargando ventas del día...</div>';
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.getElementById('view-seccion').classList.add('active');

  const fecha = fechaHoyStr();
  const d0 = new Date(); const ini = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate()); const fin = new Date(ini); fin.setDate(fin.getDate()+1);
  const [prev, ventas, antic] = await Promise.all([
    sb.from('cierres_dia').select('corte_caja').lt('fecha', fecha).order('fecha', {ascending:false}).limit(1).maybeSingle(),
    sb.from('ventas').select('total,monto_local,monto_pedidos,metodo_pago,pagos').eq('fecha', fecha),
    sb.rpc('anticipos_del_dia', { desde: ini.toISOString(), hasta: fin.toISOString() })
  ]);
  if(ventas.error){ cont.innerHTML = `<div class="empty">No se pudieron cargar las ventas: ${escHtml(ventas.error.message)}</div>`; return; }
  fondoCajaAyer = (prev.data && prev.data.corte_caja && prev.data.corte_caja.fondo_caja) || 0;

  const a = { efectivo:0, tarjeta:0, transferencia:0, local:0, pedidos:0, n:0 };
  (ventas.data||[]).forEach(v=>{
    const t = Number(v.total)||0;
    repartoVenta(v, t).forEach(r=>{ if(r.m in a) a[r.m] += r.monto; });
    a.local += Number(v.monto_local)||0;
    a.pedidos += Number(v.monto_pedidos)||0;
    a.n++;
  });
  const anticipos = { efectivo:0, tarjeta:0, transferencia:0 };
  (antic.data||[]).forEach(r=>{ if(mt(r.metodo) in anticipos) anticipos[mt(r.metodo)] += Number(r.monto)||0; });
  cajaAuto = { ...a, anticipos, anticiposError: antic.error ? antic.error.message : null };

  const datos = cierreDiaActual.corte_caja || {};
  const denom = datos.denominaciones || {};
  const g = v => v || '';

  let filasDenom = '';
  DENOMINACIONES.forEach(d=>{
    filasDenom += `
      <div class="seccion-item" style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
        <div style="font-weight:700; font-size:14px; width:50px;">$${d}</div>
        <div style="flex:1;"><label class="mini-label">Cantidad</label><input type="number" inputmode="numeric" class="mini-input" style="max-width:none;" id="dc_${d}" value="${g(denom[d])}" oninput="actualizarTotalesCaja()"></div>
        <div style="flex:1; text-align:right;"><label class="mini-label">Total</label><div id="dt_${d}" style="font-weight:700; padding:7px 0;">$0</div></div>
      </div>`;
  });

  const fila = (c, m, fuerte) => `<tr${fuerte ? ' style="font-weight:700;"' : ''}><td>${c}</td><td class="n">${fmtDinero(m)}</td></tr>`;
  const totMetodo = a.efectivo + a.tarjeta + a.transferencia;
  const totTipo = a.local + a.pedidos;
  const antTot = anticipos.efectivo + anticipos.tarjeta + anticipos.transferencia;

  cont.innerHTML = `
    <div style="font-family:'Tinos',Georgia,serif; font-size:19px; margin-bottom:4px;">Ventas del día</div>
    <div class="hint" style="margin:0 0 10px;">Se llenan solas con lo cobrado en el punto de venta (${a.n} ${a.n === 1 ? 'venta' : 'ventas'}).</div>
    <div class="tabla-wrap" style="margin-bottom:12px;"><table class="tabla-pedidos">
      <thead><tr><th>Por método de pago</th><th class="n">Monto</th></tr></thead>
      <tbody>${fila('Efectivo', a.efectivo)}${fila('Tarjeta', a.tarjeta)}${fila('Transferencia', a.transferencia)}</tbody>
      <tfoot><tr><td>Total vendido</td><td class="n">${fmtDinero(totMetodo)}</td></tr></tfoot>
    </table></div>
    <div class="tabla-wrap" style="margin-bottom:10px;"><table class="tabla-pedidos">
      <thead><tr><th>Por tipo de venta</th><th class="n">Monto</th></tr></thead>
      <tbody>${fila('Venta local (mostrador)', a.local)}${fila('Venta de pedidos (lo cobrado al entregar)', a.pedidos)}</tbody>
      <tfoot><tr><td>Total vendido</td><td class="n">${fmtDinero(totTipo)}</td></tr></tfoot>
    </table></div>
    <div class="hint" style="margin:0 0 22px;">${cajaAuto.anticiposError ? 'No se pudieron leer los anticipos de hoy.' :
      `Nota: hoy se recibieron ${fmtDinero(antTot)} de anticipos de pedidos (efectivo ${fmtDinero(anticipos.efectivo)} · tarjeta ${fmtDinero(anticipos.tarjeta)} · transferencia ${fmtDinero(anticipos.transferencia)}). No cuentan como venta.`}</div>

    <div style="font-family:'Tinos',Georgia,serif; font-size:19px; margin-bottom:8px;">Efectivo en caja</div>
    ${filasDenom}
    <div class="price-tag" style="width:100%; box-sizing:border-box; justify-content:space-between; margin:10px 0 6px;">
      <span class="label">Total contado:</span>
      <span class="amount" id="total-contado-caja">$0</span>
    </div>
    <div class="hint" id="efectivo-ajustado-hint" style="margin:0 0 22px;"></div>

    <div style="font-family:'Tinos',Georgia,serif; font-size:19px; margin-bottom:8px;">Otros</div>
    <div class="field">
      <label>Fondo de caja (lo que se deja para mañana)</label>
      <input type="number" inputmode="numeric" id="vc_fondo" value="${g(datos.fondo_caja)}">
      <div class="hint">Este monto se le va a restar al corte de caja del día siguiente.</div>
    </div>
    <div class="field"><label>Gastos</label><input type="number" inputmode="numeric" id="vc_gastos" value="${g(datos.gastos)}"></div>
  `;

  document.getElementById('btn-guardar-seccion').style.display = 'block';
  document.getElementById('btn-finalizar-seccion').style.display = 'block';
  document.getElementById('seccion-msg').className = 'msg';
  actualizarTotalesCaja();
}
function actualizarTotalesCaja(){
  let totalContado = 0;
  DENOMINACIONES.forEach(d=>{
    const cant = parseFloat(document.getElementById(`dc_${d}`).value) || 0;
    const tot = cant * d;
    totalContado += tot;
    document.getElementById(`dt_${d}`).textContent = fmtDinero(tot);
  });
  document.getElementById('total-contado-caja').textContent = fmtDinero(totalContado);
  const hint = document.getElementById('efectivo-ajustado-hint');
  if(hint) hint.textContent = `Fondo que se dejó en el corte anterior: ${fmtDinero(fondoCajaAyer)} · Contado sin ese fondo: ${fmtDinero(totalContado - fondoCajaAyer)}`;
}
async function guardarSeccionCaja(finalizar){
  const denominaciones = {};
  DENOMINACIONES.forEach(d=>{
    denominaciones[d] = parseFloat(document.getElementById(`dc_${d}`).value) || 0;
  });
  const a = cajaAuto || { efectivo:0, tarjeta:0, transferencia:0, local:0, pedidos:0, anticipos:{} };

  const corte_caja = {
    version: 2,
    denominaciones,
    venta_efectivo: a.efectivo,
    venta_tarjeta: a.tarjeta,
    venta_transferencia: a.transferencia,
    venta_local: a.local,
    venta_pedidos: a.pedidos,
    anticipos: a.anticipos,
    fondo_caja: parseFloat(document.getElementById('vc_fondo').value) || 0,
    gastos: parseFloat(document.getElementById('vc_gastos').value) || 0
  };

  const msg = document.getElementById('seccion-msg');
  const fecha = fechaHoyStr();
  const payload = { fecha, corte_caja };
  if(finalizar) payload.caja_listo = true;

  const { data: sesion } = await sb.auth.getSession();
  if(!cierreDiaActual.id) payload.abierto_por = sesion.session.user.id;

  const { data, error } = await sb.from('cierres_dia').upsert(payload, { onConflict: 'fecha' }).select().maybeSingle();

  if(error){
    msg.className = 'msg err';
    msg.textContent = 'No se pudo guardar: ' + error.message;
    return;
  }

  cierreDiaActual = data;
  msg.className = 'msg ok';
  msg.textContent = finalizar ? 'Corte de caja finalizado.' : 'Guardado.';

  if(finalizar){
    setTimeout(()=>{ volverAProductosDia(); actualizarChecksHub(); }, 700);
  }
}
async function guardarSeccion(finalizar){
  if(seccionActual === 'caja'){
    return guardarSeccionCaja(finalizar);
  }
  if(seccionActual === 'pasteles'){
    return guardarSeccionPasteles(finalizar);
  }
  const items = itemsDeSeccion(seccionActual);
  const existente = cierreDiaActual[seccionActual] || {};
  const resultado = {};

  items.forEach((nombre, i)=>{
    const prevItem = existente[nombre] || { exis:0, in:0, cierre:0, merma:0, cortesia:0 };
    let exis = prevItem.exis;
    let inTotal = prevItem.in;
    let cierre = prevItem.cierre;
    let merma = prevItem.merma;
    let cortesia = prevItem.cortesia || 0;

    exis = invBase[nombre + '|'] || 0;
    if(modoActual === 'inicio'){
      inTotal = 0;
      let t = 0;
      while(document.getElementById(`f_${i}_in_${t}`)){
        inTotal += parseFloat(document.getElementById(`f_${i}_in_${t}`).value) || 0;
        t++;
      }
    }
    merma = invMermaHoy[nombre + '|'] || 0;
    cortesia = invCortHoy[nombre + '|'] || 0;
    // Lo que queda se calcula siempre: Exis + IN − vendido − merma − cortesía
    const vendidos = invVendHoy[nombre + '|'] || 0;
    cierre = Math.max(0, (exis||0) + (Number(inTotal)||0) - vendidos - (Number(merma)||0) - (Number(cortesia)||0));

    resultado[nombre] = { exis, in: inTotal, vendidos, cierre, merma, cortesia };
  });

  const msg = document.getElementById('seccion-msg');
  const campoJson = seccionActual;
  const campoListo = seccionActual + '_listo';
  const fecha = fechaHoyStr();

  const payload = { fecha };
  payload[campoJson] = resultado;
  if(finalizar && modoActual === 'cierre') payload[campoListo] = true;

  const { data: sesion } = await sb.auth.getSession();
  if(!cierreDiaActual.id){
    payload.abierto_por = sesion.session.user.id;
  }

  const { data, error } = await sb.from('cierres_dia').upsert(payload, { onConflict: 'fecha' }).select().maybeSingle();

  if(error){
    msg.className = 'msg err';
    msg.textContent = 'No se pudo guardar: ' + error.message;
    return;
  }

  cierreDiaActual = data;
  msg.className = 'msg ok';
  msg.textContent = finalizar ? (modoActual === 'cierre' ? 'Cierre finalizado.' : 'Inicio guardado.') : 'Guardado.';

  if(finalizar){
    setTimeout(()=>{
      if(modoActual === 'cierre'){
        volverAProductosDia();
        actualizarChecksHub();
      } else {
        abrirSeccion(seccionActual);
      }
    }, 700);
  }
}
async function cerrarDia(){
  if(!cierreDiaActual.cupcakes_listo || !cierreDiaActual.individuales_listo || !cierreDiaActual.pasteles_listo || !cierreDiaActual.panques_listo){
    alert('Faltan secciones por finalizar antes de poder cerrar el día.');
    return;
  }
  if(!cierreDiaActual.caja_listo){
    alert('Falta finalizar el corte de caja antes de poder cerrar el día.');
    return;
  }
  const { error } = await sb.from('cierres_dia').update({ cerrado:true, cerrado_at:new Date().toISOString() }).eq('fecha', fechaHoyStr());
  const msg = document.getElementById('productos-dia-msg');
  if(error){
    msg.className = 'msg err';
    msg.textContent = 'No se pudo cerrar: ' + error.message;
  } else {
    msg.className = 'msg ok';
    msg.textContent = '¡Día cerrado correctamente!';
    cierreDiaActual.cerrado = true;
  }
}
// ---- Merma y cortesía del día (Productos del día) ----
let mcHoy = null;
async function cargarMermaCortesiaHoy(){
  const cont = document.getElementById('mc-dia'); if(!cont) return;
  const btn = document.getElementById('btn-imprimir-mc');
  cont.className = 'loading'; cont.textContent = 'Cargando...'; btn.style.display = 'none';
  const { data, error } = await sb.from('ventas').select('items').eq('fecha', fechaHoyStr());
  if(error){ cont.className = 'empty'; cont.textContent = 'No se pudo cargar: ' + error.message; return; }
  const junta = { m:{}, c:{} };
  (data||[]).forEach(v=>(v.items||[]).forEach(it=>{
    if(it.tipo !== 'local' || !(it.merma || it.cortesia)) return;
    const g = junta[it.merma ? 'm' : 'c'];
    const k = it.nombre || it.clave;
    const q = Number(it.cantidad)||0;
    (g[k] = g[k] || { q:0, $:0 }); g[k].q += q; g[k].$ += (Number(it.precio)||0) * q;
  }));
  const lista = g => Object.entries(g).sort((a,b)=> a[0].localeCompare(b[0], 'es'));
  mcHoy = { merma: lista(junta.m), cortesia: lista(junta.c) };
  const tabla = (titulo, filas) => {
    if(!filas.length) return `<div class="hint" style="margin:6px 0 12px;">${titulo}: nada registrado hoy.</div>`;
    const tq = filas.reduce((a,[,x])=> a + x.q, 0), t$ = filas.reduce((a,[,x])=> a + x.$, 0);
    return `<div class="tabla-wrap" style="max-width:620px; margin-bottom:12px;"><table class="tabla-pedidos">
      <thead><tr><th>${titulo}</th><th class="n">Piezas</th><th class="n">Valor</th></tr></thead>
      <tbody>${filas.map(([n,x])=>`<tr><td class="nombre">${escHtml(n)}</td><td class="n">${x.q}</td><td class="n">${fmtDinero(x.$)}</td></tr>`).join('')}</tbody>
      <tfoot><tr><td>Total</td><td class="n">${tq}</td><td class="n">${fmtDinero(t$)}</td></tr></tfoot></table></div>`;
  };
  cont.className = '';
  cont.innerHTML = (mcHoy.merma.length || mcHoy.cortesia.length) ? tabla('Merma', mcHoy.merma) + tabla('Cortesía', mcHoy.cortesia) : '<div class="empty">Hoy no hay mermas ni cortesías registradas.</div>';
  const pzs = g => g.reduce((a,[,x])=> a + x.q, 0);
  const cuenta = document.getElementById('mc-cuenta');
  if(cuenta) cuenta.textContent = (mcHoy.merma.length || mcHoy.cortesia.length) ? `Merma ${pzs(mcHoy.merma)} · Cortesía ${pzs(mcHoy.cortesia)}` : '';
  btn.style.display = (mcHoy.merma.length || mcHoy.cortesia.length) ? 'block' : 'none';
}
function abrirMermaCortesia(){
  document.getElementById('mc-msg').className = 'msg';
  abrirModal('mc');
  cargarMermaCortesiaHoy();
}
async function imprimirResumenMC(){
  const msg = document.getElementById('mc-msg');
  if(!mcHoy) return;
  msg.className = 'msg ok'; msg.textContent = 'Imprimiendo...';
  try { await enviarEpson(armarResumenMCXML(mcHoy)); msg.className = 'msg ok'; msg.textContent = 'Impreso.'; }
  catch(e){ msg.className = 'msg err'; msg.textContent = 'No se pudo imprimir (' + (e.name === 'AbortError' ? 'la impresora no contestó' : e.message) + ').'; }
}
