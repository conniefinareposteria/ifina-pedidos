# Genera las formas de los nichos (muro azul) de la página pública. Uso: python3 herramientas/nichos_pagina.py → blobs.json; luego se pegan en pagina-inicial/index.html (.nicho:nth-child).
import urllib.parse, json
blobs = [
 # puntos en sentido horario; los primeros 'top' forman la parte de arriba (donde va la luz)
 dict(pts=[(10,40),(40,12),(95,18),(150,8),(190,30),(194,78),(170,110),(110,104),(60,114),(14,96)], top=5),
 dict(pts=[(8,30),(55,8),(120,16),(178,10),(196,48),(186,96),(140,114),(80,100),(30,112),(6,80)], top=5),
 dict(pts=[(14,50),(30,14),(90,6),(140,22),(186,14),(194,70),(176,108),(120,96),(56,114),(8,92)], top=5),
 dict(pts=[(6,44),(48,16),(104,10),(160,26),(196,20),(190,88),(150,112),(96,106),(40,116),(10,90)], top=5),
 dict(pts=[(12,34),(70,10),(118,24),(172,6),(194,52),(184,100),(128,116),(72,104),(20,110),(4,70)], top=5),
]
def cr(pts, closed=True):
    n=len(pts); d=''
    P=lambda i: pts[i%n] if closed else pts[max(0,min(n-1,i))]
    rng = range(n) if closed else range(n-1)
    d=f'M{pts[0][0]:.1f},{pts[0][1]:.1f}'
    for i in rng:
        p0,p1,p2,p3=P(i-1),P(i),P(i+1),P(i+2)
        c1=(p1[0]+(p2[0]-p0[0])/6, p1[1]+(p2[1]-p0[1])/6)
        c2=(p2[0]-(p3[0]-p1[0])/6, p2[1]-(p3[1]-p1[1])/6)
        d+=f' C{c1[0]:.1f},{c1[1]:.1f} {c2[0]:.1f},{c2[1]:.1f} {p2[0]:.1f},{p2[1]:.1f}'
    return d+(' Z' if closed else '')
out=[]
for k,b in enumerate(blobs):
    pts=b['pts']; cx=sum(p[0] for p in pts)/len(pts); cy=sum(p[1] for p in pts)/len(pts)
    body=cr(pts)
    top=[(cx+(x-cx)*0.94, cy+(y-cy)*0.93+2.5) for x,y in pts[:b['top']] if y<=26]
    led=cr(top, closed=False)
    svg=f"""<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 200 120' preserveAspectRatio='none'>
<defs><linearGradient id='g' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#07152c' stop-opacity='.62'/><stop offset='.55' stop-color='#0c2148' stop-opacity='.34'/><stop offset='1' stop-color='#1a3a6c' stop-opacity='.18'/></linearGradient>
<filter id='s' x='-20%' y='-20%' width='140%' height='140%'><feFlood flood-color='#000' flood-opacity='.75'/><feComposite in2='SourceAlpha' operator='out'/><feGaussianBlur stdDeviation='5'/><feOffset dy='6' result='o'/><feComposite in='o' in2='SourceAlpha' operator='in'/></filter>
<radialGradient id='w' cx='.5' cy='.08' r='.55' gradientTransform='translate(0 0) scale(1 .7)'><stop offset='0' stop-color='#ffc77a' stop-opacity='.32'/><stop offset='1' stop-color='#ffc77a' stop-opacity='0'/></radialGradient><clipPath id='c'><path d='{body}'/></clipPath><filter id='l' x='-20%' y='-100%' width='140%' height='300%'><feGaussianBlur stdDeviation='2.2'/></filter></defs>
<path d='{body}' fill='url(#g)'/><path d='{body}' fill='#000' filter='url(#s)'/><rect x='0' y='0' width='200' height='120' fill='url(#w)' clip-path='url(#c)'/>
<path d='{body}' fill='none' stroke='#9fbde8' stroke-opacity='.22' stroke-width='1.2'/>
<path d='{led}' fill='none' stroke='#ffb85c' stroke-opacity='.6' stroke-width='3.6' stroke-linecap='round' filter='url(#l)'/>
<path d='{led}' fill='none' stroke='#ffe6bd' stroke-width='1.1' stroke-linecap='round'/></svg>"""
    svg=' '.join(svg.split())
    out.append('url("data:image/svg+xml;utf8,'+urllib.parse.quote(svg, safe=" ='/:,.-()")+'")')
json.dump(out, open('blobs.json','w'))
print(len(out[0]))
