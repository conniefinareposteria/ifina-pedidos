// Recorrido automático del sistema con Supabase simulado.
// Uso:  node pruebas/recorrido.js [ruta/a/sistema/index.html] [salida.json]
// Abre el sistema como colaborador, directora y producción; recorre las pantallas y flujos
// principales y guarda una "huella" (texto en pantalla + todo lo que se mandó a Supabase y a
// la impresora). Para revisar un cambio: correrlo antes y después y comparar con comparar.js.
const path = require('path');
const fs = require('fs');
const { chromium } = require('playwright');

const RAIZ = path.resolve(__dirname, '..');
const PAGINA = path.resolve(process.argv[2] || path.join(RAIZ, 'sistema/index.html'));
const SALIDA = process.argv[3] || path.join(__dirname, 'huella.json');
const STUB = path.join(__dirname, 'supabase-simulado.js');
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAIAAAAmkwkpAAAAEElEQVR4nGM40ZMHRwzEcQDhMhwh1+Dl5gAAAABJRU5ErkJggg==', 'base64');
const AHORA = new Date('2026-10-28T12:30:00-07:00');

async function abrir(browser, rol){
  const ctx = await browser.newContext({ viewport:{ width:1280, height:900 }, timezoneId:'America/Mazatlan', locale:'es-MX' });
  const page = await ctx.newPage();
  page.setDefaultTimeout(5000);
  await page.clock.setFixedTime(AHORA);
  const huella = { errores: [], pasos: [] };
  Object.defineProperty(huella, 'rol', { value: rol, enumerable: false });
  page.on('pageerror', e => huella.errores.push(e.message));
  page.on('console', m => { if(m.type() === 'error') huella.errores.push('console: ' + m.text()); });
  await page.addInitScript(([rol, lat]) => {
    window.__ROL = rol;
    window.__LATENCIA = lat;
    window.__dialogos = [];
    window.confirm = (t) => { window.__dialogos.push(['confirm', t]); return true; };
    window.alert = (t) => { window.__dialogos.push(['alert', t]); };
    window.prompt = (t) => { window.__dialogos.push(['prompt', t]); return window.__respuestaPrompt || '100'; };
    window.__impresiones = [];
    window.open = () => { const doc = { _h:'', open(){}, write(h){ this._h += h; }, close(){ window.__impresiones.push(this._h); } }; return { document: doc }; };
  }, [rol, Number(process.env.LATENCIA) || 0]);
  await page.addInitScript({ path: path.join(__dirname, 'finanzas-datos.js') });
  // Simula el iPad (Safari): no dispara "change" cuando el valor final lo acomodó el código (números con comas)
  await page.addInitScript(() => {
    const raw = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
    window.addEventListener('change', e => { const t = e.target; if(e.isTrusted && t && t.dataset && t.dataset.num && raw.get.call(t).includes(',')) e.stopImmediatePropagation(); }, true);
  });
  await page.route('https://cdn.jsdelivr.net/**', r => r.fulfill({ status:200, contentType:'application/javascript', path: STUB }));
  await page.route('https://fonts.googleapis.com/**', r => r.fulfill({ status:200, contentType:'text/css', body:'' }));
  await page.route('https://fotos.prueba/**', r => r.fulfill({ status:200, contentType:'image/png', body: PNG }));
  await page.route('https://fonts.gstatic.com/**', r => r.fulfill({ status:200, body:'' }));
  await page.route('https://192.168.1.30/**', r => {
    huella.pasos.push({ paso: '(impresora epson)', xml: r.request().postData() });
    r.fulfill({ status:200, contentType:'text/xml', body:'<response success="true" code=""/>' });
  });
  await page.goto('file://' + PAGINA);
  await page.waitForTimeout(700);
  return { page, ctx, huella };
}

async function foto(page, huella, nombre){
  await page.waitForTimeout(250);
  const d = await page.evaluate(() => {
    const vis = el => el && el.offsetParent !== null;
    const vista = document.querySelector('.view.active');
    const modales = [...document.querySelectorAll('.ep-hoja.on, #cor-hoja.on')].map(m => m.innerText);
    const log = window.__log.splice(0);
    const dialogos = window.__dialogos.splice(0);
    const impresiones = window.__impresiones.splice(0);
    return { vista: vista ? vista.id : null, texto: vista ? vista.innerText : '', modales, log, dialogos, impresiones,
      nav: [...document.querySelectorAll('nav button')].filter(vis).map(b => b.innerText) };
  });
  huella.pasos.push({ paso: nombre, ...d });
  // Con CAPTURAS=carpeta también guarda una foto de cada paso (para comparar el diseño)
  if(process.env.CAPTURAS){
    fs.mkdirSync(process.env.CAPTURAS, { recursive: true });
    await page.screenshot({ path: path.join(process.env.CAPTURAS, `${huella.rol}-${String(huella.pasos.length).padStart(3,'0')}.png`), fullPage: true });
  }
}

async function paso(page, huella, nombre, fn){
  try { await fn(); }
  catch(e){ huella.pasos.push({ paso: nombre, fallo: String(e.message).split('\n')[0] }); return; }
  await foto(page, huella, nombre);
}

(async () => {
  const browser = await chromium.launch();
  const resultado = {};

  // ---------------- COLABORADOR (local) ----------------
  {
    const { page, ctx, huella } = await abrir(browser, 'colaborador');
    const ev = (f, ...a) => page.evaluate(f, ...a);
    await paso(page, huella, 'inicio', async()=>{});
    await paso(page, huella, 'pos abrir', ()=> ev(()=> abrirPOS()));
    await paso(page, huella, 'pos cupcakes', ()=> page.click('.pos-tab[data-t=cupcakes]'));
    await paso(page, huella, 'pos agrega 2 cupcakes', async()=>{ await page.click('#pos-contenido .pos-card >> nth=0'); await page.click('#pos-contenido .pos-card >> nth=0'); });
    await paso(page, huella, 'pos descuento 10%', ()=> page.click('#pos-pcts button[data-p="10"]'));
    await paso(page, huella, 'pos efectivo recibe 200', async()=>{ await page.click('#pos-metodos .pos-chip[data-m=efectivo]'); await page.fill('#pos-recibe','200'); });
    await paso(page, huella, 'pos cobrar', ()=> page.click('#pos-cobrar'));
    await paso(page, huella, 'pos imprimir ticket', ()=> ev(()=> responderTicket(true)));
    await paso(page, huella, 'pos pasteles', ()=> page.click('.pos-tab[data-t=pasteles]'));
    await paso(page, huella, 'pos pastel pide corona', ()=> page.click('#pos-contenido .pos-pastel .pos-tam button >> nth=0'));
    await paso(page, huella, 'pos elige corona', ()=> page.click('#cor-opciones button >> nth=0'));
    await paso(page, huella, 'pos cortesia modo', ()=> ev(()=> alternarModoCortesia()));
    await paso(page, huella, 'pos pago diferido', async()=>{ await ev(()=> alternarModoCortesia()); await page.click('#pos-btn-diferido'); });
    await paso(page, huella, 'pos diferido montos', async()=>{ const t = await ev(()=> leerNum('pos-total')); await page.fill('#pos-div-efectivo','100'); await page.fill('#pos-div-tarjeta', String(t - 100)); });
    await paso(page, huella, 'pos cobrar diferido', ()=> page.click('#pos-cobrar'));
    await paso(page, huella, 'pos ticket diferido', ()=> ev(()=> responderTicket(true)));
    await paso(page, huella, 'pos merma', async()=>{ await page.click('.pos-tab[data-t=individuales]'); await page.click('#pos-contenido .pos-card >> nth=0'); await page.click('#pos-btn-merma'); });
    await paso(page, huella, 'pos ticket merma', ()=> ev(()=> responderTicket(true)));
    await paso(page, huella, 'pos pedidos de hoy', ()=> page.click('.pos-tab[data-t=pedidos]'));
    await paso(page, huella, 'pos pedido sin corona', ()=> page.click('#pos-contenido .pos-prow >> nth=1'));
    await paso(page, huella, 'pos pedido corona si', ()=> page.click('#cor-opciones button >> nth=0'));
    await paso(page, huella, 'pos entregar pedido', async()=>{ await page.click('#pos-metodos .pos-chip[data-m=efectivo]'); await page.click('#pos-cobrar'); });
    await paso(page, huella, 'pos no ticket', ()=> ev(()=> responderTicket(false)));
    await paso(page, huella, 'pos buscar pedido', async()=>{ await page.fill('#pos-buscar','diego'); await page.waitForTimeout(500); });
    await paso(page, huella, 'pos anticipo', async()=>{ await page.click('#pos-contenido .pos-prow >> nth=0'); await ev(()=>{ window.__respuestaPrompt = '200'; }); await page.click('#pos-btn-anticipo'); await page.click('#pos-metodos .pos-chip[data-m=transferencia]'); });
    await paso(page, huella, 'pos cobrar anticipo', ()=> page.click('#pos-cobrar'));
    await paso(page, huella, 'pos ticket anticipo', ()=> ev(()=> responderTicket(true)));
    await paso(page, huella, 'pos editar pedido', async()=>{ await page.fill('#pos-buscar',''); await page.waitForTimeout(400); await page.click('#pos-contenido .pos-editar >> nth=0'); });
    await paso(page, huella, 'pos editar a domicilio', ()=> ev(()=> accionPedidoPOS('domicilio')));
    await paso(page, huella, 'pos resumen del dia', ()=> ev(()=> abrirResumenDiaPOS()));
    await paso(page, huella, 'productos del dia', async()=>{ await ev(()=> cerrarModal('rd')); await ev(()=> abrirProductosDia()); });
    await paso(page, huella, 'mermas y cortesia', ()=> ev(()=> abrirMermaCortesia()));
    await paso(page, huella, 'imprimir mermas y cortesia', ()=> ev(()=> imprimirResumenMC()));
    for(const sec of ['cupcakes','individuales','panques','coronas']){
      await paso(page, huella, `seccion ${sec}`, async()=>{ await ev(()=> cerrarModal('mc')); await ev(s=> abrirSeccion(s), sec); });
      await paso(page, huella, `seccion ${sec} inicio`, ()=> ev(()=> abrirModoSeccion('inicio')));
      await paso(page, huella, `seccion ${sec} cierre`, ()=> ev(()=> { abrirSeccion(seccionActual); return abrirModoSeccion('cierre'); }));
    }
    await paso(page, huella, 'cupcakes guardar inicio', async()=>{ await ev(()=> abrirSeccion('cupcakes')); await ev(()=> abrirModoSeccion('inicio')); await page.fill('#f_0_in_0','10'); await ev(()=> guardarSeccion(false)); });
    await paso(page, huella, 'buscador seccion', async()=>{ await page.fill('#seccion-buscar','pis'); await ev(()=> filtrarSeccion()); });
    await paso(page, huella, 'seccion pasteles inicio', async()=>{ await ev(()=> abrirSeccion('pasteles')); await ev(()=> abrirModoSeccionPasteles('inicio')); });
    await paso(page, huella, 'seccion pasteles cierre', async()=>{ await ev(()=> abrirSeccion('pasteles')); await ev(()=> abrirModoSeccionPasteles('cierre')); });
    await paso(page, huella, 'corte de caja', ()=> ev(()=> abrirSeccion('caja')));
    await paso(page, huella, 'corte de caja guardar', async()=>{ await page.waitForTimeout(300); await ev(()=> guardarSeccion(false)); });
    await paso(page, huella, 'nuevo pedido', ()=> ev(()=> irNuevoPedido()));
    resultado.colaborador = huella;
    await ctx.close();
  }

  // ---------------- DIRECTORA ----------------
  {
    const { page, ctx, huella } = await abrir(browser, 'director');
    const ev = (f, ...a) => page.evaluate(f, ...a);
    await paso(page, huella, 'pedidos', async()=>{});
    await paso(page, huella, 'pedidos imprimir dia', ()=> page.click('#view-lista button:has-text("Imprimir") >> nth=0'));
    await paso(page, huella, 'pedidos editar', ()=> page.click('#view-lista button:has-text("Editar") >> nth=0'));
    await paso(page, huella, 'pedidos ingresar pago', ()=> ev(()=> accionRegistrarPago()));
    await paso(page, huella, 'pedidos eliminados', async()=>{ await ev(()=> cerrarModal('pg')); await ev(()=> abrirEliminados()); });
    await paso(page, huella, 'varios productos: pastel', async()=>{ await ev(()=> switchView('nuevo')); await page.fill('#cliente-busqueda','ana'); await page.waitForTimeout(400); await page.click('.resultado-cliente >> nth=0');
      await page.click('#categoria-chips [data-cat=pastel]'); await page.selectOption('#sel-tamano','chico'); await page.selectOption('#sel-sabor-pastel','chocolate'); await page.click('#corona-si-no-chips [data-corona=no]'); });
    await paso(page, huella, 'varios productos: agregar otro', ()=> page.click('#btn-agregar-producto'));
    await paso(page, huella, 'varios productos: cupcakes', async()=>{ await page.click('#categoria-chips [data-cat=cupcake]'); await page.click('#cart-cupcake .qty-stepper button:has-text("+") >> nth=0'); await page.click('#cart-cupcake .qty-stepper button:has-text("+") >> nth=0'); });
    await paso(page, huella, 'varios productos: guardar', async()=>{ await page.click('#entrega-chips [data-entrega=recoger]'); await page.fill('#fecha_entrega','2026-10-30');
      await page.click('#pago-si-no-chips [data-pagosn=si]'); await page.click('#metodo-pago-chips [data-metodo=efectivo]'); await page.fill('#anticipo','300'); await page.click('#btn-guardar'); await page.waitForTimeout(400); });
    await paso(page, huella, 'editar pedido en formulario', async()=>{ await ev(()=> switchView('lista')); await page.waitForTimeout(400); await ev(()=>{ elegirAccionPedido(7); accionEditarPedido(); }); await page.waitForTimeout(400); });
    await paso(page, huella, 'editar cambia corona a color', async()=>{ await page.click('#corona-tipo-chips [data-coronatipo="color"]'); await page.fill('#corona-color','rosa'); });
    await paso(page, huella, 'editar guardar cambios', async()=>{ await page.click('#btn-guardar'); await page.waitForTimeout(400); });
    await paso(page, huella, 'editar pedido domicilio (cupcakes)', async()=>{ await ev(()=>{ elegirAccionPedido(9); accionEditarPedido(); }); await page.waitForTimeout(400); });
    await paso(page, huella, 'editar guardar sin cambios', async()=>{ await page.click('#btn-guardar'); await page.waitForTimeout(400); });
    await paso(page, huella, 'historial', ()=> ev(()=> abrirHistorial()));
    await paso(page, huella, 'historial detalle de ayer', async()=>{ await ev(()=> abrirDetalleDia(fechaStrDesdeDate(new Date(Date.now() - 86400000)))); await page.waitForTimeout(200); });
    await paso(page, huella, 'resumen', ()=> ev(()=> abrirResumen()));
    for(const t of ['local','pedidos','todo']) await paso(page, huella, 'resumen ' + t, ()=> ev(x=> ponerTabResumen(x), t));
    await paso(page, huella, 'resumen mes', ()=> ev(()=> rangoResumenRapido('mes')));
    await paso(page, huella, 'clientes', ()=> ev(()=> abrirClientes()));
    await paso(page, huella, 'por hacer', ()=> ev(()=> abrirPorHacer()));
    await paso(page, huella, 'metas pasteles', ()=> ev(()=> abrirMetas('pasteles')));
    await paso(page, huella, 'metas cupcakes', ()=> ev(()=> abrirMetas('cupcakes')));
    await paso(page, huella, 'finanzas productos', ()=> ev(()=> abrirFinanzas()));
    const idWV = await page.evaluate(()=> fin.recetas.find(r=> r.nombre === 'White Velvet' && r.tamano === 'mediano').id);
    await paso(page, huella, 'finanzas abrir white velvet mediano', ()=> page.click(`.fin-fila[onclick="finAbrir(${idWV})"]`));
    await paso(page, huella, 'finanzas cambiar merengue', async()=>{ const id = await page.evaluate(w=> fin.partes.find(p=> p.receta_id === w && recPorId(p.subreceta_id) && recPorId(p.subreceta_id).nombre === 'Merengue tradicional').id, idWV); await page.fill(`[data-k="parte-${id}"]`,'900'); await page.press(`[data-k="parte-${id}"]`,'Tab'); await page.waitForTimeout(250); });
    await paso(page, huella, 'finanzas elegir caja', ()=> page.click('.fe-agregar .chip:has-text("+ Caja")'));
    await paso(page, huella, 'finanzas agregar caja grande', async()=>{ await page.click('.fe-op:has-text("Caja grande")'); await page.waitForTimeout(250); });
    await paso(page, huella, 'finanzas quitar caja grande', async()=>{ const id = await page.evaluate(w=> fin.partes.filter(p=> p.receta_id === w && insPorId(p.insumo_id) && insPorId(p.insumo_id).nombre.startsWith('Caja grande')).pop().id, idWV); await page.click(`.fe-parte:has([data-k="parte-${id}"]) .ins-quitar`); await page.waitForTimeout(250); });
    await paso(page, huella, 'finanzas crear decoracion', async()=>{ await page.click('.fe-agregar .chip:has-text("+ Decoración")'); await page.click('.fe-sel-pie .link-agregar'); await page.fill('#fe-crear-nombre','Perlas doradas'); await page.selectOption('#fe-crear-unidad','g'); await page.fill('#fe-crear-cant','100'); await page.fill('#fe-crear-precio','60'); await page.click('.fe-crear .primary'); await page.waitForTimeout(300); });
    await paso(page, huella, 'finanzas ver merengue', ()=> page.click('.fe-item a:has-text("Merengue tradicional")'));
    await paso(page, huella, 'finanzas regresar', ()=> page.click('#view-finanzas .link-accion'));
    await paso(page, huella, 'finanzas precio a mano', async()=>{ await page.selectOption('[data-k="fe-precio-cat"]',''); await page.waitForTimeout(200); await page.fill('[data-k="fe-precio"]','850'); await page.press('[data-k="fe-precio"]','Tab'); await page.waitForTimeout(250); });
    await paso(page, huella, 'finanzas precio del catalogo', async()=>{ await page.selectOption('[data-k="fe-precio-cat"]','tamanos_pastel:grande'); await page.waitForTimeout(250); });
    await paso(page, huella, 'finanzas cambiar tamaño', async()=>{ await page.selectOption('[data-k="fe-tamano"]','mediano'); await page.waitForTimeout(250); });
    await paso(page, huella, 'finanzas crear mini', async()=>{ await page.click('.cf-chips .chip:has-text("Productos")'); const id = await page.evaluate(()=> fin.recetas.find(r=> r.nombre === 'White Velvet' && r.tamano === 'chico').id); await page.click(`.fin-fila[onclick="finAbrir(${id})"]`); await page.click('.fe-acciones .btn-secundario:has-text("Crear en otro tamaño")'); await page.selectOption('[data-k="otro-tam"]','mini'); await page.waitForTimeout(150); await page.click('.fe-otro .primary'); await page.waitForTimeout(400); });
    await paso(page, huella, 'finanzas ver pan mini', ()=> page.click('.fe-item a:has-text("Pan de vainilla mini")'));
    await paso(page, huella, 'finanzas sin costear', async()=>{ await page.click('.cf-chips .chip:has-text("Productos")'); await page.click('.fin-pend-lista .chip >> nth=0'); await page.waitForTimeout(300); });
    await paso(page, huella, 'finanzas subreceta por piezas', async()=>{ await page.click('.cf-chips .chip:has-text("Subrecetas")'); await page.click('#view-finanzas .btn-secundario:has-text("Nuevo pan")'); await page.waitForTimeout(250); await page.fill('[data-k="fe-nombre"]','Plancha cuchareables'); await page.press('[data-k="fe-nombre"]','Tab'); await page.waitForTimeout(150); await page.fill('[data-k="fe-rinde"]','30'); await page.press('[data-k="fe-rinde"]','Tab'); await page.waitForTimeout(200);
      await page.click('.fe-agregar .chip:has-text("+ Masa")'); await page.click('.fe-op:has-text("Mezcla de pan de vainilla")'); await page.fill('.fe-parte input','1300'); await page.press('.fe-parte input','Tab'); await page.waitForTimeout(250); });
    await paso(page, huella, 'finanzas desglose', async()=>{ await page.click('.fe-desglose summary'); await page.waitForTimeout(100); });
    await paso(page, huella, 'finanzas panes por tamaño', async()=>{ await page.click('.cf-chips .chip:has-text("Subrecetas")'); await page.click('.fin-familia:has-text("Pan de chocolate") .link-agregar'); await page.selectOption('[data-k="tp-tam"]','mini'); await page.waitForTimeout(150); await page.fill('[data-k="tp-val"]','320'); await page.press('[data-k="tp-val"]','Tab'); await page.click('.fin-familia:has-text("Pan de chocolate") .fe-otro .primary'); await page.waitForTimeout(300); });
    await paso(page, huella, 'finanzas gramos de pan', async()=>{ const f = '.fin-familia:has-text("Pan de vainilla") .fe-cant input >> nth=1'; await page.fill(f,'460'); await page.press(f,'Tab'); await page.waitForTimeout(250); });
    await paso(page, huella, 'finanzas subrecetas', ()=> page.click('.cf-chips .chip:has-text("Subrecetas")'));
    await paso(page, huella, 'finanzas insumos', ()=> page.click('.cf-chips .chip:has-text("Insumos")'));
    await paso(page, huella, 'finanzas cambiar precio huevo', async()=>{ const f = await page.evaluate(()=> '#insumos-filas-insumo tr[data-id="' + fin.insumos.find(i=> i.nombre === 'Huevo').id + '"] .ins-precio-in'); await page.fill(f,'1100'); await page.press(f,'Tab'); await page.waitForTimeout(250); });
    await paso(page, huella, 'finanzas agregar insumo', async()=>{ await page.click('#view-finanzas .btn-secundario >> nth=0'); await page.fill('#insumos-filas-insumo tr[data-id="nuevo"] .ins-nombre','Fresa congelada'); await page.press('#insumos-filas-insumo tr[data-id="nuevo"] .ins-nombre','Tab'); await page.waitForTimeout(250); });
    await paso(page, huella, 'finanzas empaques', ()=> page.click('.cf-chips .chip:has-text("Empaques")'));
    await paso(page, huella, 'finanzas agregar caja', async()=>{ await page.click('#view-finanzas .btn-secundario >> nth=0'); const f='#insumos-filas-material-Caja tr:last-child'; await page.fill(f+' .ins-nombre','Caja tres leches'); await page.press(f+' .ins-nombre','Tab'); await page.waitForTimeout(250); await page.fill(f+' .ins-precio-in','19.5'); await page.press(f+' .ins-precio-in','Tab'); await page.waitForTimeout(300); });
    await paso(page, huella, 'finanzas costos fijos', ()=> page.click('.cf-chips .chip:has-text("Costos fijos")'));
    await paso(page, huella, 'finanzas agregar renta', async()=>{ await page.click('#view-finanzas .btn-secundario >> nth=0'); await page.waitForTimeout(150); const k = await page.evaluate(()=> fin.fijos[fin.fijos.length - 1].id); await page.fill(`[data-k="fij-${k}-c"]`,'Renta'); await page.fill(`[data-k="fij-${k}-m"]`,'18000'); await page.press(`[data-k="fij-${k}-m"]`,'Tab'); await page.waitForTimeout(250); });
    await paso(page, huella, 'finanzas nomina con enter', async()=>{ const k = await page.evaluate(()=> fin.fijos.find(f=> f.detalle === 'Connie').id); const f = `[data-k="fij-${k}-m"]`; await page.click(f); await page.fill(f,'40000'); await page.waitForTimeout(100); await page.press(f,'Enter'); await page.waitForTimeout(300); });
    await paso(page, huella, 'finanzas gasto nuevo con teclado', async()=>{ await page.click('#view-finanzas .btn-secundario:has-text("Agregar gasto fijo")'); await page.waitForTimeout(250);
      await page.keyboard.type('Nomina'); await page.keyboard.press('Tab'); await page.waitForTimeout(200); await page.keyboard.type('Pablo'); await page.keyboard.press('Tab'); await page.waitForTimeout(200);
      await page.keyboard.type('30000'); await page.keyboard.press('Enter'); await page.waitForTimeout(300); });
    await paso(page, huella, 'finanzas boton guardar', async()=>{ const k = await page.evaluate(()=> fin.fijos.find(f=> f.concepto === 'Luz').id); const f = `[data-k="fij-${k}-m"]`; await page.click(f); await page.fill(f,'1800'); await page.waitForTimeout(100); await page.click('#fin-guardar'); await page.waitForTimeout(300); });
    await paso(page, huella, 'finanzas venta promedio a mano', async()=>{ await page.fill('[data-k="venta-manual"]','350000'); await page.press('[data-k="venta-manual"]','Enter'); await page.waitForTimeout(300); });
    await paso(page, huella, 'finanzas mover gasto', async()=>{ await page.click('#fin-fijos tr:nth-child(2) .fin-mover button[aria-label="Subir"]'); await page.waitForTimeout(300); });
    await paso(page, huella, 'finanzas mover caja', async()=>{ await page.click('.cf-chips .chip:has-text("Empaques")'); await page.click('#insumos-filas-material-Caja tr:nth-child(3) .fin-mover button[aria-label="Subir"]'); await page.waitForTimeout(300); await page.click('.cf-chips .chip:has-text("Costos fijos")'); });
    await paso(page, huella, 'finanzas calculadora', ()=> page.click('.cf-chips .chip:has-text("Calculadora")'));
    await paso(page, huella, 'finanzas calculadora armar', async()=>{
      await page.click('.fe-agregar .chip:has-text("+ Pan")'); await page.click('.fe-op:has-text("Pan de vainilla chico")'); await page.fill('.fe-parte input','3'); await page.press('.fe-parte input','Tab'); await page.waitForTimeout(150);
      await page.click('.fe-agregar .chip:has-text("+ Caja")'); await page.click('.fe-op:has-text("Caja chica")'); await page.waitForTimeout(150);
      await page.selectOption('[data-k="fe-tamano"]','grande'); await page.waitForTimeout(150); });
    await paso(page, huella, 'finanzas calculadora guardar', async()=>{ await page.click('.fe-acciones .primary'); await page.waitForTimeout(300); });
    await paso(page, huella, 'catalogo fotos', ()=> ev(()=> abrirCatalogo()));
    await paso(page, huella, 'catalogo portada agregar foto', async()=>{
      await page.setInputFiles('#cf-pagina-portada input[type=file]', [{ name:'p.png', mimeType:'image/png', buffer:PNG }]);
      await page.waitForFunction(()=> document.querySelectorAll('#cf-pagina-portada .cf-foto').length === 1); });
    await paso(page, huella, 'catalogo pasteles', ()=> page.click('.cf-chips .chip:has-text("Pasteles")'));
    await paso(page, huella, 'catalogo arrastrar foto', async()=>{
      const fotos = page.locator('#cf-sabores_pasteles-whitevelvet .cf-foto');
      await fotos.nth(0).scrollIntoViewIfNeeded();
      const a = await fotos.nth(1).boundingBox(), b = await fotos.nth(0).boundingBox();
      await page.mouse.move(a.x + a.width/2, a.y + a.height/2); await page.mouse.down(); await page.waitForTimeout(500);
      await page.mouse.move(b.x + 20, b.y + b.height/2, { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(300); });
    await paso(page, huella, 'catalogo guardar detalle', async()=>{
      await page.fill('#cf-sabores_pasteles-chocolate-pan', 'Chocolate'); await page.fill('#cf-sabores_pasteles-chocolate-betun', 'Ganache');
      await page.click('#cf-sabores_pasteles-chocolate-corona .chip[data-v=si]'); await page.click('#cf-sabores_pasteles-chocolate .cf-guardar'); });
    await paso(page, huella, 'catalogo hacer principal', ()=> page.click('#cf-sabores_pasteles-whitevelvet .cf-btn'));
    await paso(page, huella, 'catalogo quitar foto', ()=> page.click('#cf-sabores_pasteles-whitevelvet .cf-quitar >> nth=0'));
    await paso(page, huella, 'catalogo ocultar producto', ()=> page.click('#cf-sabores_pasteles-chocolate .cf-estado button'));
    await paso(page, huella, 'catalogo cuchareables (uno oculto)', ()=> page.click('.cf-chips .chip:has-text("Cuchareables")'));
    await paso(page, huella, 'catalogo volver a mostrar', ()=> page.click('#cf-individuales-carlotalimon .cf-estado button'));
    await paso(page, huella, 'catalogo cupcakes', ()=> page.click('.cf-chips .chip:has-text("Cupcakes")'));
    await paso(page, huella, 'catalogo agregar 2 fotos', async()=>{
      await page.setInputFiles('#cf-sabores_cupcakes-limon input[type=file]', [{ name:'a.png', mimeType:'image/png', buffer:PNG }, { name:'b.png', mimeType:'image/png', buffer:PNG }]);
      await page.waitForFunction(()=> document.querySelectorAll('#cf-sabores_cupcakes-limon .cf-foto').length === 2); });
    await paso(page, huella, 'nuevo pedido', ()=> ev(()=> switchView('nuevo')));
    resultado.director = huella;
    await ctx.close();
  }

  // ---------------- PRODUCCIÓN ----------------
  {
    const { page, ctx, huella } = await abrir(browser, 'produccion');
    const ev = (f, ...a) => page.evaluate(f, ...a);
    await paso(page, huella, 'por hacer', async()=>{});
    await paso(page, huella, 'pedidos', ()=> ev(()=> switchView('lista')));
    resultado.produccion = huella;
    await ctx.close();
  }

  await browser.close();
  fs.writeFileSync(SALIDA, JSON.stringify(resultado, null, 1));
  const n = Object.values(resultado).reduce((a, h) => a + h.pasos.length, 0);
  const err = Object.values(resultado).reduce((a, h) => a + h.errores.length, 0);
  const fallos = Object.values(resultado).reduce((a, h) => a + h.pasos.filter(p => p.fallo).length, 0);
  console.log(`Recorrido listo: ${n} pasos, ${fallos} pasos que no se pudieron hacer, ${err} errores de JavaScript → ${SALIDA}`);
})();
