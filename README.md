# licentech-web

Aplicación web de LicenTech Colombia. El código de Next.js está en [`licentech/`](./licentech/).

## Desplegar en Vercel

1. Importa este repositorio desde GitHub en Vercel.
2. En **Root Directory**, selecciona `licentech`. Vercel detectará Next.js y ejecutará el build.
3. Crea una base de datos PostgreSQL administrada (por ejemplo, Neon o Supabase) y agrega sus variables en **Project Settings → Environment Variables**. Empieza con los nombres de [`licentech/.env.example`](./licentech/.env.example); no subas `.env` ni `.env.local`.
4. Configura `DATABASE_URL` con la URL de la base de datos y define secretos seguros únicos para `JWT_SECRET`, `APP_PEPPER` y `LICENSE_ENC_KEY`. Añade las credenciales de Wompi y los servicios de correo/SMS que quieras habilitar. No uses las credenciales de ejemplo en producción.
5. Antes de probar la aplicación, aplica las migraciones a esa base de datos:

   ```bash
   cd licentech
   DATABASE_URL="URL_DE_LA_BASE_DE_DATOS" npx prisma migrate deploy
   ```

   Ejecuta este comando desde un entorno local de confianza y no publiques la URL ni la pegues en el repositorio. Para crear el primer administrador, configura `ADMIN_EMAIL` y `ADMIN_PASSWORD` en un entorno seguro y sigue las instrucciones del seed de la aplicación.
6. Despliega y registra en Wompi la URL de webhook que muestra Vercel, terminada en `/api/webhooks/wompi`.

El alojamiento gratuito de Vercel no incluye necesariamente una base de datos PostgreSQL; configura un proveedor de base de datos aparte y revisa sus límites gratuitos. No habilites pagos reales hasta completar y verificar la configuración de Wompi y las variables de entorno.