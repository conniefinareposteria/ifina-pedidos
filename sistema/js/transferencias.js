// Comprobante de transferencia: cuando el pago es por transferencia hay que subir la foto o PDF del comprobante.
// La función de Supabase "validar-transferencia" lo lee con IA y le pregunta a Banxico si de verdad llegó (sql/041).
// Uso: const c = crearComprobante('id-del-contenedor', ()=> montoEsperado);  c.mostrar(true/false);
//      antes de guardar: const r = await c.revisarAntesDeGuardar(); if(!r) return;   después: c.vincular({ pedido_id | folio | venta_id })

const TR_TEXTO = {
  liquidada:     { icono:'✓', titulo:'Sí llegó', clase:'ok' },
  no_encontrada: { icono:'!', titulo:'Banxico todavía no la encuentra', clase:'aviso' },
  manual:        { icono:'?', titulo:'Revisar a mano', clase:'aviso' },
  otra_cuenta:   { icono:'✕', titulo:'No es a la cuenta del negocio', clase:'mal' },
};

function crearComprobante(contId, montoEsperado){
  const cont = document.getElementById(contId);
  const c = { registro:null, leyendo:false };
  cont.className = 'tr-box';
  cont.innerHTML = `<div class="tr-tit">Comprobante de la transferencia <span>(obligatorio)</span></div>
    <label class="tr-subir"><input type="file" accept="image/*,application/pdf"><span>Subir foto o PDF del comprobante</span></label>
    <div class="tr-res"></div>`;
  const input = cont.querySelector('input'), res = cont.querySelector('.tr-res'), etiqueta = cont.querySelector('.tr-subir span');

  function pintar(){
    const r = c.registro;
    etiqueta.textContent = c.leyendo ? 'Revisando…' : (r ? 'Cambiar comprobante' : 'Subir foto o PDF del comprobante');
    cont.querySelector('.tr-subir').classList.toggle('ocupado', c.leyendo);
    if(c.leyendo){ res.innerHTML = '<div class="tr-card">Leyendo el comprobante y consultando a Banxico…</div>'; return; }
    if(!r){ res.innerHTML = ''; return; }
    if(r.error){ res.innerHTML = `<div class="tr-card mal"><b>✕ No se pudo revisar</b><div>${escHtml(r.error)}</div></div>`; return; }
    const t = r.duplicada ? { icono:'✕', titulo:'Comprobante repetido', clase:'mal' } : (TR_TEXTO[r.estado] || TR_TEXTO.manual);
    const esperado = Number(montoEsperado ? montoEsperado() : 0) || 0;
    const difMonto = r.monto && esperado && Math.abs(Number(r.monto) - esperado) > 0.009;
    const datos = [r.monto ? fmtDinero(r.monto) : '', r.ordenante ? 'de ' + r.ordenante : '', r.banco_emisor_nombre ? '(' + r.banco_emisor_nombre + ')' : ''].filter(Boolean).join(' ');
    res.innerHTML = `<div class="tr-card ${t.clase}">
      <b>${t.icono} ${t.titulo}</b>${datos ? `<div>${escHtml(datos)}</div>` : ''}
      <div class="hint" style="margin:4px 0 0;">${escHtml(r.detalle || '')}${r.clave_rastreo ? ' · Clave: ' + escHtml(r.clave_rastreo) : ''}</div>
      ${difMonto ? `<div class="tr-dif">Ojo: el comprobante es por ${fmtDinero(r.monto)} y aquí se está registrando ${fmtDinero(esperado)}.</div>` : ''}
      ${r.estado === 'no_encontrada' && !r.duplicada ? '<button type="button" class="btn-secundario tr-re">Volver a revisar</button>' : ''}
    </div>`;
    const re = res.querySelector('.tr-re');
    if(re) re.onclick = ()=> llamar({ accion:'reintentar', id: r.id });
  }

  async function llamar(body){
    c.leyendo = true; pintar();
    try{
      const { data, error } = await sb.functions.invoke('validar-transferencia', { body });
      if(error){
        let m = error.message || 'Error';
        try{ const j = await error.context.json(); if(j && j.error) m = j.error; }catch(_){}
        c.registro = { error: m };
      } else c.registro = data && data.error ? { error: data.error } : data;
    }catch(e){ c.registro = { error: String(e.message || e) }; }
    c.leyendo = false; pintar();
  }

  input.addEventListener('change', async ()=>{
    const f = input.files && input.files[0]; input.value = '';
    if(!f) return;
    try{
      const { base64, tipo } = await archivoABase64(f);
      await llamar({ accion:'validar', archivo: base64, tipo });
    }catch(e){ c.registro = { error: String(e.message || e) }; pintar(); }
  });

  c.mostrar = on => { cont.style.display = on ? 'block' : 'none'; };
  c.reset = ()=>{ c.registro = null; c.leyendo = false; pintar(); };
  // Antes de guardar el pago: true si se puede seguir
  c.revisarAntesDeGuardar = async ()=>{
    const r = c.registro;
    if(c.leyendo){ alert('Espera a que termine de revisar el comprobante.'); return false; }
    if(!r){ alert('Sube el comprobante de la transferencia.'); return false; }
    if(r.error){ return confirm('No se pudo revisar el comprobante (' + r.error + ').\n¿Guardar el pago de todas formas? Revísalo a mano en el banco.'); }
    if(r.duplicada){ alert('Ese comprobante ya se usó en otro pago. No se puede usar dos veces.'); return false; }
    if(r.estado === 'otra_cuenta'){ alert('El comprobante es a otra cuenta, no a la del negocio.'); return false; }
    const esperado = Number(montoEsperado ? montoEsperado() : 0) || 0;
    if(r.monto && esperado && Math.abs(Number(r.monto) - esperado) > 0.009 &&
       !confirm(`El comprobante es por ${fmtDinero(r.monto)} y se está registrando ${fmtDinero(esperado)}. ¿Seguir así?`)) return false;
    if(r.estado === 'no_encontrada') return confirm('Banxico todavía no encuentra esta transferencia.\n¿Guardar el pago de todas formas? Quedará pendiente y se puede volver a revisar.');
    return true;
  };
  c.vincular = async ({ pedido_id = null, venta_id = null, folio = null } = {})=>{
    const r = c.registro;
    if(!r || !r.id || r.duplicada) return;
    await sb.rpc('vincular_transferencia', { p_id: r.id, p_pedido_id: pedido_id, p_venta_id: venta_id, p_folio: folio });
  };
  pintar();
  return c;
}

// Foto → JPEG más ligero (máx. 1600 px); PDF tal cual
function archivoABase64(f){
  return new Promise((resolve, reject)=>{
    const esPdf = /pdf/i.test(f.type) || /\.pdf$/i.test(f.name);
    if(f.size > 15 * 1024 * 1024) return reject(new Error('El archivo es muy pesado (máx. 15 MB).'));
    const lector = new FileReader();
    lector.onerror = ()=> reject(new Error('No se pudo abrir el archivo.'));
    if(esPdf){
      lector.onload = ()=> resolve({ base64: String(lector.result).split(',')[1], tipo:'application/pdf' });
      lector.readAsDataURL(f); return;
    }
    lector.onload = ()=>{
      const img = new Image();
      img.onload = ()=>{
        const k = Math.min(1, 1600 / Math.max(img.width, img.height));
        const cv = document.createElement('canvas');
        cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
        cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
        resolve({ base64: cv.toDataURL('image/jpeg', 0.85).split(',')[1], tipo:'image/jpeg' });
      };
      img.onerror = ()=> reject(new Error('No se pudo leer la imagen.'));
      img.src = lector.result;
    };
    lector.readAsDataURL(f);
  });
}

// ---------- Resumen: revisar las transferencias del último mes otra vez con Banxico (sin gastar en IA) ----------
async function cargarTransferencias(){
  const cont = document.getElementById('tr-lista'); if(!cont) return;
  const desde = new Date(Date.now() - 31 * 864e5).toISOString().slice(0, 10);
  const { data, error } = await sb.from('transferencias').select('*').gte('created_at', desde).order('created_at', { ascending:false }).limit(300);
  if(error){ cont.innerHTML = `<div class="msg err" style="display:block;">No se pudieron cargar: ${escHtml(error.message)}</div>`; return; }
  const filas = data || [];
  const cuenta = e => filas.filter(t=> t.estado === e && !t.duplicada).length;
  const revisar = filas.filter(t=> t.estado !== 'liquidada');
  cont.innerHTML = `<div class="hint" style="margin:0 0 8px;">Último mes: <b>${cuenta('liquidada')}</b> confirmadas · <b>${cuenta('no_encontrada')}</b> sin encontrar · <b>${cuenta('manual')}</b> para revisar a mano · <b>${cuenta('otra_cuenta')}</b> a otra cuenta</div>`
    + (revisar.length ? `<table class="tr-tabla"><thead><tr><th>Fecha</th><th>Monto</th><th>Quién pagó</th><th>Estado</th><th>Pago</th></tr></thead><tbody>${revisar.map(t=>
      `<tr><td>${escHtml(t.fecha || '')}</td><td>${t.monto ? fmtDinero(t.monto) : '—'}</td><td>${escHtml(t.ordenante || '—')}<small>${escHtml(t.banco_emisor_nombre || '')}</small></td>
      <td><b>${escHtml((TR_TEXTO[t.estado] || TR_TEXTO.manual).titulo)}</b><small>${escHtml(t.detalle || '')}</small></td>
      <td>${t.venta_id ? 'Ticket ' + folioLoc(t.venta_id) : t.pedido_id ? 'Pedido' : 'Sin ligar'}</td></tr>`).join('')}</tbody></table>`
      : '<div class="empty">Todas las transferencias del último mes están confirmadas.</div>');
}
async function revisarTransferenciasMes(){
  const btn = document.getElementById('tr-revisar'), msg = document.getElementById('tr-msg');
  btn.disabled = true; btn.textContent = 'Revisando con Banxico…'; msg.className = 'msg';
  const { data, error } = await sb.functions.invoke('validar-transferencia', { body:{ accion:'revisar' } });
  btn.disabled = false; btn.textContent = 'Revisar transferencias del mes';
  if(error){ msg.className = 'msg err'; msg.textContent = 'No se pudo revisar: ' + (error.message || ''); return; }
  const n = (data && data.cambios || []).length;
  msg.className = 'msg ok';
  msg.textContent = `Se revisaron ${data.revisadas || 0}. ` + (n ? `${n} cambiaron de estado (abajo).` : 'Ninguna cambió.');
  cargarTransferencias();
}
