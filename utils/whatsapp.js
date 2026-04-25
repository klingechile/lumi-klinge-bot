// ============================================================
//  WhatsApp Business API — Envío de mensajes y verificación
// ============================================================

const WA_TOKEN      = process.env.WA_TOKEN;        // Token de acceso de Meta
const WA_PHONE_ID   = process.env.WA_PHONE_ID;     // Phone Number ID de Meta
const VERIFY_TOKEN  = process.env.VERIFY_TOKEN;    // Token que defines tú al registrar el webhook

const WA_URL = `https://graph.facebook.com/v19.0/${WA_PHONE_ID}/messages`;

// ── Verificación del webhook (GET) ──────────────────────────
export function verifyWebhook(req, res) {
  const mode      = req.query["hub.mode"];
  const token     = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("Webhook verificado correctamente");
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
}

// ── Enviar mensaje de texto ──────────────────────────────────
export async function sendText(to, text) {
  return callWA({
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body: text },
  });
}

// ── Enviar documento (PDF de cotización) ────────────────────
export async function sendDocument(to, url, filename, caption = "") {
  return callWA({
    messaging_product: "whatsapp",
    to,
    type: "document",
    document: { link: url, filename, caption },
  });
}

// ── Enviar botones interactivos (máx. 3) ────────────────────
export async function sendButtons(to, bodyText, buttons) {
  // buttons: [{ id: "btn_acepta", title: "Sí, acepto" }, ...]
  return callWA({
    messaging_product: "whatsapp",
    to,
    type: "interactive",
    interactive: {
      type: "button",
      body: { text: bodyText },
      action: {
        buttons: buttons.map((b) => ({
          type: "reply",
          reply: { id: b.id, title: b.title },
        })),
      },
    },
  });
}

// ── Llamada genérica a la API ────────────────────────────────
async function callWA(payload) {
  const res = await fetch(WA_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${WA_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const err = await res.json();
    console.error("Error WhatsApp API:", JSON.stringify(err));
    throw new Error(`WhatsApp API error: ${res.status}`);
  }
  return res.json();
}
