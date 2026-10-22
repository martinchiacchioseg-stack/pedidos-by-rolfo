# Pedidos by ROLΦ 🍕🍔📱

Sistema web multi-inquilino (*multi-tenant*) de pedidos gastronómicos por menú digital, con checkout directo por **WhatsApp**, panel de administración comercial con costeo de recetas y cálculo de margen de ganancia, y un panel central de **Súper Administrador oculto**.

Desarrollado con **Next.js 16 (App Router)**, **TypeScript**, **Tailwind CSS**, **Supabase (PostgreSQL + RLS + Auth)** y listo para desplegar en **Vercel**.

---

## 🌟 Características Principales

### 1. Catálogo Digital Mobile-First para Clientes (`/n/[slug]`)
- **Diseño Ultra Rápido y Responsive:** Adaptado a la palma de la mano con los colores y logo de cada comercio.
- **Categorías Dinámicas:** Navegación por solapas con contador de productos en vivo.
- **Carrito Interactivo:** Suma ítems, cálculo de subtotal y total en tiempo real, aclaraciones personalizadas por producto (ej: *"sin cebolla"*, *"bien cocida"*).
- **Checkout con Datos de Entrega:** Nombre, teléfono, modalidad (*Envío a domicilio* con dirección o *Retiro en el local*) y observaciones generales.
- **Envío por WhatsApp con Enlace `wa.me`:** Redacción automática de un mensaje claro y prolijo con el número de pedido listo para enviar al WhatsApp del negocio.
- **Pantalla de Confirmación:** Número de orden legible (ej: `#1024`), botón de reenvío a WhatsApp y botón para copiar el resumen al portapapeles.
- **Seguridad:** Protección anti-spam mediante honeypot y limitador de pedidos por IP (*rate limiting*).

### 2. Panel del Administrador del Negocio (`/admin`)
- **Bandeja de Pedidos en Vivo:** Gestión de comandas con estados (*Nuevo*, *En Cocina*, *Listo*, *Entregado*, *Cancelado*), filtros por estado, fecha y buscador.
- **ABM Completo de Productos & Recetas:** Fotografía con compresión automática en el navegador, precio de venta, categoría, receta de elaboración interna, lista de ingredientes con costos unitarios y **cálculo automático del costo total y margen comercial de ganancia**.
- **Interruptor de Menú:** Ocultar o mostrar productos en el catálogo público con un solo clic.
- **Gestión de Empleados:** Creación de usuarios con rol **Vendedor** (solo comisiones y pedidos, sin acceso a costos ni usuarios) o **Administrador** (acceso total).
- **Configuración Comercial:** Ajuste de nombre, logo, paleta de colores (primario y secundario), horarios de apertura/cierre, mensajes y **Número de WhatsApp receptor de pedidos** con validación internacional y botón de prueba.
- **Alerta de WhatsApp:** Si el negocio no configuró su número, se muestra un banner destacado recordándole que debe cargarlo para habilitar los pedidos.

### 3. Panel del Súper Administrador (Oculto) (`/superadmin`)
- **Acceso Oculto Discreto:** Al pie de cualquier página pública se encuentra el isotipo de ROLΦ. Al tocarlo/hacer clic, se abre el inicio de sesión de Súper Administrador. No existe ningún enlace ni texto visible.
- **Seguridad Central:** Protección contra ataques de fuerza bruta (bloqueo temporal tras intentos fallidos), credenciales iniciales cargadas por variables de entorno y validación de rol a nivel servidor.
- **Control de Negocios y Semáforo de Vencimientos:** Monitoreo en días restantes con estados visuales: *Vigente (verde)*, *Por vencer (amarillo <= 7 días)* o *Vencido (rojo)*.
- **Planes de Suscripción:** Definición y edición de planes base (*Mensual 30 días*, *Trimestral 90 días*, *Anual 365 días*).
- **Contraseñas Momentáneas:** Creación y reseteo de claves de cualquier usuario con forzado obligatorio de cambio en el primer ingreso (`must_change_password`).
- **Herramienta de Mantenimiento por Negocio:**
  - **Backup JSON:** Descarga de una copia de seguridad íntegra de productos, recetas, ingredientes, costos, pedidos, empleados y configuración.
  - **Restaurar JSON:** Carga con vista previa de ítems, validación de integridad y confirmación antes de restaurar.
  - **Reparación Básica:** Recálculo masivo de costos de recetas, purga de pedidos cancelados y restauración de estilos visuales.

---

## 🗄️ Modelo de Datos y Row Level Security (RLS)

El archivo `supabase/schema.sql` contiene la definición DDL completa:
- `planes`
- `negocios` (aislamiento multi-tenant vía `negocio_id`)
- `usuarios` (asociados a `auth.users`, roles `superadmin`, `admin`, `vendedor`)
- `categorias`
- `productos`
- `ingredientes` (costos unitarios y cantidades)
- `pedidos` y `pedido_items`
- `auditoria_accesos`

Todas las tablas cuentan con políticas de **Row Level Security (RLS)** activadas para garantizar que ningún negocio pueda ver ni alterar datos de otro comercio.

---

## 🚀 Puesta en Marcha Local

### 1. Clonar e Instalar Dependencias

```bash
cd pedidos-by-rolfo
npm install
```

### 2. Configurar Variables de Entorno

Creá un archivo `.env.local` basado en `.env.example`:

```env
# Conexión a tu proyecto Supabase (Project Settings -> API)
NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key-publica
SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key-secreta

# Credenciales del Súper Administrador (solo utilizadas en el seed)
SUPERADMIN_EMAIL=martinchiacchio.seg@gmail.com
SUPERADMIN_PASSWORD=Chiacchio@1938

# URL del Frontend
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Ejecutar el Esquema en Supabase
1. Ingresá al panel de Supabase de tu proyecto y abrí el **SQL Editor**.
2. Copiá y pegá el contenido de `supabase/schema.sql`.
3. Ejecutá el script (*Run*).

### 4. Ejecutar el Seed con Datos Demo
El script de inicialización creará los planes, la cuenta de Súper Administrador y el negocio demo **"ROLΦ Pizzas & Burgers"** con 11 productos cargados, fotografías reales, recetas e ingredientes:

```bash
npm run seed
```

### 5. Iniciar Servidor de Desarrollo

```bash
npm run dev
```

Abrí en tu navegador [http://localhost:3000](http://localhost:3000).

---

## 🔑 Credenciales de Acceso

### Súper Administrador (Acceso Oculto)
- **Ruta:** Tocando el logo `ROLΦ` en el pie de página o accediendo directamente a `/superadmin/login`
- **Email:** `martinchiacchio.seg@gmail.com`
- **Contraseña:** `Chiacchio@1938`

### Negocio Demo: "ROLΦ Pizzas & Burgers"
- **Catálogo Público:** `/n/rolfo-pizzas-burgers`
- **Login al Panel:** `/login`
- **Email Admin:** `admin@rolfopizzas.com`
- **Contraseña Inicial:** `Pizzas@2026` *(El sistema le exigirá definir una nueva clave personal en su primer ingreso)*

---

## 🌐 Guía de Despliegue en Vercel

1. Subí tu repositorio a **GitHub**.
2. Ingresá a [Vercel](https://vercel.com/) y seleccioná **Add New Project**.
3. Importá el repositorio de `pedidos-by-rolfo`.
4. En la sección **Environment Variables**, configurá:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPERADMIN_EMAIL`
   - `SUPERADMIN_PASSWORD`
   - `NEXT_PUBLIC_APP_URL` (la URL de producción asignada por Vercel, ej: `https://pedidos-by-rolfo.vercel.app`)
5. Presioná **Deploy**.
6. ¡Listo! Vercel compilará la aplicación y la dejará disponible globalmente en la red Edge.
