// ============================================================
//  Gestor de sesiones — Estado por número de teléfono
//  En producción reemplazar por Redis o DynamoDB
// ============================================================

const sessions = new Map();

const ESTADOS = {
  NUEVO:               "nuevo",
  CALIFICANDO:         "calificando",
  ELIGIENDO_PRODUCTO:  "eligiendo_producto",
  CONFIRMANDO_DATOS:   "confirmando_datos",
  ESPERANDO_DECISION:  "esperando_decision",  // cotización enviada
  EMITIENDO_DTE:       "emitiendo_dte",
  CERRADO:             "cerrado",
  ESCALADO:            "escalado",
};

export { ESTADOS };

// ── Obtener sesión (crea una nueva si no existe) ─────────────
export function getSession(phone) {
  if (!sessions.has(phone)) {
    sessions.set(phone, {
      phone,
      estado:   ESTADOS.NUEVO,
      nombre:   null,
      rut:      null,
      empresa:  null,
      items:    [],           // [{ productoId, nombre, cantidad, precioUnitario }]
      cotizacion: null,       // resultado de calcularCotizacion()
      dte:      null,         // resultado de emitirDTE()
      historial: [],          // [{ role, content }] para Claude
      ultimoContacto: Date.now(),
      tipoCampaña: null,      // "outbound" | "seguimiento" | "reengagement"
    });
  }
  return sessions.get(phone);
}

// ── Actualizar campos de la sesión ───────────────────────────
export function updateSession(phone, changes) {
  const session = getSession(phone);
  Object.assign(session, changes, { ultimoContacto: Date.now() });
  return session;
}

// ── Agregar mensaje al historial de Claude ───────────────────
export function addToHistory(phone, role, content) {
  const session = getSession(phone);
  session.historial.push({ role, content });
  // Mantener solo los últimos 20 mensajes para no sobrepasar el contexto
  if (session.historial.length > 20) {
    session.historial = session.historial.slice(-20);
  }
}

// ── Limpiar sesión (reiniciar conversación) ──────────────────
export function clearSession(phone) {
  sessions.delete(phone);
}

// ── Limpieza automática de sesiones inactivas (+24h) ─────────
setInterval(() => {
  const cutoff = Date.now() - 24 * 60 * 60 * 1000;
  for (const [phone, session] of sessions.entries()) {
    if (session.ultimoContacto < cutoff) {
      sessions.delete(phone);
    }
  }
}, 60 * 60 * 1000); // corre cada hora
