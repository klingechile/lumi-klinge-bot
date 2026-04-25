// ============================================================
//  Lumi — Chatbot de ventas Klinge
//  WhatsApp Business API + Claude AI + Lioren API
// ============================================================

import express from "express";
import { handleIncomingMessage } from "./flows/router.js";
import { verifyWebhook } from "./utils/whatsapp.js";

const app = express();
app.use(express.json());

// ── Verificación del webhook (Meta requiere este paso al registrar) ──
app.get("/webhook", verifyWebhook);

// ── Recepción de mensajes entrantes ──
app.post("/webhook", async (req, res) => {
  try {
    const body = req.body;

    // Meta envuelve todo en entry[0].changes[0]
    const entry = body?.entry?.[0]?.changes?.[0]?.value;
    if (!entry?.messages?.length) return res.sendStatus(200);

    const message = entry.messages[0];
    const contact = entry.contacts?.[0];

    const payload = {
      from: message.from,           // número del cliente (e.g. "56912345678")
      name: contact?.profile?.name || "Cliente",
      type: message.type,           // "text" | "interactive" | "document" ...
      text: message.text?.body || "",
      messageId: message.id,
      timestamp: message.timestamp,
    };

    // Procesamos de forma asíncrona para responder 200 rápido a Meta
    res.sendStatus(200);
    await handleIncomingMessage(payload);

  } catch (err) {
    console.error("Error en webhook:", err);
    res.sendStatus(500);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Lumi escuchando en puerto ${PORT}`));
