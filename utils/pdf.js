// ============================================================
//  Generador de PDF — Cotización con branding Klinge
//  Dependencia: pdfkit  →  npm install pdfkit
// ============================================================

import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";

const OUTPUT_DIR = process.env.PDF_OUTPUT_DIR || "/tmp/cotizaciones";

// Asegurar que el directorio existe
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

export async function generarCotizacionPDF({ session, cotizacion, folio }) {
  return new Promise((resolve, reject) => {
    const filename = `cotizacion_${folio}_${session.phone}.pdf`;
    const filepath = path.join(OUTPUT_DIR, filename);
    const doc = new PDFDocument({ margin: 50, size: "A4" });
    const stream = fs.createWriteStream(filepath);

    doc.pipe(stream);

    // ── Header ───────────────────────────────────────────────
    doc
      .fontSize(22)
      .font("Helvetica-Bold")
      .text("KLINGE", 50, 50)
      .fontSize(10)
      .font("Helvetica")
      .fillColor("#666")
      .text("Paneles LED Publicitarios · Chile", 50, 78)
      .text("www.klinge.cl  |  +56 9 6467 2810", 50, 90)
      .fillColor("#000");

    // Línea divisora
    doc.moveTo(50, 110).lineTo(545, 110).strokeColor("#e0e0e0").stroke();

    // ── Datos del documento ──────────────────────────────────
    doc
      .fontSize(16)
      .font("Helvetica-Bold")
      .text("COTIZACIÓN", 50, 125)
      .fontSize(10)
      .font("Helvetica")
      .text(`N° ${folio}`, 50, 148)
      .text(`Fecha: ${new Date().toLocaleDateString("es-CL")}`, 50, 162)
      .text(`Válida por: 7 días`, 50, 176);

    // ── Datos del cliente ────────────────────────────────────
    doc
      .fontSize(11)
      .font("Helvetica-Bold")
      .text("DATOS DEL CLIENTE", 50, 210)
      .font("Helvetica")
      .fontSize(10)
      .text(`Nombre: ${session.nombre || "—"}`, 50, 228)
      .text(`RUT: ${session.rut || "—"}`, 50, 242)
      .text(`Empresa: ${session.empresa || "—"}`, 50, 256);

    // ── Tabla de productos ───────────────────────────────────
    doc
      .fontSize(11)
      .font("Helvetica-Bold")
      .text("DETALLE", 50, 295);

    // Encabezado tabla
    doc
      .fontSize(9)
      .font("Helvetica-Bold")
      .fillColor("#fff")
      .rect(50, 315, 495, 18)
      .fill("#222")
      .text("Producto", 55, 320)
      .text("Cant.", 380, 320)
      .text("P. Unit.", 420, 320)
      .text("Subtotal", 470, 320)
      .fillColor("#000");

    // Filas de productos
    let y = 338;
    cotizacion.items.forEach((item, i) => {
      const bg = i % 2 === 0 ? "#f9f9f9" : "#ffffff";
      const subtotal = item.cantidad * item.precioUnitario;

      doc
        .rect(50, y, 495, 18)
        .fill(bg)
        .font("Helvetica")
        .fontSize(9)
        .fillColor("#000")
        .text(item.nombre, 55, y + 5, { width: 310, ellipsis: true })
        .text(item.cantidad.toString(), 380, y + 5)
        .text(`$${item.precioUnitario.toLocaleString("es-CL")}`, 420, y + 5)
        .text(`$${subtotal.toLocaleString("es-CL")}`, 470, y + 5);

      y += 20;
    });

    // ── Totales ──────────────────────────────────────────────
    y += 10;
    doc
      .font("Helvetica")
      .fontSize(10)
      .text("Neto:", 400, y)
      .text(`$${cotizacion.neto.toLocaleString("es-CL")}`, 470, y)
      .text("IVA (19%):", 400, y + 16)
      .text(`$${cotizacion.iva.toLocaleString("es-CL")}`, 470, y + 16)
      .font("Helvetica-Bold")
      .fontSize(12)
      .text("TOTAL:", 400, y + 36)
      .text(`$${cotizacion.total.toLocaleString("es-CL")}`, 470, y + 36);

    // ── Condiciones ──────────────────────────────────────────
    doc
      .fontSize(9)
      .font("Helvetica")
      .fillColor("#666")
      .text("• Entrega en 48 horas a todo Chile", 50, y + 60)
      .text("• Impresión incluida en productos seleccionados", 50, y + 74)
      .text("• Garantía 1 año · Devolución sin preguntas en 7 días", 50, y + 88)
      .text("Para confirmar, responde SÍ a este WhatsApp y emitimos tu boleta o factura de inmediato.", 50, y + 105)
      .fillColor("#000");

    doc.end();

    stream.on("finish", () => resolve({ filepath, filename }));
    stream.on("error", reject);
  });
}
