// Por hacer y metas de producción.

// ---------- Productos por hacer (producción) ----------
const DIAS_METAS = [[2,'Martes'],[3,'Miércoles'],[4,'Jueves'],[5,'Viernes'],[6,'Sábado']];
const METAS_GENERAL = 7;  // fila general (coronas): no depende del día
let metasData = {};       // dia -> {pasteles:{}, cupcakes:{}}
let metasCat = 'pasteles';
let metasDia = 2;
async function cargarMetas(){
  const { data, error } = await sb.from('metas_produccion').select('*');
  if(error) throw error;
  metasData = {};
  (data||[]).forEach(r=> metasData[r.dia] = { pasteles: r.pasteles || {}, cupcakes: r.cupcakes || {}, coronas: r.coronas || {} });
}
function ponerTabPH(t){
  document.querySelectorAll('#ph-tabs button').forEach(b=>b.classList.toggle('sel', b.dataset.ph === t));
  document.getElementById('ph-panel-resumen').style.display = t === 'resumen' ? 'block' : 'none';
  document.getElementById('ph-panel-metas').style.display = t === 'resumen' ? 'none' : 'block';
}
document.querySelectorAll('#ph-tabs button').forEach(b=> b.addEventListener('click', ()=>{
  if(b.dataset.ph === 'resumen') abrirPorHacer(); else abrirMetas(b.dataset.ph);
}));
async function abrirPorHacer(){
  document.querySelectorAll('nav button').forEach(b=>b.classList.remove('active'));
  document.getElementById('tab-porhacer').classList.add('active');
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.getElementById('view-porhacer').classList.add('active');
  ponerTabPH('resumen');
  const hoy = new Date();
  const f = hoy.toLocaleDateString('es-MX',{weekday:'long', day:'numeric', month:'long'});
  document.getElementById('ph-fecha').textContent = f;
  const cont = document.getElementById('ph-contenido');
  cont.className = 'loading'; cont.textContent = 'Cargando...';
  if(catalogosListos) await catalogosListos;
  let base, vendHoy, cierreHoy;
  try {
    let r;
    [base, vendHoy, r] = await Promise.all([existenciaInicial(fechaHoyStr()), movimientosHoy(), sb.from('cierres_dia').select('coronas').eq('fecha', fechaHoyStr()).maybeSingle(), cargarMetas()]);
    if(r.error) throw r.error;
    cierreHoy = r.data || {};
  }
  catch(e){ cont.className = 'empty'; cont.textContent = 'No se pudo cargar: ' + e.message + ' (revisa que ya se haya corrido el SQL de producción).'; return; }
  // Coronas: meta general vs. lo que hay en este momento
  const metaCor = (metasData[METAS_GENERAL] || {}).coronas || {};
  let filasCor = '';
  CORONA_TIPOS.forEach(t=>{
    const d = ((cierreHoy.coronas)||{})[t] || {};
    const k = t + '|', mv = x => ((vendHoy[x].coronas)||{})[k]||0;
    const hay = Math.max(0, (base.coronas[k]||0) + (Number(d.in)||0) - mv('v') - Math.max(Number(d.merma)||0, mv('m')) - Math.max(Number(d.cortesia)||0, mv('c')));
    const m = Number(metaCor[t]) || 0;
    const h = Math.max(0, m - hay);
    filasCor += `<tr><td class="nombre">${t}</td><td class="n">${m}</td><td class="n">${hay}</td><td class="n"><span class="ph-hacer${h ? '' : ' ph-cero'}">${h}</span></td></tr>`;
  });
  const bloqueCor = `<div class="ph-sec"><h3>Coronas ámbar</h3>
    <div class="tabla-wrap" style="max-width:640px;"><table class="tabla-pedidos"><thead><tr><th>Tipo</th><th class="n">Debe haber</th><th class="n">Hay</th><th class="n">Hacer</th></tr></thead>
    <tbody>${filasCor}</tbody></table></div></div>`;
  // Días sin meta (domingo, lunes o sin capturar): todo sale en 0
  const meta = metasData[hoy.getDay()] && DIAS_METAS.some(d=>d[0] === hoy.getDay()) ? metasData[hoy.getDay()] : { pasteles:{}, cupcakes:{} };

  const hacer = (m, sobro) => { const h = Math.max(0, (Number(m)||0) - sobro); return `<span class="ph-hacer${h ? '' : ' ph-cero'}">${h}</span>`; };
  // Pasteles
  let filasP = '';
  PASTEL_SABORES.forEach(n=>{
    const m = meta.pasteles[n] || {};
    const sm = base.pasteles[n + '|mini'] || 0, sc = base.pasteles[n + '|chico'] || 0;
    filasP += `<tr><td class="nombre">${escHtml(n)}</td>
      <td class="n">${Number(m.mini)||0}</td><td class="n">${sm}</td><td class="n">${hacer(m.mini, sm)}</td>
      <td class="n">${Number(m.chico)||0}</td><td class="n">${sc}</td><td class="n">${hacer(m.chico, sc)}</td></tr>`;
  });
  // Cupcakes
  let filasC = '';
  CUPCAKE_SABORES.forEach(n=>{
    const m = Number(meta.cupcakes[n]) || 0;
    const so = base.cupcakes[n + '|'] || 0;
    filasC += `<tr><td class="nombre">${escHtml(n)}</td><td class="n">${m}</td><td class="n">${so}</td><td class="n">${hacer(m, so)}</td></tr>`;
  });
  cont.className = '';
  cont.innerHTML = `
    <div class="ph-sec"><h3>Pasteles</h3>
      ${filasP ? `<div class="tabla-wrap"><table class="tabla-pedidos">
        <thead><tr><th rowspan="2">Sabor</th><th colspan="3" class="c">Mini</th><th colspan="3" class="c">Chico</th></tr>
        <tr><th class="n">Debe haber</th><th class="n">Sobró</th><th class="n">Hacer</th><th class="n">Debe haber</th><th class="n">Sobró</th><th class="n">Hacer</th></tr></thead>
        <tbody>${filasP}</tbody></table></div>` : '<div class="empty" style="padding:16px; text-align:left;">Sin metas de pasteles para hoy.</div>'}
    </div>
    <div class="ph-sec"><h3>Cupcakes</h3>
      ${filasC ? `<div class="tabla-wrap" style="max-width:640px;"><table class="tabla-pedidos">
        <thead><tr><th>Sabor</th><th class="n">Debe haber</th><th class="n">Sobró</th><th class="n">Hacer</th></tr></thead>
        <tbody>${filasC}</tbody></table></div>` : '<div class="empty" style="padding:16px; text-align:left;">Sin metas de cupcakes para hoy.</div>'}
    </div>
    ${bloqueCor}`;

  // Producción: solo lo que hay que hacer (sin debe haber, sobró ni hay)
  if(!puede('metas_editar')){
    const cel = h => `<td class="n"><span class="ph-hacer${h ? '' : ' ph-cero'}">${h}</span></td>`;
    const hx = (m, sob) => Math.max(0, (Number(m)||0) - sob);
    let fp = '', fc = '', fk = '';
    PASTEL_SABORES.forEach(n=>{
      const m = meta.pasteles[n] || {};
      const hm = hx(m.mini, base.pasteles[n + '|mini'] || 0), hc = hx(m.chico, base.pasteles[n + '|chico'] || 0);
      if(hm || hc) fp += `<tr><td class="nombre">${escHtml(n)}</td>${cel(hm)}${cel(hc)}</tr>`;
    });
    CUPCAKE_SABORES.forEach(n=>{
      const h = hx(meta.cupcakes[n], base.cupcakes[n + '|'] || 0);
      if(h) fc += `<tr><td class="nombre">${escHtml(n)}</td>${cel(h)}</tr>`;
    });
    CORONA_TIPOS.forEach(t=>{
      const d = ((cierreHoy.coronas)||{})[t] || {};
      const k = t + '|', mv = x => ((vendHoy[x].coronas)||{})[k]||0;
      const hay = Math.max(0, (base.coronas[k]||0) + (Number(d.in)||0) - mv('v') - Math.max(Number(d.merma)||0, mv('m')) - Math.max(Number(d.cortesia)||0, mv('c')));
      const h = hx(metaCor[t], hay);
      if(h) fk += `<tr><td class="nombre">${t}</td>${cel(h)}</tr>`;
    });
    const nada = '<div class="empty" style="padding:14px; text-align:left;">Nada por hacer.</div>';
    cont.innerHTML = `
      <div class="ph-sec"><h3>Pasteles por hacer</h3>${fp ? `<div class="tabla-wrap" style="max-width:640px;"><table class="tabla-pedidos"><thead><tr><th>Sabor</th><th class="n">Mini</th><th class="n">Chico</th></tr></thead><tbody>${fp}</tbody></table></div>` : nada}</div>
      <div class="ph-sec"><h3>Cupcakes por hacer</h3>${fc ? `<div class="tabla-wrap" style="max-width:640px;"><table class="tabla-pedidos"><thead><tr><th>Sabor</th><th class="n">Hacer</th></tr></thead><tbody>${fc}</tbody></table></div>` : nada}</div>
      <div class="ph-sec"><h3>Coronas ámbar por hacer</h3>${fk ? `<div class="tabla-wrap" style="max-width:640px;"><table class="tabla-pedidos"><thead><tr><th>Tipo</th><th class="n">Hacer</th></tr></thead><tbody>${fk}</tbody></table></div>` : nada}</div>`;
  }
}
async function abrirMetas(cat){
  metasCat = cat;
  ponerTabPH(cat);
  document.getElementById('metas-titulo').textContent = cat === 'pasteles' ? 'Pasteles' : cat === 'coronas' ? 'Coronas ámbar' : 'Cupcakes';
  document.getElementById('metas-sub').textContent = cat === 'coronas' ? 'Cuántas debe haber siempre (aplica todos los días).' : 'Cuántos debe haber cada día. Se capturan una vez y se usan todas las semanas.';
  document.getElementById('metas-msg').className = 'msg';
  try { await cargarMetas(); }
  catch(e){ document.getElementById('metas-contenido').innerHTML = `<div class="empty">No se pudo cargar: ${escHtml(e.message)}</div>`; return; }
  const hoy = new Date().getDay();
  metasDia = cat === 'coronas' ? METAS_GENERAL : (DIAS_METAS.some(d=>d[0] === hoy) ? hoy : 2);
  pintarMetas();
}
function pintarMetas(){
  const dias = document.getElementById('metas-dias');
  dias.innerHTML = '';
  dias.style.display = metasCat === 'coronas' ? 'none' : 'flex';
  if(metasCat !== 'coronas') DIAS_METAS.forEach(([d, nombre])=>{
    const c = document.createElement('div');
    c.className = 'chip' + (d === metasDia ? ' selected' : '');
    c.textContent = nombre;
    c.onclick = ()=>{ leerMetasPantalla(); metasDia = d; pintarMetas(); };
    dias.appendChild(c);
  });
  const m = (metasData[metasDia] || {})[metasCat] || {};
  const v = x => (Number(x) > 0 ? Number(x) : '');
  let filas = '';
  if(metasCat === 'pasteles'){
    PASTEL_SABORES.forEach((n, i)=>{
      const it = m[n] || {};
      filas += `<tr><td class="nombre">${escHtml(n)}</td>
        <td class="c"><input type="number" inputmode="numeric" id="mt_${i}_mini" value="${v(it.mini)}"></td>
        <td class="c"><input type="number" inputmode="numeric" id="mt_${i}_chico" value="${v(it.chico)}"></td></tr>`;
    });
    document.getElementById('metas-contenido').innerHTML = `<div class="tabla-wrap metas-tabla" style="max-width:560px; margin-bottom:14px;"><table class="tabla-pedidos">
      <thead><tr><th>Sabor</th><th class="c">Mini</th><th class="c">Chico</th></tr></thead><tbody>${filas}</tbody></table></div>`;
  } else if(metasCat === 'coronas'){
    CORONA_TIPOS.forEach((n, i)=>{
      filas += `<tr><td class="nombre">${n}</td><td class="c"><input type="number" inputmode="numeric" id="mt_${i}_c" value="${v(m[n])}"></td></tr>`;
    });
    document.getElementById('metas-contenido').innerHTML = `<div class="tabla-wrap metas-tabla" style="max-width:420px; margin-bottom:14px;"><table class="tabla-pedidos">
      <thead><tr><th>Corona</th><th class="c">Debe haber</th></tr></thead><tbody>${filas}</tbody></table></div>`;
  } else {
    CUPCAKE_SABORES.forEach((n, i)=>{
      filas += `<tr><td class="nombre">${escHtml(n)}</td><td class="c"><input type="number" inputmode="numeric" id="mt_${i}_c" value="${v(m[n])}"></td></tr>`;
    });
    document.getElementById('metas-contenido').innerHTML = `<div class="tabla-wrap metas-tabla" style="max-width:420px; margin-bottom:14px;"><table class="tabla-pedidos">
      <thead><tr><th>Sabor</th><th class="c">Debe haber</th></tr></thead><tbody>${filas}</tbody></table></div>`;
  }
}
function leerMetasPantalla(){
  const fila = metasData[metasDia] = metasData[metasDia] || { pasteles:{}, cupcakes:{}, coronas:{} };
  const num = id => { const el = document.getElementById(id); return el ? (parseInt(el.value, 10) || 0) : 0; };
  if(metasCat === 'pasteles'){
    const out = {};
    PASTEL_SABORES.forEach((n, i)=>{ const mi = num(`mt_${i}_mini`), ch = num(`mt_${i}_chico`); if(mi || ch) out[n] = { mini: mi, chico: ch }; });
    fila.pasteles = out;
  } else if(metasCat === 'coronas'){
    const out = {};
    CORONA_TIPOS.forEach((n, i)=>{ const c = num(`mt_${i}_c`); if(c) out[n] = c; });
    fila.coronas = out;
  } else {
    const out = {};
    CUPCAKE_SABORES.forEach((n, i)=>{ const c = num(`mt_${i}_c`); if(c) out[n] = c; });
    fila.cupcakes = out;
  }
}
async function guardarMetas(){
  leerMetasPantalla();
  const msg = document.getElementById('metas-msg'); msg.className = 'msg';
  const btn = document.getElementById('btn-guardar-metas'); btn.disabled = true; btn.textContent = 'Guardando...';
  const filas = [...DIAS_METAS.map(([d])=>d), METAS_GENERAL].filter(d=> metasData[d]).map(d=>({ dia:d, pasteles: metasData[d].pasteles || {}, cupcakes: metasData[d].cupcakes || {}, coronas: metasData[d].coronas || {} }));
  const { data, error } = await sb.from('metas_produccion').upsert(filas, { onConflict: 'dia' }).select();
  btn.disabled = false; btn.textContent = 'Guardar';
  if(error){ msg.className = 'msg err'; msg.textContent = 'No se pudo guardar: ' + error.message; return; }
  if(!data || data.length !== filas.length){ msg.className = 'msg err'; msg.textContent = 'No se guardó. Revisa que ya se haya corrido el SQL de producción.'; return; }
  msg.className = 'msg ok'; msg.textContent = 'Metas guardadas.';
}
