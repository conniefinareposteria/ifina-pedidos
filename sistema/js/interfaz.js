// Detalles de la interfaz: bloqueo de scroll con ventanas abiertas y respuesta al tocar.

// ---------- Mientras haya una ventana abierta, la página de atrás no se mueve ----------
let scrollGuardado = null;
function actualizarBloqueoScroll(){
  const abierta = !!document.querySelector('.ep-hoja.on');
  const b = document.body;
  if(abierta && scrollGuardado === null){
    scrollGuardado = window.scrollY;
    b.style.position = 'fixed'; b.style.top = (-scrollGuardado) + 'px'; b.style.left = '0'; b.style.right = '0'; b.style.width = '100%';
  } else if(!abierta && scrollGuardado !== null){
    b.style.position = ''; b.style.top = ''; b.style.left = ''; b.style.right = ''; b.style.width = '';
    window.scrollTo(0, scrollGuardado);
    scrollGuardado = null;
  }
}
const observadorHojas = new MutationObserver(actualizarBloqueoScroll);
document.querySelectorAll('.ep-hoja').forEach(h=> observadorHojas.observe(h, { attributes:true, attributeFilter:['class'] }));
// ---------- Respuesta al tocar: vibración corta (Android) + clic suave (todas) ----------
let audioCtx = null;
function clicSuave(){
  try{
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if(audioCtx.state === 'suspended') audioCtx.resume();
    const t = audioCtx.currentTime, o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(880, t); o.frequency.exponentialRampToValueAtTime(440, t + 0.05);
    g.gain.setValueAtTime(0.08, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.06);
    o.connect(g); g.connect(audioCtx.destination); o.start(t); o.stop(t + 0.07);
  }catch(e){}
}
document.addEventListener('pointerdown', e=>{
  const el = e.target.closest('button, .chip, .pos-chip, .pos-tab, .pos-card, .pos-prow, .pos-tam button, nav button, .btn-inicio, .cart-row, .resultado-cliente');
  if(!el || el.disabled) return;
  if(navigator.vibrate) navigator.vibrate(12);
  clicSuave();
}, { passive:true });
