// ============================================================
//  Lioren API — Productos y emisión de documentos tributarios
// ============================================================

const LIOREN_TOKEN   = process.env.LIOREN_TOKEN;   // Token desde APIs → Administrar APIs en Lioren
const LIOREN_BASE    = "https://lioren.cl/api";    // Base URL (confirmar con tu ejecutivo Lioren)

const headers = () => ({
  Authorization: `Bearer ${LIOREN_TOKEN}`,
  "Content-Type": "application/json",
  Accept: "application/json",
});

// ── GET Catálogo de productos ────────────────────────────────
// Retorna array con { id, nombre, precio, stock }
export async function getProductos() {
  const res = await fetch(`${LIOREN_BASE}/productos`, { headers: headers() });
  if (!res.ok) throw new Error(`Lioren productos error: ${res.status}`);
  return res.json();
}

// ── GET Producto específico ──────────────────────────────────
export async function getProducto(id) {
  const res = await fetch(`${LIOREN_BASE}/productos/${id}`, { headers: headers() });
  if (!res.ok) throw new Error(`Lioren producto error: ${res.status}`);
  return res.json();
}

// ── POST Emisión de DTE (boleta o factura) ───────────────────
// tipoDTE: 39 = boleta electrónica, 33 = factura electrónica
export async function emitirDTE({ cliente, items, tipoDTE = 39 }) {
  const body = {
    TipoDTE: tipoDTE,
    Receptor: {
      RUTRecep:    cliente.rut,
      RznSocRecep: cliente.razonSocial || cliente.nombre,
      GiroRecep:   cliente.giro        || "Sin giro",
      DirRecep:    cliente.direccion   || "",
      CmnaRecep:   cliente.comuna      || "",
    },
    Detalle: items.map((item) => ({
      NmbItem: item.nombre,
      QtyItem: item.cantidad,
      PrcItem: item.precioUnitario,
      // Lioren calcula totales e IVA automáticamente
    })),
  };

  const res = await fetch(`${LIOREN_BASE}/documentos/emitir`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.json();
    console.error("Lioren DTE error:", JSON.stringify(err));
    throw new Error(`Lioren DTE error: ${res.status}`);
  }
  return res.json();
  // Retorna: { folio, pdfUrl, monto, trackId, ... }
}

// ── Construir resumen de cotización (no es DTE, es interno) ──
// Calcula totales para mostrar al cliente antes de emitir
export function calcularCotizacion(items) {
  const neto = items.reduce((acc, item) => acc + item.cantidad * item.precioUnitario, 0);
  const iva  = Math.round(neto * 0.19);
  const total = neto + iva;
  return { neto, iva, total, items };
}
