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
  await page.addInitScript(rol => {
    window.__ROL = rol;
    window.__dialogos = [];
    window.confirm = (t) => { window.__dialogos.push(['confirm', t]); return true; };
    window.alert = (t) => { window.__dialogos.push(['alert', t]); };
    window.prompt = (t) => { window.__dialogos.push(['prompt', t]); return window.__respuestaPrompt || '100'; };
    window.__impresiones = [];
    window.open = () => { const doc = { _h:'', open(){}, write(h){ this._h += h; }, close(){ window.__impresiones.push(this._h); } }; return { document: doc }; };
  }, rol);
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
    await paso(page, huella, 'historial', ()=> ev(()=> abrirHistorial()));
    await paso(page, huella, 'resumen', ()=> ev(()=> abrirResumen()));
    for(const t of ['local','pedidos','todo']) await paso(page, huella, 'resumen ' + t, ()=> ev(x=> ponerTabResumen(x), t));
    await paso(page, huella, 'resumen mes', ()=> ev(()=> rangoResumenRapido('mes')));
    await paso(page, huella, 'clientes', ()=> ev(()=> abrirClientes()));
    await paso(page, huella, 'por hacer', ()=> ev(()=> abrirPorHacer()));
    await paso(page, huella, 'metas pasteles', ()=> ev(()=> abrirMetas('pasteles')));
    await paso(page, huella, 'metas cupcakes', ()=> ev(()=> abrirMetas('cupcakes')));
    await paso(page, huella, 'catalogo fotos', ()=> ev(()=> abrirCatalogo()));
    await paso(page, huella, 'catalogo portada agregar foto', async()=>{
      await page.setInputFiles('#cf-pagina-portada input[type=file]', [{ name:'p.png', mimeType:'image/png', buffer:PNG }]);
      await page.waitForFunction(()=> document.querySelectorAll('#cf-pagina-portada .cf-foto').length === 1); });
    await paso(page, huella, 'catalogo pasteles', ()=> page.click('.cf-chips .chip:has-text("Pasteles")'));
    await paso(page, huella, 'catalogo hacer principal', ()=> page.click('#cf-sabores_pasteles-whitevelvet .cf-btn'));
    await paso(page, huella, 'catalogo quitar foto', ()=> page.click('#cf-sabores_pasteles-whitevelvet .cf-quitar >> nth=0'));
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
