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

# Opción "pared": los nichos van a las orillas para que los precios queden escritos sobre la pared, sin taparse
borde_ancho = [(60, 120, 120, 85, 23), (1150, 90, 130, 75, 37), (1120, 330, 110, 90, 41), (90, 400, 100, 70, 53), (640, 470, 170, 45, 67)]
borde_alto = [(360, 60, 110, 70, 23), (20, 470, 70, 95, 41), (390, 760, 70, 80, 53), (60, 1080, 110, 60, 67)]
open(os.path.join(dest, 'nichos-borde-ancho.svg'), 'w').write(lienzo(1200, 480, borde_ancho))
open(os.path.join(dest, 'nichos-borde-alto.svg'), 'w').write(lienzo(400, 1100, borde_alto))

# Opción "pared": la pared del local tal cual (calcada de la foto), 4 nichos con su tira de luz
PARED = [
 dict(c=[(25,600),(60,520),(150,470),(300,440),(450,430),(560,420),(700,400),(850,395),(940,410),(985,470),(995,560),(985,650),(950,740),(890,800),(800,840),(680,860),(560,870),(470,862),(380,850),(260,830),(140,800),(60,760),(25,690)],
      l=[(160,522),(300,490),(450,472),(600,457),(750,437),(870,427),(962,457)]),
 dict(c=[(1060,420),(1075,340),(1150,300),(1300,280),(1500,280),(1680,295),(1790,330),(1835,400),(1825,490),(1780,560),(1700,620),(1610,690),(1520,760),(1420,805),(1300,820),(1150,815),(1080,780),(1050,700),(1045,560)],
      l=[(1088,362),(1250,334),(1450,326),(1620,334),(1702,366)]),
 dict(c=[(770,940),(800,875),(880,835),(1000,825),(1130,840),(1210,880),(1250,950),(1255,1030),(1225,1075),(1100,1090),(950,1090),(820,1080),(775,1040)],
      l=[(792,908),(880,862),(1000,852),(1120,862),(1196,897)]),
 dict(c=[(1330,900),(1350,860),(1450,840),(1600,800),(1720,730),(1830,715),(1910,740),(1935,820),(1935,960),(1915,1060),(1880,1100),(1700,1110),(1500,1110),(1360,1100),(1320,1060),(1310,980)],
      l=[(1348,886),(1500,862),(1650,802),(1762,734),(1862,728)]),
]
def pared(vb):
    cuerpo = ''
    for i, n in enumerate(PARED):
        d = suave(n['c']); led = abierta(n['l']); xs = [p[0] for p in n['c']]; ys = [p[1] for p in n['c']]
        cx, top, rx = (min(xs)+max(xs))/2, min(ys), (max(xs)-min(xs))/2
        cuerpo += f"""<g><clipPath id='p{i}'><path d='{d}'/></clipPath>
<path d='{d}' fill='url(#fondo)'/>
<path d='{d}' fill='#000' filter='url(#sombra)'/>
<path d='{d}' fill='none' stroke='#a9c4ea' stroke-opacity='.28' stroke-width='3'/>
</g>\n"""   # sin tira de luz: en la página no se usa (en el local sí)
    return lienzo(2000, 1500, []).replace("viewBox='0 0 2000 1500'", f"viewBox='{vb}'").replace('</defs>\n\n</svg>', '</defs>\n' + cuerpo + '</svg>')
open(os.path.join(dest, 'pared-local.svg'), 'w').write(pared('0 250 2000 900'))
print('pared lista')
