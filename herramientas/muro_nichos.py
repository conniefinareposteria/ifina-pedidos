# Genera el fondo de nichos del muro azul (sección de precios de la página pública).
# Cada nicho es distinto: forma orgánica, sombra hacia adentro, luz cálida que cae y tira de luz arriba.
# Uso: python3 herramientas/muro_nichos.py  → pagina-inicial/img/nichos-ancho.svg y nichos-alto.svg
import math, random, os

def suave(pts):
    n = len(pts); d = f'M{pts[0][0]:.1f},{pts[0][1]:.1f}'
    for i in range(n):
        p0, p1, p2, p3 = pts[(i-1) % n], pts[i], pts[(i+1) % n], pts[(i+2) % n]
        c1 = (p1[0] + (p2[0]-p0[0])/6, p1[1] + (p2[1]-p0[1])/6)
        c2 = (p2[0] - (p3[0]-p1[0])/6, p2[1] - (p3[1]-p1[1])/6)
        d += f' C{c1[0]:.1f},{c1[1]:.1f} {c2[0]:.1f},{c2[1]:.1f} {p2[0]:.1f},{p2[1]:.1f}'
    return d + ' Z'

def abierta(pts):
    d = f'M{pts[0][0]:.1f},{pts[0][1]:.1f}'
    for i in range(len(pts)-1):
        p0, p1, p2 = pts[max(0, i-1)], pts[i], pts[i+1]; p3 = pts[min(len(pts)-1, i+2)]
        c1 = (p1[0] + (p2[0]-p0[0])/6, p1[1] + (p2[1]-p0[1])/6)
        c2 = (p2[0] - (p3[0]-p1[0])/6, p2[1] - (p3[1]-p1[1])/6)
        d += f' C{c1[0]:.1f},{c1[1]:.1f} {c2[0]:.1f},{c2[1]:.1f} {p2[0]:.1f},{p2[1]:.1f}'
    return d

def nicho(cx, cy, rx, ry, semilla, idx):
    r = random.Random(semilla)
    n = r.randint(8, 11); fase = r.uniform(0, 6.28)
    pts = []
    for k in range(n):
        a = fase + 2*math.pi*k/n
        # forma tipo "frijol"/gota: deformaciones distintas en cada nicho
        f = 1 + 0.18*math.sin(2*a + r.uniform(0, 6)) + 0.12*math.sin(3*a + r.uniform(0, 6)) + r.uniform(-.08, .08)
        pts.append((cx + rx*f*math.cos(a), cy + ry*f*math.sin(a)*r.uniform(.85, 1.1)))
    cuerpo = suave(pts)
    # tira de luz: puntos de la parte de arriba, un poco hacia adentro
    # puntos de arriba en orden de la orilla (tramo continuo), para que la luz siga la curva sin cruzarse
    dentro = [p[1] < cy - ry*0.6 for p in pts]
    if any(dentro) and not all(dentro):
        k0 = next(k for k in range(n) if dentro[k] and not dentro[k-1])
        arriba = []
        k = k0
        while dentro[k % n]: arriba.append(pts[k % n]); k += 1
    else: arriba = []
    arriba = [(cx + (x-cx)*0.9, cy + (y-cy)*0.88 + 4) for x, y in arriba]
    led = abierta(arriba) if len(arriba) >= 2 else ''
    return f"""<g>
<clipPath id='c{idx}'><path d='{cuerpo}'/></clipPath>
<path d='{cuerpo}' fill='url(#fondo)'/>
<g clip-path='url(#c{idx})'><ellipse cx='{cx:.0f}' cy='{cy-ry*0.95:.0f}' rx='{rx*1.1:.0f}' ry='{ry*0.9:.0f}' fill='url(#calida)'/></g>
<path d='{cuerpo}' fill='#000' filter='url(#sombra)'/>
<path d='{cuerpo}' fill='none' stroke='#a9c4ea' stroke-opacity='.25' stroke-width='2'/>
{f"<path d='{led}' fill='none' stroke='#ffb45a' stroke-opacity='.55' stroke-width='9' stroke-linecap='round' filter='url(#brillo)'/><path d='{led}' fill='none' stroke='#ffe4b8' stroke-width='2.4' stroke-linecap='round'/>" if led else ''}
</g>"""

def lienzo(w, h, nichos):
    cuerpo = '\n'.join(nicho(*n, i) for i, n in enumerate(nichos))
    return f"""<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 {w} {h}' preserveAspectRatio='xMidYMid slice'>
<defs>
<linearGradient id='fondo' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#06122a' stop-opacity='.55'/><stop offset='.6' stop-color='#0b1f45' stop-opacity='.32'/><stop offset='1' stop-color='#1a3a6c' stop-opacity='.2'/></linearGradient>
<radialGradient id='calida'><stop offset='0' stop-color='#ffc77a' stop-opacity='.28'/><stop offset='1' stop-color='#ffc77a' stop-opacity='0'/></radialGradient>
<filter id='sombra' x='-20%' y='-20%' width='140%' height='140%'><feFlood flood-color='#000' flood-opacity='.8'/><feComposite in2='SourceAlpha' operator='out'/><feGaussianBlur stdDeviation='14'/><feOffset dy='14' result='o'/><feComposite in='o' in2='SourceAlpha' operator='in'/></filter>
<filter id='brillo' x='-10%' y='-200%' width='120%' height='500%'><feGaussianBlur stdDeviation='5'/></filter>
</defs>
{cuerpo}
</svg>"""

# (centro x, centro y, radio x, radio y, semilla) — compuestos como la pared del local, ninguno igual.
# Proporción parecida a la sección real para que no se recorten; se deja libre la esquina del título.
ancho = [(520, 95, 150, 70, 23), (870, 150, 120, 85, 37), (1130, 110, 110, 75, 41),
         (90, 330, 120, 85, 53), (420, 360, 170, 80, 67), (760, 390, 120, 70, 79), (1080, 360, 140, 95, 83)]
alto = [(330, 190, 95, 70, 23), (70, 330, 100, 75, 37), (300, 440, 110, 85, 41), (90, 560, 95, 60, 53), (350, 610, 80, 55, 67)]
dest = os.path.join(os.path.dirname(__file__), '..', 'pagina-inicial', 'img')
open(os.path.join(dest, 'nichos-ancho.svg'), 'w').write(lienzo(1200, 480, ancho))
open(os.path.join(dest, 'nichos-alto.svg'), 'w').write(lienzo(400, 660, alto))
print('listo')
