// Compara dos huellas del recorrido (antes y después de un cambio).
// Uso: node pruebas/comparar.js antes.json despues.json
// Muestra cada paso donde cambió el texto en pantalla, lo que se mandó a Supabase o el ticket.
const fs = require('fs');
const [a, b] = process.argv.slice(2).map(f => JSON.parse(fs.readFileSync(f, 'utf8')));
let difs = 0;
const corto = v => { const s = typeof v === 'string' ? v : JSON.stringify(v); return s.length > 400 ? s.slice(0, 400) + '…' : s; };
function primerCambio(x, y){
  const s1 = typeof x === 'string' ? x : JSON.stringify(x), s2 = typeof y === 'string' ? y : JSON.stringify(y);
  let i = 0; while(i < s1.length && s1[i] === s2[i]) i++;
  return `  antes:   …${s1.slice(Math.max(0, i - 80), i + 160)}\n  después: …${s2.slice(Math.max(0, i - 80), i + 160)}`;
}
for(const rol of new Set([...Object.keys(a), ...Object.keys(b)])){
  const A = a[rol] || { pasos: [], errores: [] }, B = b[rol] || { pasos: [], errores: [] };
  if(JSON.stringify(A.errores) !== JSON.stringify(B.errores)){ difs++; console.log(`[${rol}] errores de JavaScript:\n  antes: ${corto(A.errores)}\n  después: ${corto(B.errores)}`); }
  const n = Math.max(A.pasos.length, B.pasos.length);
  for(let i = 0; i < n; i++){
    const p = A.pasos[i] || {}, q = B.pasos[i] || {};
    for(const k of new Set([...Object.keys(p), ...Object.keys(q)])){
      if(JSON.stringify(p[k]) !== JSON.stringify(q[k])){
        difs++;
        console.log(`[${rol}] paso ${i + 1} "${p.paso || q.paso}" → ${k} cambió:\n${primerCambio(p[k] ?? '', q[k] ?? '')}`);
      }
    }
  }
}
console.log(difs ? `\n${difs} diferencias.` : 'Sin diferencias: el sistema se comporta igual.');
process.exit(difs ? 1 : 0);
