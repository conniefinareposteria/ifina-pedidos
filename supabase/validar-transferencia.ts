// Edge Function "validar-transferencia" (Supabase)
// 1) La IA (Claude) lee el comprobante (foto o PDF) que manda la clienta.
// 2) Se consulta a Banxico (CEP) si esa transferencia de verdad llegó a la cuenta del negocio.
// 3) Se guarda en la tabla "transferencias" (sql/041) y se regresa el resultado al sistema.
// Acciones: { accion:'validar', archivo:<base64>, tipo:<mime>, monto_esperado? }  |  { accion:'revisar' }
//           { accion:'ticket', archivos:[{archivo,tipo}], insumos:[{id,nombre,unidad}], tiendas:[nombre] }  (solo directora: lee un ticket de compra;
//             varias fotos = partes del MISMO ticket)
// Secrets necesarios en Supabase: ANTHROPIC_API_KEY, CLABE_DEPOSITOS (la CLABE donde se reciben las transferencias).
import { createClient } from "npm:@supabase/supabase-js@2";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (d: unknown, status = 200) =>
  new Response(JSON.stringify(d), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const CLABE = (Deno.env.get("CLABE_DEPOSITOS") || "").replace(/\D/g, "");
const RECEPTOR = CLABE.length === 18 ? "40" + CLABE.slice(0, 3) : "";   // 072 → 40072 (Banorte)
const MODELO = "claude-haiku-5-5";

// Claves Banxico de los bancos más comunes (por si no se puede bajar la lista de Banxico)
const BANCOS: Record<string, string> = {
  "BANAMEX": "40002", "CITIBANAMEX": "40002", "BBVA": "40012", "BANCOMER": "40012", "SANTANDER": "40014",
  "HSBC": "40021", "BAJIO": "40030", "INBURSA": "40036", "SCOTIABANK": "40044", "BANREGIO": "40058",
  "AFIRME": "40062", "BANORTE": "40072", "AZTECA": "40127", "BANCOPPEL": "40137", "STP": "90646", "NU": "90638",
  "MERCADO PAGO": "90722",
};
const norm = (s: string) => (s || "").toUpperCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Z0-9 ]/g, " ").replace(/\s+/g, " ").trim();

// ---------- 1) Leer el comprobante con la IA ----------
async function leerComprobante(base64: string, tipo: string) {
  const esPdf = /pdf/i.test(tipo);
  const bloque = esPdf
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64 } }
    : { type: "image", source: { type: "base64", media_type: tipo || "image/jpeg", data: base64 } };
  const pide = `Es el comprobante de una transferencia bancaria en México. Responde SOLO un JSON (sin texto extra) con:
{"es_comprobante": true/false,
 "clave_rastreo": "clave de rastreo tal cual (sin espacios); si no hay, la referencia numérica; si no hay ninguna, null",
 "es_clave_rastreo": true si el dato anterior es la clave de rastreo, false si es referencia,
 "fecha": "YYYY-MM-DD de la operación",
 "monto": número sin comas,
 "banco_origen": "banco o app desde donde se ENVIÓ (ej. BBVA, BanCoppel, Nu, Santander)",
 "banco_destino": "banco que RECIBE",
 "cuenta_destino_ultimos": "últimos dígitos visibles de la cuenta/CLABE destino, solo números",
 "nombre_ordenante": "quien envía, si aparece",
 "nombre_beneficiario": "a quien se le envía, si aparece",
 "concepto": "concepto si aparece"}`;
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": Deno.env.get("ANTHROPIC_API_KEY") || "", "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: MODELO, max_tokens: 600, messages: [{ role: "user", content: [bloque, { type: "text", text: pide }] }] }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error("La IA no pudo leer el comprobante: " + (d?.error?.message || r.status));
  const texto = (d.content || []).map((c: { text?: string }) => c.text || "").join("");
  const m = texto.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("La IA no regresó datos del comprobante");
  return JSON.parse(m[0]);
}

// ---------- Tickets de compra (Compras) ----------
async function leerTicket(archivos: { archivo: string; tipo: string }[], insumos: { id: number; nombre: string; unidad: string }[], tiendas: string[]) {
  const bloques = archivos.map(({ archivo, tipo }) => /pdf/i.test(tipo)
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: archivo } }
    : { type: "image", source: { type: "base64", media_type: tipo || "image/jpeg", data: archivo } });
  const varias = archivos.length > 1
    ? `Son ${archivos.length} fotos del MISMO ticket (partes de un ticket largo, en orden; pueden encimarse). Junta todo en un solo ticket y NO repitas los renglones que salgan en dos fotos.\n`
    : "";
  const lista = insumos.map((i) => `${i.id}|${i.nombre}|${i.unidad === "kg" ? "g" : i.unidad}`).join("\n");
  const pide = varias + `Es un ticket o factura de compra de insumos de una repostería en México. Léelo con cuidado y responde SOLO un JSON (sin texto extra):
{"es_ticket": true/false,
 "tienda": "nombre comercial de la tienda o proveedor",
 "fecha": "YYYY-MM-DD", "hora": "HH:MM o null", "folio": "folio o número de ticket, o null",
 "forma_pago": "efectivo / tarjeta / transferencia / otro, o null",
 "total": número sin comas (el total pagado),
 "productos": [{"descripcion": "tal cual viene en el ticket",
   "cantidad": número de piezas/cajas/paquetes compradas,
   "importe": número, lo que se pagó por ese renglón (cantidad × precio, con descuentos e impuestos del renglón si vienen),
   "insumo_id": el id de la lista de abajo que corresponde, o null si no es ninguno,
   "contenido": cuánto trae CADA pieza en la unidad del insumo (g, ml o pza). Ej. "LECHERA 48/375GR" por caja = 18000 g; "AZUCAR ZULKA 10/KG" = 10000 g; "ACEITE 12/800ML" por caja = 9600 ml; huevo caja 360 pzas = 360. null si no se puede saber}]}
Tiendas conocidas: ${tiendas.join(", ") || "ninguna"}.
Insumos (id|nombre|unidad):
${lista}`;
  const r = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": Deno.env.get("ANTHROPIC_API_KEY") || "", "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({ model: MODELO, max_tokens: 4000, messages: [{ role: "user", content: [...bloques, { type: "text", text: pide }] }] }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error("La IA no pudo leer el ticket: " + (d?.error?.message || r.status));
  const texto = (d.content || []).map((c: { text?: string }) => c.text || "").join("");
  const m = texto.match(/\{[\s\S]*\}/);
  if (!m) throw new Error("La IA no regresó datos del ticket");
  return JSON.parse(m[0]);
}

// ---------- 2) Banxico ----------
const fechaBanxico = (iso: string) => { const [a, m, d] = iso.split("-"); return `${d}-${m}-${a}`; };

// Lista de bancos de Banxico para esa fecha (si no se puede, se usa la lista corta de arriba)
async function claveBanco(nombre: string, fechaIso: string): Promise<string> {
  const n = norm(nombre);
  if (!n) return "";
  try {
    const r = await fetch(`https://www.banxico.org.mx/cep/instituciones.do?fecha=${fechaBanxico(fechaIso)}`, { headers: { "User-Agent": "Mozilla/5.0" } });
    const t = await r.text();
    let lista: [string, string][] = [];
    try {
      const j = JSON.parse(t);
      const arr = Array.isArray(j) ? j : (j.instituciones || j.emisores || []);
      lista = arr.map((x: unknown) => Array.isArray(x) ? [String(x[0]), String(x[1])] : [String((x as Record<string, unknown>).clave ?? ""), String((x as Record<string, unknown>).nombre ?? "")]) as [string, string][];
    } catch { /* no es JSON */ }
    const exacto = lista.find(([, nom]) => norm(nom) === n);
    const parecido = exacto || lista.find(([, nom]) => norm(nom).includes(n) || n.includes(norm(nom)));
    if (parecido && /^\d{5}$/.test(parecido[0])) return parecido[0];
  } catch { /* se usa la lista corta */ }
  for (const [k, v] of Object.entries(BANCOS)) if (n === k || n.includes(k)) return v;
  return "";
}

async function consultarBanxico(p: { fecha: string; clave: string; emisor: string; monto: number }) {
  const datos = new URLSearchParams({
    tipoCriterio: "T", fecha: fechaBanxico(p.fecha), criterio: p.clave, emisor: p.emisor, receptor: RECEPTOR,
    cuenta: CLABE, receptorParticipante: "0", monto: p.monto.toFixed(2), captcha: "c", tipoConsulta: "1",
  });
  const r1 = await fetch("https://www.banxico.org.mx/cep/valida.do", {
    method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded", "User-Agent": "Mozilla/5.0" }, body: datos,
  });
  const texto = (await r1.text()).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
  if (/no encontrad/i.test(texto)) return { encontrada: false };
  if (!/descargar cep/i.test(texto)) return { encontrada: false, raro: texto.slice(0, 200) };
  // @ts-ignore getSetCookie existe en Deno
  const sets: string[] = r1.headers.getSetCookie ? r1.headers.getSetCookie() : [r1.headers.get("set-cookie") || ""];
  const cookie = sets.map((c) => c.split(";")[0]).filter(Boolean).join("; ");
  const r2 = await fetch("https://www.banxico.org.mx/cep/descarga.do?formato=XML", { headers: { Cookie: cookie, "User-Agent": "Mozilla/5.0" } });
  const xml = await r2.text();
  const attr = (tag: string, a: string) => (xml.match(new RegExp("<" + tag + "[^>]*\\s" + a + '="([^"]*)"')) || [])[1] || "";
  return {
    encontrada: true,
    ordenante: attr("Ordenante", "Nombre"), banco: attr("Ordenante", "BancoEmisor"),
    monto: Number(attr("Beneficiario", "MontoPago")) || p.monto, concepto: attr("Beneficiario", "Concepto"),
    fecha_banxico: attr("SPEI_Tercero", "FechaOperacion"), hora: attr("SPEI_Tercero", "Hora"),
  };
}

// Volver a consultar a Banxico una transferencia guardada (sin gastar en la IA)
// deno-lint-ignore no-explicit-any
async function revisarUna(admin: any, t: Record<string, any>) {
  if (!t.clave_rastreo || !t.banco_emisor || !t.monto || !t.fecha || t.estado === "manual" || t.estado === "otra_cuenta") return t;
  try {
    const b = await consultarBanxico({ fecha: t.fecha, clave: t.clave_rastreo, emisor: t.banco_emisor, monto: Number(t.monto) });
    const upd: Record<string, unknown> = { revisado_at: new Date().toISOString(), estado: b.encontrada ? "liquidada" : "no_encontrada",
      detalle: b.encontrada ? "Banxico confirma que sí llegó." : "Banxico todavía no la encuentra. Si se acaba de hacer, espera unos minutos y vuelve a revisar; si no aparece, puede ser falsa." };
    if (b.encontrada && b.ordenante) upd.ordenante = b.ordenante;
    const { data } = await admin.from("transferencias").update(upd).eq("id", t.id).select().single();
    return data || { ...t, ...upd };
  } catch { return t; }
}

// ---------- Servidor ----------
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  // Solo directora y colaborador
  const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  const { data: u } = await admin.auth.getUser(token);
  if (!u?.user) return json({ error: "Inicia sesión otra vez." }, 401);
  const { data: perfil } = await admin.from("perfiles").select("rol").eq("user_id", u.user.id).maybeSingle();
  if (!perfil || !["director", "colaborador"].includes(perfil.rol)) return json({ error: "Sin permiso." }, 403);
  if (CLABE.length !== 18) return json({ error: "Falta el secret CLABE_DEPOSITOS en Supabase." }, 500);

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { return json({ error: "Solicitud vacía." }, 400); }

  // ---- Leer un ticket de compra (solo directora): regresa lo leído; el sistema lo guarda después de revisarlo
  if (body.accion === "ticket") {
    if (perfil.rol !== "director") return json({ error: "Sin permiso." }, 403);
    const lista = Array.isArray(body.archivos) ? body.archivos as { archivo: string; tipo: string }[] : [{ archivo: String(body.archivo || ""), tipo: String(body.tipo || "image/jpeg") }];
    const archivos = lista.filter((a) => a && a.archivo).slice(0, 5).map((a) => ({ archivo: String(a.archivo), tipo: String(a.tipo || "image/jpeg") }));
    if (!archivos.length) return json({ error: "Falta la foto del ticket." }, 400);
    try {
      const ins = Array.isArray(body.insumos) ? (body.insumos as { id: number; nombre: string; unidad: string }[]).slice(0, 400) : [];
      const tie = Array.isArray(body.tiendas) ? (body.tiendas as string[]).slice(0, 50) : [];
      return json({ lectura: await leerTicket(archivos, ins, tie) });
    } catch (e) { return json({ error: String((e as Error).message || e) }); }
  }

  // ---- Volver a revisar (botón "Revisar transferencias"): sin IA, solo Banxico
  if (body.accion === "revisar") {
    const desde = new Date(Date.now() - 60 * 864e5).toISOString().slice(0, 10);
    const { data: filas } = await admin.from("transferencias").select("*")
      .in("estado", ["no_encontrada", "liquidada"]).gte("fecha", desde).order("fecha").limit(150);
    const cambios: unknown[] = [];
    for (const t of filas || []) {
      if (!t.clave_rastreo || !t.banco_emisor || !t.monto) continue;
      try {
        const b = await consultarBanxico({ fecha: t.fecha, clave: t.clave_rastreo, emisor: t.banco_emisor, monto: Number(t.monto) });
        const nuevo = b.encontrada ? "liquidada" : "no_encontrada";
        const upd: Record<string, unknown> = { revisado_at: new Date().toISOString() };
        if (nuevo !== t.estado) {
          upd.estado = nuevo;
          upd.detalle = nuevo === "liquidada" ? "Banxico ya la confirma: sí llegó." : "Antes aparecía y ahora Banxico ya no la encuentra. Revísala en el banco.";
          if (b.encontrada && b.ordenante) upd.ordenante = b.ordenante;
          cambios.push({ id: t.id, antes: t.estado, ahora: nuevo, monto: t.monto, ordenante: t.ordenante, pedido_id: t.pedido_id, venta_id: t.venta_id });
        }
        await admin.from("transferencias").update(upd).eq("id", t.id);
      } catch { /* si Banxico falla, se intenta la próxima vez */ }
      await new Promise((r) => setTimeout(r, 400));   // sin saturar a Banxico
    }
    return json({ revisadas: (filas || []).length, cambios });
  }

  // ---- Reintentar una (ej. Banxico aún no la tenía hace un minuto)
  if (body.accion === "reintentar") {
    const { data: t } = await admin.from("transferencias").select("*").eq("id", Number(body.id)).maybeSingle();
    if (!t) return json({ error: "No se encontró." }, 404);
    return json(await revisarUna(admin, t));
  }

  if (body.accion !== "validar") return json({ error: "Acción no válida." }, 400);
  const archivo = String(body.archivo || ""), tipo = String(body.tipo || "image/jpeg");
  if (!archivo) return json({ error: "Falta el comprobante." }, 400);

  // 1) Leer
  let L: Record<string, unknown>;
  try { L = await leerComprobante(archivo, tipo); }
  catch (e) { return json({ estado: "manual", detalle: "No se pudo leer el comprobante: " + String((e as Error).message || e) + ". Revísalo a mano." }); }

  const guardar = async (fila: Record<string, unknown>) => {
    const { data, error } = await admin.from("transferencias").insert([{ subido_por: u.user!.id, lectura: L, ...fila }]).select().single();
    if (error) return json({ error: "No se pudo guardar: " + error.message }, 500);
    return json(data);
  };

  if (L.es_comprobante === false) return json({ estado: "manual", detalle: "Eso no parece un comprobante de transferencia." });
  const clave = String(L.clave_rastreo || "").replace(/\s+/g, "");
  const fecha = String(L.fecha || "");
  const monto = Number(L.monto) || 0;
  const base = { clave_rastreo: clave || null, fecha: /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? fecha : null, monto: monto || null,
    banco_emisor_nombre: L.banco_origen || null, ordenante: L.nombre_ordenante || null, concepto: L.concepto || null };

  // ¿Es a la cuenta del negocio?
  const ult = String(L.cuenta_destino_ultimos || "").replace(/\D/g, "");
  if (ult.length >= 3 && !CLABE.endsWith(ult.slice(-4))) {
    return guardar({ ...base, estado: "otra_cuenta", detalle: `Este comprobante es a otra cuenta (termina en ${ult.slice(-4)}), no a la del negocio.` });
  }

  // ¿Ya se usó este comprobante?
  if (clave) {
    const { data: previa } = await admin.from("transferencias").select("*").eq("clave_rastreo", clave).neq("estado", "otra_cuenta").limit(1);
    if (previa && previa.length) {
      const t = previa[0];
      // Ya está ligado a un pedido o venta: es un comprobante repetido
      if (t.pedido_id || t.venta_id) return json({ ...t, duplicada: true, detalle: "Este comprobante ya se usó en otro pago." });
      // Se subió pero no se guardó el pago (ej. se reintentó): se vuelve a revisar ese mismo
      return json(await revisarUna(admin, t));
    }
  }

  const emisor = await claveBanco(String(L.banco_origen || ""), base.fecha || "");
  if (emisor && emisor === RECEPTOR) return guardar({ ...base, banco_emisor: emisor, estado: "manual", detalle: "Es del mismo banco que tu cuenta: no pasa por Banxico. Revísala a mano en la app del banco." });
  if (!clave || !base.fecha || !monto || !emisor) {
    const falta = [!clave && "clave de rastreo", !base.fecha && "fecha", !monto && "monto", !emisor && "banco de origen"].filter(Boolean).join(", ");
    return guardar({ ...base, banco_emisor: emisor || null, estado: "manual", detalle: `No se leyó: ${falta}. Revísala a mano.` });
  }

  // 2) Banxico
  try {
    const b = await consultarBanxico({ fecha: base.fecha, clave, emisor, monto });
    if (b.encontrada) {
      return guardar({ ...base, banco_emisor: emisor, estado: "liquidada", revisado_at: new Date().toISOString(),
        ordenante: b.ordenante || base.ordenante, banco_emisor_nombre: b.banco || base.banco_emisor_nombre, monto: b.monto, concepto: b.concepto || base.concepto,
        detalle: "Banxico confirma que sí llegó." });
    }
    return guardar({ ...base, banco_emisor: emisor, estado: "no_encontrada", revisado_at: new Date().toISOString(),
      detalle: "Banxico todavía no la encuentra. Si se acaba de hacer, espera unos minutos y vuelve a revisar; si no aparece, puede ser falsa." });
  } catch (e) {
    return guardar({ ...base, banco_emisor: emisor, estado: "no_encontrada", detalle: "No se pudo consultar a Banxico en este momento (" + String((e as Error).message || e) + "). Se volverá a revisar." });
  }
});
