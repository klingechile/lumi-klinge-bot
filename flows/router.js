// ============================================================
//  Router — Orquesta el flujo completo de Lumi
// ============================================================

import { getSession, updateSession, addToHistory, ESTADOS } from "../services/session.js";
import { askClaude } from "../services/claude.js";
import { getProductos, calcularCotizacion, emitirDTE } from "../services/lioren.js";
import { sendText, sendDocument, sendButtons } from "../utils/whatsapp.js";
import { generarCotizacionPDF } from "../utils/pdf.js";

// Folio interno para cotizaciones (en producción usar DB)
let folioCounter = 1000;

export async function handleIncomingMessage(payload) {
  const { from, name, text, type } = payload;
  const session = getSession(from);

  // Actualizar nombre si lo tenemos del perfil de WA
  if (!session.nombre && name !== "Cliente") {
    updateSession(from, { nombre: name });
  }

  // ── Comandos especiales (botones interactivos) ───────────
  if (type === "interactive") {
    const buttonId = payload?.interactive?.button_reply?.id;
    if (buttonId === "btn_acepta_cotizacion") {
      return await flujoEmitirDTE(from, session);
    }
    if (buttonId === "btn_rechaza_cotizacion") {
      await sendText(from, "Entendido. Si quieres ajustar algo o tienes dudas, aquí estoy.");
      updateSession(from, { estado: ESTADOS.CALIFICANDO });
      return;
    }
  }

  // ── Texto normal: pasar por Claude ──────────────────────
  try {
    // Obtener catálogo actualizado de Lioren en cada interacción
    const catalogo = await getProductos().catch(() => []);

    // Consultar a Claude con el contexto completo
    const lumiResponse = await askClaude(session, text, catalogo);

    // Detectar palabras clave que Claude puede incluir en su respuesta
    if (lumiResponse.includes("[GENERAR_COTIZACION]")) {
      const cleanResponse = lumiResponse.replace("[GENERAR_COTIZACION]", "").trim();
      if (cleanResponse) await sendText(from, cleanResponse);
      return await flujoGenerarCotizacion(from, session, catalogo);
    }

    if (lumiResponse.includes("[EMITIR_DTE]")) {
      const cleanResponse = lumiResponse.replace("[EMITIR_DTE]", "").trim();
      if (cleanResponse) await sendText(from, cleanResponse);
      return await flujoEmitirDTE(from, session);
    }

    if (lumiResponse.includes("[ESCALAR_HUMANO]")) {
      const cleanResponse = lumiResponse.replace("[ESCALAR_HUMANO]", "").trim();
      if (cleanResponse) await sendText(from, cleanResponse);
      return await flujoEscalarHumano(from, session);
    }

    // Respuesta normal
    await sendText(from, lumiResponse);

    // Guardar en historial
    addToHistory(from, "user", text);
    addToHistory(from, "assistant", lumiResponse);

  } catch (err) {
    console.error("Error procesando mensaje:", err);
    await sendText(from, "Tuve un pequeño problema. Dame un segundo e intenta de nuevo.");
  }
}

// ── Flujo: Generar cotización ────────────────────────────────
async function flujoGenerarCotizacion(phone, session, catalogo) {
  try {
    updateSession(phone, { estado: ESTADOS.ESPERANDO_DECISION });

    const cotizacion = calcularCotizacion(session.items);
    updateSession(phone, { cotizacion });

    const folio = `KL-${++folioCounter}`;
    const { filepath, filename } = await generarCotizacionPDF({ session, cotizacion, folio });

    // En producción: subir el PDF a un CDN (S3, Cloudinary, etc.) y usar la URL pública
    // Aquí usamos una URL de ejemplo
    const pdfUrl = `${process.env.PUBLIC_URL}/cotizaciones/${filename}`;

    await sendDocument(
      phone,
      pdfUrl,
      filename,
      `Tu cotización Klinge · Total: $${cotizacion.total.toLocaleString("es-CL")}`
    );

    // Botones para confirmar o rechazar
    await sendButtons(
      phone,
      "¿Seguimos adelante? Confirma y emitimos tu boleta o factura de inmediato.",
      [
        { id: "btn_acepta_cotizacion", title: "Sí, lo quiero" },
        { id: "btn_rechaza_cotizacion", title: "Necesito ajustar" },
      ]
    );

  } catch (err) {
    console.error("Error generando cotización:", err);
    await sendText(phone, "Hubo un problema generando tu cotización. Te contacto de inmediato.");
    await flujoEscalarHumano(phone, session);
  }
}

// ── Flujo: Emitir DTE (boleta o factura) ────────────────────
async function flujoEmitirDTE(phone, session) {
  try {
    updateSession(phone, { estado: ESTADOS.EMITIENDO_DTE });
    await sendText(phone, "Perfecto, generando tu documento ahora...");

    // Determinar tipo: factura (33) si tiene RUT empresa, boleta (39) si es consumidor
    const tipoDTE = session.empresa ? 33 : 39;

    const dte = await emitirDTE({
      cliente: {
        rut:         session.rut,
        razonSocial: session.empresa || session.nombre,
        nombre:      session.nombre,
      },
      items:   session.cotizacion.items,
      tipoDTE,
    });

    updateSession(phone, { estado: ESTADOS.CERRADO, dte });

    const tipoDoc = tipoDTE === 33 ? "factura" : "boleta";
    await sendText(
      phone,
      `Listo, ${session.nombre}. Tu ${tipoDoc} fue emitida (folio ${dte.folio}).\n\nTu panel llega en 48 horas con impresión incluida. Si tienes cualquier duda, aquí estamos.`
    );

    // Notificar al equipo de ventas (en producción: webhook a CRM o Slack)
    console.log(`VENTA CERRADA: ${phone} | ${tipoDTE === 33 ? "Factura" : "Boleta"} ${dte.folio} | $${session.cotizacion.total.toLocaleString("es-CL")}`);

  } catch (err) {
    console.error("Error emitiendo DTE:", err);
    await sendText(phone, "Tuve un problema al emitir el documento. Te paso con el equipo para resolverlo de inmediato.");
    await flujoEscalarHumano(phone, session);
  }
}

// ── Flujo: Escalar a vendedor humano ────────────────────────
async function flujoEscalarHumano(phone, session) {
  updateSession(phone, { estado: ESTADOS.ESCALADO });

  await sendText(
    phone,
    "Entendido, te conecto directamente con nuestro equipo. Te escriben en breve por este mismo WhatsApp."
  );

  // En producción: enviar notificación al CRM o al canal de ventas (Slack, email, etc.)
  const resumen = {
    phone,
    nombre:   session.nombre,
    empresa:  session.empresa,
    rut:      session.rut,
    items:    session.items,
    estado:   session.estado,
    historial: session.historial.slice(-6), // últimos 3 intercambios
  };

  console.log("ESCALAR A VENDEDOR:", JSON.stringify(resumen, null, 2));
  // TODO: POST a tu CRM o webhook de Slack con `resumen`
}
