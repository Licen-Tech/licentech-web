# LicenTech Colombia — base técnica

## 1. Arquitectura recomendada
| Capa | Elección | Por qué |
|---|---|---|
| Frontend + API | **Next.js 14** (App Router, TypeScript, Tailwind) | SEO para el catálogo, un solo repo, Route Handlers como backend |
| Base de datos | **PostgreSQL** (Neon o Supabase) + **Prisma** | Transacciones y `FOR UPDATE SKIP LOCKED` para asignar claves sin duplicarlas; consultas parametrizadas |
| Auth | Propia: **bcrypt** (costo 12) + JWT en cookie `httpOnly` | Control total del flujo email + OTP por SMS |
| Pagos | **Wompi** (PSE, tarjetas, Nequi, efectivo en corresponsales Bancolombia) | Cubre PSE y tarjetas; si necesitas Efecty/Baloto como marca, PayU o Mercado Pago los ofrecen: la lógica está aislada en `lib/wompi.ts` |
| SMS / correo | Twilio / Resend | Simulado en desarrollo |
| Hosting | Vercel + Neon/Supabase | Despliegue simple |

Alternativa más rápida: Supabase Auth + Supabase Postgres (menos código de auth, menos control del OTP).

### Flujo de compra
checkout → `Order PENDING` → transacción PSE en Wompi → el usuario paga en su banco → **webhook** → se valida firma, referencia y monto (consultando a Wompi) → `Order PAID` + licencia asignada → comprobante por correo → la clave aparece en "Mis compras".

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
   │     ├─ checkout/ banks (lista de bancos PSE), pse ★
   │     ├─ webhooks/wompi ★
   │     └─ admin/ products ★ products/[id] ★ licenses ★ stats
   ├─ components/ admin/ProductManager.tsx ★   checkout/PseForm.tsx
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

## 4. Seguridad aplicada
- Contraseñas con bcrypt costo 12; mínimo 10 caracteres; respuesta de login sin revelar si el correo existe.
- Prisma parametriza todas las consultas (incluida la raw con `$queryRaw` por plantilla) → sin inyección SQL.
- Validación de toda entrada con Zod; el precio siempre se toma de la BD.
- OTP de 6 dígitos guardado como HMAC, vence en 10 min, 5 intentos, 1 envío por minuto.
- Claves de licencia cifradas en reposo (AES-256-GCM); la clave nunca viaja por correo.
- Webhook: checksum verificado, doble consulta a Wompi, entrega idempotente.
- Admin: middleware + verificación del rol contra la BD en cada endpoint.

## 5. Pendientes antes de vender
- **Rate limiting** en login/registro/OTP (Upstash Ratelimit o similar) y 2FA para administradores.
- **Contratos de suministro**: compra las claves a distribuidores autorizados y conserva la trazabilidad; el texto de "revendedor autorizado" debe ser cierto.
- **Factura electrónica DIAN**: el correo de este código es un comprobante, no la factura. Integra un proveedor tecnológico (Siigo, Alegra, Factus u otro) y valida con tu contador.
- Política de datos personales (Ley 1581 de 2012), términos y condiciones, y revisión del descargo por un abogado.
- Orden pagada sin stock (`PAID_NO_STOCK`): conecta una alerta. Mejora futura: reservar claves al iniciar el checkout.
- Panel de ventas (`/api/admin/stats`): `prisma.order.aggregate({ where: { status: "PAID" }, _sum: { amountCop: true }, _count: true })` y `prisma.user.count()`.
- Verifica en la documentación de tu pasarela los métodos habilitados para tu cuenta y las comisiones vigentes.
