# Lumi — Chatbot de ventas Klinge

Bot de WhatsApp con IA para seguimiento y cierre de ventas de paneles LED.

**Stack:** Node.js 18+ · WhatsApp Business API · Claude AI · Lioren API · PDFKit

---

## Instalación

```bash
git clone <repo>
cd lumi-klinge-bot
npm install
cp .env.example .env
# Completar las variables en .env
npm run dev
```

---

## Estructura del proyecto

```
src/
├── index.js              # Servidor Express + webhook
├── flows/
│   └── router.js         # Orquestador principal del flujo
├── services/
│   ├── claude.js         # Motor de IA (system prompt + llamadas)
│   ├── lioren.js         # Catálogo de productos + emisión DTE
│   └── session.js        # Estado de conversaciones en memoria
└── utils/
    ├── whatsapp.js       # Envío de mensajes, documentos y botones
    └── pdf.js            # Generación de cotizaciones en PDF
```

---

## Configuración paso a paso

### 1. WhatsApp Business API (Meta)
1. Crear una app en [developers.facebook.com](https://developers.facebook.com)
2. Agregar el producto "WhatsApp"
3. Registrar el número de Klinge
4. Copiar el **Phone Number ID** y generar un **Token de acceso permanente**
5. Registrar el webhook apuntando a `https://tu-dominio.cl/webhook`
6. Usar `VERIFY_TOKEN=lumi_klinge` (o el que definas en .env)

### 2. Lioren API
1. En tu cuenta Lioren: `APIs → Administrar APIs`
2. Si no ves el módulo, solicitarlo al ejecutivo de soporte (es sin costo)
3. Generar el **Token de acceso** y copiarlo en `LIOREN_TOKEN`
4. Confirmar la URL base de la API con Lioren (puede variar por plan)

### 3. Claude API
1. Crear cuenta en [console.anthropic.com](https://console.anthropic.com)
2. Generar una API Key y copiarla en `CLAUDE_API_KEY`

### 4. Hosting del servidor
Opciones recomendadas:
- **Railway** (más simple): `railway up`
- **Render**: conectar repo y desplegar
- **VPS propio**: usar PM2 para mantener el proceso activo

El servidor necesita una URL pública con HTTPS para que Meta pueda hacer el POST del webhook.

---

## Flujo de una venta completa

```
Cliente → WhatsApp
    → Webhook recibe mensaje
    → Router consulta sesión
    → Claude analiza intención con catálogo Lioren
    → Si detecta [GENERAR_COTIZACION]:
        → GET /productos Lioren (precios en tiempo real)
        → Genera PDF con PDFKit
        → Envía PDF + botones por WhatsApp
    → Si cliente acepta:
        → POST /documentos/emitir Lioren (boleta o factura)
        → Envía folio y confirmación al cliente
        → Actualiza CRM / notifica vendedor
```

---

## Personalización

Para ajustar el comportamiento de Lumi, editar el `systemPrompt` en `src/services/claude.js`:
- Agregar productos nuevos (se inyectan automáticamente desde Lioren)
- Ajustar objeciones frecuentes
- Cambiar el tono según campaña

---

## Pendientes para producción

- [ ] Reemplazar sesiones en memoria por Redis
- [ ] Subir PDFs a S3 o Cloudinary (hoy se sirven desde /tmp)
- [ ] Conectar notificaciones de escala al CRM o Slack
- [ ] Agregar templates de campaña outbound aprobados por Meta
- [ ] Confirmar URL base de API Lioren con ejecutivo de soporte
