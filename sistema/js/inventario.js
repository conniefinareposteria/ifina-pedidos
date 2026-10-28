// Inventario: existencias que se arrastran de un día a otro (Exis + IN − vendido − merma − cortesía).

// ---------- Existencias que se arrastran de un día a otro ----------
// Lo que queda al cierre = Exis + IN − vendido en el punto de venta − merma − cortesía.
// El Exis de un día es lo que quedó en el último día registrado (no importa qué día de la semana sea).
const INV_CATS = ['cupcakes','individuales','panques','pasteles','coronas'];
function invItems(cat){ return cat==='cupcakes' ? CUPCAKE_SABORES : cat==='individuales' ? INDIVIDUAL_PRODUCTOS : cat==='panques' ? PANQUE_PRODUCTOS : cat==='coronas' ? CORONA_TIPOS : PASTEL_SABORES; }
function invKeys(cat){
  const out = [];
  invItems(cat).forEach(n=>{ if(cat==='pasteles'){ out.push([n,'mini']); out.push([n,'chico']); } else out.push([n,'']); });
  return out;
}
function invDato(dia, cat, n, tam){
  const it = ((dia && dia[cat]) || {})[n];
  if(!it) return {};
  return tam ? (it[tam] || {}) : it;
}
// clase: 'v' = vendido, 'm' = merma, 'c' = cortesía (todo sale del punto de venta)
function claseLinea(it){ return it.merma ? 'm' : it.cortesia ? 'c' : 'v'; }
function vendidosPorDia(ventas, clase){
  clase = clase || 'v';
  const m = {};
  (ventas||[]).forEach(v=>(v.items||[]).forEach(it=>{
    if(it.tipo !== 'local' || claseLinea(it) !== clase) return;
    const f = (m[v.fecha] = m[v.fecha] || {});
    const c = (f[it.cat] = f[it.cat] || {});
    const k = it.clave + '|' + (it.tam || '');
    c[k] = (c[k]||0) + (Number(it.cantidad)||0);
  }));
  return m;
}
async function existenciaInicial(fecha){
  const { data: dias, error } = await sb.from('cierres_dia')
    .select('fecha,cupcakes,individuales,panques,pasteles,coronas,cupcakes_listo,individuales_listo,panques_listo,pasteles_listo,coronas_listo')
    .lt('fecha', fecha).order('fecha', {ascending:false}).limit(21);
  if(error) throw error;
  const lista = (dias||[]).slice().reverse();
  let vend = {}, mer = {}, cor = {};
  const diasConPOS = new Set();
  if(lista.length){
    const { data: ventas, error: e2 } = await sb.from('ventas').select('fecha,items').gte('fecha', lista[0].fecha).lt('fecha', fecha);
    if(e2) throw e2;
    vend = vendidosPorDia(ventas, 'v'); mer = vendidosPorDia(ventas, 'm'); cor = vendidosPorDia(ventas, 'c');
    (ventas||[]).forEach(v=> diasConPOS.add(v.fecha));
  }
  const deDia = (mapa, f, cat, k) => ((((mapa[f]||{})[cat])||{})[k]||0);
  const stock = {}; INV_CATS.forEach(c=> stock[c] = {});
  lista.forEach((dia, idx)=>{
    INV_CATS.forEach(cat=>{
      invKeys(cat).forEach(([n, tam])=>{
        const k = n + '|' + tam;
        const d = invDato(dia, cat, n, tam);
        const exis = idx === 0 ? (Number(d.exis)||0) : (stock[cat][k]||0);
        let queda;
        // Si ese día hubo punto de venta, lo que queda siempre sale de la cuenta real
        // (aunque algo se haya registrado después de finalizar). Antes del punto de venta se usa el cierre capturado.
        if(!diasConPOS.has(dia.fecha) && dia[cat + '_listo'] && d.cierre !== undefined && d.cierre !== null) queda = Number(d.cierre)||0;
        else queda = exis + (Number(d.in)||0) - deDia(vend, dia.fecha, cat, k)
          - Math.max(Number(d.merma)||0, deDia(mer, dia.fecha, cat, k)) - Math.max(Number(d.cortesia)||0, deDia(cor, dia.fecha, cat, k));
        stock[cat][k] = Math.max(0, queda);
      });
    });
  });
  return stock;
}
async function vendidosHoy(){
  const t = await movimientosHoy();
  return t.v;
}
async function movimientosHoy(){
  const fecha = fechaHoyStr();
  const { data, error } = await sb.from('ventas').select('fecha,items').eq('fecha', fecha);
  if(error) throw error;
  return { v: vendidosPorDia(data,'v')[fecha] || {}, m: vendidosPorDia(data,'m')[fecha] || {}, c: vendidosPorDia(data,'c')[fecha] || {} };
}
function vendidosDe(it){
  return (it.exis||0) + (it.in||0) - (it.cierre||0) - (it.merma||0) - (it.cortesia||0);
}
