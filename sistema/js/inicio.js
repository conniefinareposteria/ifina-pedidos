// Arranque: se carga al final, cuando todos los módulos ya están listos.

sb.auth.onAuthStateChange((event, session) => {
  if(event === 'PASSWORD_RECOVERY'){
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app-contenido').style.display = 'none';
    document.getElementById('reset-screen').style.display = 'flex';
  }
});
cargarSesion();
