# LicenTech Colombia — base técnica

## 1. Arquitectura recomendada
| Capa | Elección | Por qué |
|---|---|---|
| Frontend + API | **Next.js 14** (App Router, TypeScript, Tailwind) | SEO para el catálogo, un solo repo, Route Handlers como backend |
| Base de datos | **PostgreSQL** (Neon o Supabase) + **Prisma** | Transacciones y `FOR UPDATE SKIP LOCKED` para asignar claves sin duplicarlas; consultas parametrizadas |
| Auth | Propia: **bcrypt** (costo 12) + JWT en cookie `httpOnly` | Control total del flujo email + OTP por SMS |
| Pagos | **Wompi** (checkout alojado para tarjetas) y transferencia Nequi/Bre-B | Los datos de tarjeta se ingresan en el checkout seguro de Wompi, no en la tienda. |
| SMS / correo | Twilio / Resend | Simulado en desarrollo |
| Hosting | Vercel + Neon/Supabase | Despliegue simple |

Alternativa más rápida: Supabase Auth + Supabase Postgres (menos código de auth, menos control del OTP).

### Flujo de compra
checkout (con o sin cuenta) → tarjeta en Wompi o registro de una compra Nequi/Bre-B → transferencia y carga posterior del comprobante desde el enlace privado de seguimiento → `Order REVIEW` → confirmación manual desde el panel → `Order PAID` + licencia asignada → códigos de activación al correo. El webhook valida y registra pagos Wompi, pero nunca entrega licencias por sí solo.

## 2. Estructura de carpetas (★ = incluido en este código)
```
licentech/
├─ .env.example ★
├─ prisma/ schema.prisma ★  seed.ts ★
├─ legal/ descargo-de-responsabilidad.md ★
└─ src/
   ├─ middleware.ts ★                      protege /admin y /api/admin
   ├─ app/
   │  ├─ page.tsx, productos/[slug]/, checkout/        tienda
   │  ├─ login/, registro/, verificar-celular/, perfil/, mis-compras/
   │  ├─ legal/descargo/page.tsx                       renderiza el descargo
   │  ├─ admin/ page.tsx (ventas), productos/page.tsx (usa ProductManager)
   │  └─ api/
   │     ├─ auth/ register ★ login ★ logout, phone/send ★ phone/verify ★
   │     ├─ checkout/ card ★ nequi ★
   │     ├─ webhooks/wompi ★
   │     └─ admin/ products ★ products/[id] ★ licenses ★ stats
   ├─ components/ admin/ProductManager.tsx ★   checkout/CheckoutForm.tsx
   └─ lib/ prisma ★ auth ★ crypto ★ validation ★ sms ★ wompi ★ fulfillment ★ mail ★
```

## 3. Puesta en marcha
```bash
npx create-next-app@14 licentech --ts --tailwind --app --src-dir
npm i @prisma/client zod jose bcryptjs && npm i -D prisma @types/bcryptjs tsx
# copia los archivos de este paquete, completa .env y luego:
npx prisma migrate dev --name init
npx tsx prisma/seed.ts          # crea el primer administrador
npm run dev
```
Configura en Wompi (sandbox) la URL de eventos: `https://TU-DOMINIO/api/webhooks/wompi`.

Antes de recibir pagos reales, activa y verifica el comercio de Wompi, habilita tarjetas, configura la cuenta bancaria de desembolso en Wompi y cambia las variables de entorno a las credenciales de producción. Registra la URL pública de eventos `https://TU-DOMINIO/api/webhooks/wompi`; sin webhooks no se confirma ni entrega automáticamente la compra. No compartas claves privadas ni secretos por chat y no uses credenciales sandbox para vender.

## 4. Seguridad aplicada
- Contraseñas con bcrypt costo 12; mínimo 10 caracteres; respuesta de login sin revelar si el correo existe.
- Prisma parametriza todas las consultas (incluida la raw con `$queryRaw` por plantilla) → sin inyección SQL.
- Validación de toda entrada con Zod; el precio siempre se toma de la BD.
- OTP de 6 dígitos guardado como HMAC, vence en 10 min, 5 intentos, 1 envío por minuto.
- Claves de licencia cifradas en reposo (AES-256-GCM); solo se envían al correo del comprador después de la confirmación manual del pago.
- Webhook: checksum verificado, doble consulta a Wompi, entrega idempotente.
- Admin: middleware + verificación del rol contra la BD en cada endpoint.

## 5. Revisión manual de pagos
- Todos los pedidos aplican un recargo comercial fijo del 14,29% (multiplicador 8/7), igual para todos los métodos de pago. El checkout muestra el subtotal y los cargos agregados; el total resultante se cobra en COP. Confirma con tu asesor contable el tratamiento del IVA y que el recargo cubra las tarifas vigentes de Wompi y conversión.
- En el checkout se muestra una referencia de conversión USD/COP de ExchangeRate-API. La cotización es informativa y no cambia el total cobrado en COP.
- Los pagos Wompi aprobados por webhook y los comprobantes Nequi quedan en estado `REVIEW`; el webhook nunca entrega licencias por sí solo.
- El administrador verifica el pago y lo aprueba en `/admin`; solo entonces se asignan las licencias y se envía el correo de entrega.
- Para Nequi/Bre-B configura `SELLER_WHATSAPP` (número internacional, por ejemplo `573001234567`), `NEQUI_DESTINATION` (número Nequi) y `BREB_KEY` (llave Bre-B). También puedes administrar Nequi y agregar Bre-B con sus instrucciones y llave desde `/admin/contenido` → «Métodos de pago», activando cada método. El comprador ve el total y el destino al seleccionar el método; tras crear el pedido puede subir el comprobante privado JPG/PNG/WEBP/PDF de hasta 5 MB e indicar correo de contacto, WhatsApp y correo de la cuenta del software cuando corresponda.
- Antes de administrar productos en una base de datos existente, aplica las migraciones pendientes con `npx prisma migrate deploy`. Esto incluye `20261016215500_product_credits_support`, necesaria para créditos, rentas y las relaciones de imágenes del catálogo.
- Aplica la migración `20261016143000_manual_payment_review` antes de usar el nuevo flujo: `npx prisma migrate deploy`.
- Para compras de invitados y entrega por correo, aplica también la migración `20261016150000_guest_checkout`. Cada pedido tiene un enlace de seguimiento con token aleatorio; solo se almacena el hash del token.

## 6. Pendientes antes de vender
- **Rate limiting** en login/registro/OTP (Upstash Ratelimit o similar) y 2FA para administradores.
- **Contratos de suministro**: compra las claves a distribuidores autorizados y conserva la trazabilidad; el texto de "revendedor autorizado" debe ser cierto.
- **Factura electrónica DIAN**: el correo de este código es un comprobante, no la factura. Integra un proveedor tecnológico (Siigo, Alegra, Factus u otro) y valida con tu contador.
- Política de datos personales (Ley 1581 de 2012), términos y condiciones, y revisión del descargo por un abogado.
- Orden pagada sin stock (`PAID_NO_STOCK`): conecta una alerta. Mejora futura: reservar claves al iniciar el checkout.
- Panel de ventas (`/api/admin/stats`): `prisma.order.aggregate({ where: { status: "PAID" }, _sum: { amountCop: true }, _count: true })` y `prisma.user.count()`.
- Verifica en la documentación de tu pasarela los métodos habilitados para tu cuenta y las comisiones vigentes.
