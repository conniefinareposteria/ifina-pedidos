// Sesión y navegación: login, permisos por perfil y cambio entre pantallas.

// ---------- Permisos por perfil (un solo lugar) ----------
// Qué pestañas ve cada perfil, a dónde entra y qué acciones especiales tiene.
// Para un módulo nuevo (compras, calculadora, alertas…): agregar su pestaña aquí y su acción en "acciones".
// Ojo: esto solo decide lo que se ve; lo que de verdad protege los datos son las políticas de Supabase (RLS).
const TODAS_LAS_PESTANAS = ['nuevo','lista','productos','historial','resumen','clientes','pos','porhacer','catalogo'];
const PERMISOS = {
  director:    { nombre:'Directora',   pestanas:['nuevo','lista','historial','resumen','clientes','porhacer','catalogo'], entrar: ()=> switchView('lista'),
                 acciones:['pedidos_editar','pedidos_eliminados','pedidos_decorados','pedidos_imprimir','ver_dinero','metas_editar'] },
  colaborador: { nombre:'Colaborador', pestanas:['nuevo','productos','pos'],                                  entrar: ()=> irInicio(),
                 acciones:[] },
  produccion:  { nombre:'Producción',  pestanas:['lista','porhacer'],                                         entrar: ()=> abrirPorHacer(),
                 acciones:[] },
};
function permisosDe(rol){ return PERMISOS[rol] || PERMISOS.colaborador; }
function puede(accion){ return permisosDe(rolActual).acciones.includes(accion); }

function switchView(view){
  const yaEstabaEnNuevo = document.getElementById('view-nuevo').classList.contains('active');
  if(view === 'nuevo' && (!yaEstabaEnNuevo || pedidoEnEdicion)){
    limpiarFormularioPedido();
    iniciarNuevoPedido();
  }
  document.getElementById('tab-nuevo').classList.toggle('active', view==='nuevo');
  document.getElementById('tab-lista').classList.toggle('active', view==='lista');
  document.getElementById('tab-productos').classList.remove('active');
  document.getElementById('tab-historial').classList.remove('active');
  document.getElementById('tab-resumen').classList.remove('active');
  document.getElementById('tab-clientes').classList.remove('active');
  document.getElementById('tab-pos').classList.remove('active');
  document.getElementById('tab-porhacer').classList.remove('active');
  document.getElementById('tab-catalogo').classList.remove('active');
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.getElementById('view-nuevo').classList.toggle('active', view==='nuevo');
  document.getElementById('view-lista').classList.toggle('active', view==='lista');
  if(view==='lista') cargarPedidos();
}
function irInicio(){
  limpiarFormularioPedido();
  iniciarNuevoPedido();
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.getElementById('view-inicio').classList.add('active');
  window.scrollTo(0,0);
}
function irNuevoPedido(){
  switchView('nuevo');
  window.scrollTo(0,0);
}
function toggleVerContrasena(){
  const campo = document.getElementById('login-password');
  const icono = document.getElementById('icono-ojo');
  const esOculto = campo.type === 'password';
  campo.type = esOculto ? 'text' : 'password';
  icono.innerHTML = esOculto
    ? '<path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a21.6 21.6 0 0 1 5.06-6.06M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a21.6 21.6 0 0 1-3.22 4.44M14.12 14.12a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>'
    : '<path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"></path><circle cx="12" cy="12" r="3"></circle>';
}
async function iniciarSesion(){
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const msg = document.getElementById('login-msg');
  msg.className = 'msg';

  if(!email || !password){
    msg.className = 'msg err';
    msg.textContent = 'Escribe tu correo y contraseña.';
    return;
  }

  const btn = document.getElementById('btn-login');
  btn.disabled = true;
  btn.textContent = 'Entrando...';

  const { data, error } = await sb.auth.signInWithPassword({ email, password });

  btn.disabled = false;
  btn.textContent = 'Entrar';

  if(error){
    msg.className = 'msg err';
    msg.textContent = 'Correo o contraseña incorrectos.';
    return;
  }

  await cargarSesion();
}
async function cerrarSesion(){
  await sb.auth.signOut();
  location.reload();
}
async function cargarSesion(){
  const { data: { session } } = await sb.auth.getSession();
  if(!session){
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('app-contenido').style.display = 'none';
    return;
  }

  const { data: perfil, error: perfilError } = await sb
    .from('perfiles')
    .select('rol')
    .eq('user_id', session.user.id)
    .single();

  if(perfilError || !perfil){
    document.getElementById('login-msg').className = 'msg err';
    document.getElementById('login-msg').textContent = 'Tu cuenta no tiene un rol asignado. Avísale a la directora.';
    document.getElementById('login-screen').style.display = 'flex';
    await sb.auth.signOut();
    return;
  }

  rolActual = perfil.rol;
  const permisos = permisosDe(rolActual);

  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app-contenido').style.display = 'block';
  document.getElementById('usuario-rol-label').textContent = permisos.nombre;
  TODAS_LAS_PESTANAS.forEach(t=> document.getElementById('tab-' + t).style.display = permisos.pestanas.includes(t) ? 'inline-block' : 'none');
  document.getElementById('link-eliminados-wrap').style.display = puede('pedidos_eliminados') ? 'block' : 'none';
  document.body.classList.toggle('rol-director', rolActual === 'director');
  document.body.classList.toggle('rol-colaborador', rolActual === 'colaborador');
  permisos.entrar();

  catalogosListos = cargarCatalogos();
}
async function pedirResetPassword(){
  const email = document.getElementById('login-email').value.trim();
  const msg = document.getElementById('login-msg');
  if(!email){
    msg.className = 'msg err';
    msg.textContent = 'Primero escribe tu correo arriba, luego toca "¿Olvidaste tu contraseña?" de nuevo.';
    return;
  }
  const { error } = await sb.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.href.split('#')[0].split('?')[0]
  });
  if(error){
    msg.className = 'msg err';
    msg.textContent = 'No se pudo enviar el correo: ' + error.message;
  } else {
    msg.className = 'msg ok';
    msg.textContent = 'Te mandamos un correo con un link para poner una contraseña nueva. Revisa tu bandeja (y spam).';
  }
}
async function guardarNuevaPassword(){
  const nueva = document.getElementById('reset-password').value;
  const msg = document.getElementById('reset-msg');
  if(!nueva || nueva.length < 6){
    msg.className = 'msg err';
    msg.textContent = 'La contraseña debe tener al menos 6 caracteres.';
    return;
  }
  const { error } = await sb.auth.updateUser({ password: nueva });
  if(error){
    msg.className = 'msg err';
    msg.textContent = 'No se pudo guardar: ' + error.message;
  } else {
    msg.className = 'msg ok';
    msg.textContent = 'Contraseña actualizada. Entrando...';
    setTimeout(()=>{ document.getElementById('reset-screen').style.display='none'; cargarSesion(); }, 1200);
  }
}
function refrescarVistaActual(){
  if(document.getElementById('view-resumen') && document.getElementById('view-resumen').classList.contains('active')) generarResumen();
  else if(document.getElementById('view-cliente-detalle').classList.contains('active')) cargarPedidosCliente();
  else cargarPedidos();
}
function activarVistaDirectora(tabId, viewId){
  document.querySelectorAll('nav button').forEach(b=>b.classList.remove('active'));
  if(tabId) document.getElementById(tabId).classList.add('active');
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  document.getElementById(viewId).classList.add('active');
  window.scrollTo(0,0);
}
