// Supabase simulado para las pruebas automáticas (no se publica: Netlify solo sube la carpeta sistema/).
// Reemplaza a supabase-js: guarda todo en memoria y anota cada escritura en window.__log
// para poder comparar el comportamiento del sistema antes y después de un cambio.
(function(){
  const HOY = window.__HOY || '2026-10-28';
  const dia = (n) => { const d = new Date(HOY + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0,10); };
  const ts = (n, hora) => new Date(dia(n) + 'T' + (hora || '11:00') + ':00-07:00').toISOString();
  window.__log = [];
  const log = (tipo, nombre, args) => window.__log.push([tipo, nombre, JSON.parse(JSON.stringify(args === undefined ? null : args))]);

  const tablas = {
    perfiles: [{ user_id:'u1', rol: window.__ROL || 'director' }],
    tamanos_pastel: [{tamano:'mini',precio:450,personas:8},{tamano:'chico',precio:650,personas:15},{tamano:'mediano',precio:1000,personas:25},{tamano:'grande',precio:1400},{tamano:'cheesecake',precio:550}],
    sabores_pasteles: [{nombre:'white_velvet',incluye_corona:true},{nombre:'chocolate',incluye_corona:false},{nombre:'zanahoria',incluye_corona:false},{nombre:'coco',incluye_corona:false},{nombre:'pistache',incluye_corona:true},{nombre:'cc_frutos_rojos',incluye_corona:false}],
    sabores_cupcakes: [{nombre:'limon'},{nombre:'pistache'},{nombre:'chocolate'},{nombre:'coco'}],
    individuales: [{nombre:'cupcake',precio:45},{nombre:'cuchareable_coco',precio:80},{nombre:'galletas_limon',precio:80},{nombre:'carlota_limon',precio:80}],
    panques: [{nombre:'panque_platano',precio:120},{nombre:'panque_naranja',precio:120}],
    fotos_catalogo: [
      {id:1,tabla:'sabores_pasteles',producto:'white_velvet',orden:0,ruta:'sabores_pasteles/whitevelvet/a.jpg',url:'https://fotos.prueba/a.jpg',ruta_original:'sabores_pasteles/whitevelvet/a-original.jpg'},
      {id:2,tabla:'sabores_pasteles',producto:'white_velvet',orden:1,ruta:'sabores_pasteles/whitevelvet/b.jpg',url:'https://fotos.prueba/b.jpg',ruta_original:'sabores_pasteles/whitevelvet/b-original.jpg'}],
    decoraciones: [{nombre:'Base blanca',precio:0,orden:1},{nombre:'Corona de color',precio:100,orden:2},{nombre:'Decorado simple',precio:150,orden:3},{nombre:'Decorado de evento',precio:null,orden:4}],
    productos_ocultos: [{tabla:'individuales',producto:'carlota_limon'}],
    coronas: [{tipo:'ambar',tamano:'mini',precio:30},{tipo:'ambar',tamano:'normal',precio:50},{tipo:'color',tamano:'mini',precio:60},{tipo:'color',tamano:'normal',precio:100}],
    metas_produccion: [
      {dia:3, pasteles:{"White velvet":{mini:4,chico:2},"Coco":{mini:2,chico:1}}, cupcakes:{"Limón":24,"Pistache":12}, coronas:{}},
      {dia:7, pasteles:{}, cupcakes:{}, coronas:{"Mini":10,"Normal":6}}],
    clientes: [
      {id:1,nombre:'Ana',apellido:'López',telefono:'6671000000',calle:'Río Culiacán',numero_exterior:'12',colonia:'Centro'},
      {id:2,nombre:'Beto',apellido:'Ramos',telefono:'6671000008'}],
    pedidos: [
      {id:7,created_at:ts(-3),cliente_id:1,nombre_cliente:'Ana López',telefono:'6671000000',categoria:'pastel',tamano_o_sabor:'chico',sabor:'chocolate',precio:700,anticipo:200,metodo_pago:'transferencia',entrega:'local',fecha_entrega:ts(0,'11:00'),corona_tipo:'ambar',corona_tamano:'normal',corona_precio:50,notas:'Feliz cumpleaños',pagos:[]},
      {id:8,created_at:ts(-2),cliente_id:2,nombre_cliente:'Beto Ramos',telefono:'6671000008',categoria:'pastel',tamano_o_sabor:'mini',sabor:'zanahoria',precio:450,anticipo:450,metodo_pago:'efectivo',entrega:'local',fecha_entrega:ts(0,'12:00'),corona_tipo:null,notas:'',pagos:[]},
      {id:9,created_at:ts(-2),nombre_cliente:'Carmen Díaz',telefono:'6671000010',categoria:'cupcake',tamano_o_sabor:'',sabor:'6 Pistache, 6 Chocolate',precio:540,anticipo:0,metodo_pago:'',entrega:'domicilio',direccion:'Río Culiacán 12, Col. Centro',fecha_entrega:ts(0,'14:00'),notas:'',pagos:[{monto:100,metodo:'tarjeta',fecha:ts(-1)}]},
      {id:10,created_at:ts(-1),nombre_cliente:'Diego Ruiz',telefono:'6671000011',categoria:'pastel',tamano_o_sabor:'mediano',sabor:'white_velvet',precio:1000,anticipo:300,metodo_pago:'efectivo',entrega:'local',fecha_entrega:ts(4,'11:00'),corona_tipo:'incluida',corona_tamano:'normal',corona_precio:0,decorado:true,decorado_descripcion:'Blanco con perlas',notas:'',pagos:[]},
      {id:11,created_at:ts(-5),nombre_cliente:'Elena Soto',telefono:'6671000012',categoria:'pastel',tamano_o_sabor:'mini',sabor:'caramelo',precio:480,anticipo:480,metodo_pago:'efectivo',entrega:'local',fecha_entrega:ts(-1,'12:00'),corona_tipo:'ambar',corona_tamano:'mini',corona_precio:30,entregado:true,entregado_at:ts(-1,'12:10'),pagos:[]}],
    pedidos_eliminados: [{id:1,eliminado_at:ts(-1),pedido:{id:99,nombre_cliente:'Fer Gómez',categoria:'pastel',tamano_o_sabor:'chico',sabor:'coco',precio:650,fecha_entrega:ts(2)}}],
    cierres_dia: [
      {id:1,fecha:dia(-1),cupcakes:{"Limón":{exis:2,in:12,cierre:5},"Pistache":{exis:0,in:12,cierre:4}},individuales:{"Cuchareable Coco":{exis:0,in:6,cierre:2}},pasteles:{"White velvet":{mini:{exis:1,in:2,cierre:1},chico:{exis:0,in:1,cierre:1}},"Coco":{mini:{exis:0,in:2,cierre:1},chico:{exis:0,in:0,cierre:0}}},panques:{"Panque Platano":{exis:0,in:3,cierre:1}},coronas:{"Mini":{exis:5,in:0,cierre:4},"Normal":{exis:3,in:2,cierre:4}},corte_caja:{version:2,fondo_caja:3800},cupcakes_listo:true,individuales_listo:true,pasteles_listo:true,panques_listo:true,coronas_listo:true,caja_listo:true,cerrado:true},
      {id:2,fecha:dia(0),cupcakes:{"Limón":{in:12},"Pistache":{in:6}},individuales:{"Cuchareable Coco":{in:4}},pasteles:{"White velvet":{mini:{in:1},chico:{in:0}},"Zanahoria":{mini:{in:2},chico:{in:1}}},panques:{},coronas:{"Mini":{in:2}},corte_caja:{},cupcakes_listo:false}],
    ventas: [
      {id:61,created_at:ts(-1,'10:30'),fecha:dia(-1),items:[{tipo:'local',cat:'cupcakes',categoria:'cupcake',clave:'Limón',tam:null,nombre:'Cupcake Limón',precio:45,cantidad:3,subtotal:135}],subtotal:135,descuento:0,total:135,monto_local:135,monto_pedidos:0,metodo_pago:'efectivo'},
      {id:62,created_at:ts(0,'09:10'),fecha:dia(0),items:[{tipo:'local',cat:'cupcakes',categoria:'cupcake',clave:'Pistache',tam:null,nombre:'Cupcake Pistache',precio:45,cantidad:2,subtotal:90},{tipo:'local',cortesia:true,cat:'cupcakes',categoria:'cupcake',clave:'Limón',tam:null,nombre:'Cupcake Limón',precio:45,cantidad:1,subtotal:45}],subtotal:135,descuento:45,total:90,monto_local:90,monto_pedidos:0,metodo_pago:'terminal'},
      {id:63,created_at:ts(0,'09:40'),fecha:dia(0),items:[{tipo:'local',merma:true,cat:'individuales',categoria:'individual',clave:'Cuchareable Coco',tam:null,nombre:'Cuchareable Coco',precio:80,cantidad:1,subtotal:80}],subtotal:80,descuento:80,total:0,monto_local:0,monto_pedidos:0,metodo_pago:null},
      {id:64,created_at:ts(0,'10:05'),fecha:dia(0),items:[{tipo:'pedido',pedido_id:9,nombre:'Carmen Díaz',detalle:'Cupcakes · 6 Pistache, 6 Chocolate',falta:440,cobrado:200,anticipo:true,entregar:false},{tipo:'local',cat:'pasteles',categoria:'pastel',clave:'White velvet',tam:'mini',nombre:'Pastel mini White velvet',precio:450,cantidad:1,subtotal:450}],subtotal:650,descuento:0,total:650,monto_local:450,monto_pedidos:200,metodo_pago:'mixto',pagos:[{metodo:'efectivo',monto:400},{metodo:'tarjeta',monto:250}]}]
  };
  window.__tablas = tablas;

  const rpcs = {
    pedidos_entrega_hoy: () => tablas.pedidos.filter(p=> (p.fecha_entrega||'').slice(0,10) <= dia(0) && p.fecha_entrega >= ts(0,'00:00') && ['local','recoger',null,undefined].includes(p.entrega)),
    buscar_pedidos_pos: (a) => tablas.pedidos.filter(p=> !p.entregado && (p.nombre_cliente||'').toLowerCase().includes(String(a.q||'').toLowerCase())),
    anticipos_del_dia: () => [{metodo:'transferencia',monto:200},{metodo:'efectivo',monto:300}],
    registrar_venta: () => 100 + window.__log.filter(x=>x[1]==='registrar_venta').length,
  };

  function consulta(tabla){
    const filtros = []; let uno = false, soloUno = false, limite = null, orden = null, desc = false, accion = 'select', datos = null, conSelect = false;
    const q = {
      select(){ conSelect = true; return q; },
      eq(c,v){ filtros.push(r=> r[c] == v); return q; },
      neq(c,v){ filtros.push(r=> r[c] != v); return q; },
      lt(c,v){ filtros.push(r=> r[c] < v); return q; },
      lte(c,v){ filtros.push(r=> r[c] <= v); return q; },
      gt(c,v){ filtros.push(r=> r[c] > v); return q; },
      gte(c,v){ filtros.push(r=> r[c] >= v); return q; },
      in(c,v){ filtros.push(r=> v.includes(r[c])); return q; },
      ilike(c,v){ const t = String(v).replace(/%/g,'').toLowerCase(); filtros.push(r=> String(r[c]||'').toLowerCase().includes(t)); return q; },
      or(){ return q; }, match(o){ Object.entries(o).forEach(([c,v])=> filtros.push(r=> r[c] == v)); return q; },
      order(c,o){ orden = c; desc = !!(o && o.ascending === false); return q; },
      limit(n){ limite = n; return q; },
      single(){ uno = true; soloUno = true; return q; },
      maybeSingle(){ uno = true; return q; },
      insert(x){ accion = 'insert'; datos = x; log('insert', tabla, x); return q; },
      update(x){ accion = 'update'; datos = x; return q; },
      upsert(x, o){ accion = 'upsert'; datos = x; log('upsert', tabla, x); return q; },
      delete(){ accion = 'delete'; return q; },
      then(ok, fail){
        let r = (tablas[tabla] || []).filter(x=> filtros.every(f=> f(x)));
        if(accion === 'update'){ log('update', tabla, { datos, filas: r.map(x=>x.id || x.fecha) }); r.forEach(x=> Object.assign(x, datos)); }
        if(accion === 'delete'){ log('delete', tabla, r.map(x=>x.id)); }
        if(accion === 'insert'){ r = Array.isArray(datos) ? datos : [datos];
          if(tabla === 'fotos_catalogo'){ r = r.map(x=> ({ id: 100 + tablas.fotos_catalogo.length, ...x })); tablas.fotos_catalogo.push(...r); } }
        if(accion === 'insert' && tabla === 'productos_ocultos') tablas.productos_ocultos.push(...r);
        if(accion === 'delete' && tabla === 'productos_ocultos'){ tablas.productos_ocultos = tablas.productos_ocultos.filter(x=> !r.includes(x)); }
        if(accion === 'delete' && tabla === 'fotos_catalogo'){ tablas.fotos_catalogo = tablas.fotos_catalogo.filter(x=> !r.includes(x)); }
        if(accion === 'upsert'){ r = Array.isArray(datos) ? datos : [datos]; }
        if(orden) r = r.slice().sort((a,b)=> (a[orden] > b[orden] ? 1 : a[orden] < b[orden] ? -1 : 0) * (desc ? -1 : 1));
        if(limite) r = r.slice(0, limite);
        let data = uno ? (r[0] || null) : r;
        if(tabla === 'perfiles') data = soloUno ? { rol: window.__ROL || 'director' } : data;
        if(accion !== 'select' && !conSelect) data = null;
        return Promise.resolve({ data: JSON.parse(JSON.stringify(data)), error: null }).then(ok, fail);
      }
    };
    return q;
  }

  window.supabase = { createClient(){ return {
    from: consulta,
    rpc(nombre, args){ log('rpc', nombre, args); const f = rpcs[nombre]; return Promise.resolve({ data: f ? JSON.parse(JSON.stringify(f(args||{}))) : null, error: null }); },
    // Almacenamiento de fotos: solo anota lo que se sube o se borra
    storage: { from: (bucket) => ({
      upload(ruta, archivo, o){ log('subir', bucket, { ruta: ruta.replace(/\d{13}-[a-z0-9]+/, 'X'), tipo: o && o.contentType }); return Promise.resolve({ data:{ path: ruta }, error:null }); },
      getPublicUrl(ruta){ return { data:{ publicUrl: 'https://fotos.prueba/' + ruta } }; },
      remove(rutas){ log('borrar', bucket, rutas); return Promise.resolve({ data:[], error:null }); }
    }) },
    auth: {
      getSession: () => Promise.resolve({ data: { session: { user: { id:'u1' } } } }),
      onAuthStateChange(){}, signOut: () => Promise.resolve({}), signInWithPassword: () => Promise.resolve({ data:{}, error:null }),
      resetPasswordForEmail: () => Promise.resolve({ error:null }), updateUser: () => Promise.resolve({ error:null })
    }
  }; } };
})();
