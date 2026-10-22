# Pedidos by ROLΦ — Sistema Multinegocio de Menú Digital, Despacho, Ventas, Caja y App del Cadete (v2.0)

**Pedidos by ROLΦ** es una plataforma web full-stack, mobile-first e instalable como PWA para gestión gastronómica multinegocio con aislamiento estricto por Row Level Security (RLS), catálogo público personalizable por marca, pedidos online y manuales por WhatsApp, generación automática de ventas, reportes de rentabilidad, cierre de caja inmutable y aplicación exclusiva para cadetes con captura puntual de ubicación GPS al entregar.

---

## Stack Tecnológico

- **Frontend & Backend:** Next.js 16 (App Router) + TypeScript + Tailwind CSS v4
- **Iconografía y Tipografías:** `lucide-react` (sin emojis en interfaz) + 4 pares tipográficos curados vía `next/font/google` (`modern`, `bold`, `artisan`, `editorial`)
- **Base de Datos, Auth & RLS:** Supabase (PostgreSQL + Auth + Storage + Row Level Security)
- **Zona Horaria Oficial:** `America/Argentina/Buenos_Aires` (`es-AR`)
- **Despliegue:** Vercel

---

## Novedades de la Ampliación Integral (v2.0)

1. **Nuevo Rol `cadete` y App Móvil (`/cadete`):**
   - Vista exclusiva de alto contraste instalable como PWA (`/cadete`).
   - Ve únicamente los envíos asignados a su perfil, sin acceso a costos, ganancias, ventas, caja ni pedidos de otros cadetes.
   - Botones de un toque para **Llamar**, **WhatsApp**, **Google Maps** y **Waze**.
   - **Privacidad GPS estricta:** La coordenada GPS se captura **únicamente en el instante puntual de marcar "Entregado"** (sin rastreo en segundo plano). Incluye cola offline para zonas de baja señal y anonimización automática del teléfono y domicilio del cliente una vez finalizada la entrega.
2. **Negocio Abierto / Cerrado y Horarios Semanales (Sección A):**
   - Interruptor rápido **Abierto / Cerrado** de un toque en el encabezado del panel.
   - Horarios semanales configurables con hasta **dos franjas horarias por día** (mediodía y noche) y modo **Manual** o **Automático por horarios**.
   - Cuando está cerrado, el catálogo público muestra el cartel *"Cerrado ahora"* indicando el próximo horario de apertura y deshabilita el envío de pedidos.
3. **Pedidos Mejorados, Pedido Manual y Avisos por WhatsApp (Secciones B, C y G):**
   - Carga rápida de **Pedidos Manuales** (mostrador o telefónicos) con buscador instantáneo de productos.
   - Flujo completo de estados (`nuevo`, `en_preparacion`, `listo`, `en_camino`, `entregado`, `cancelado`), medios de pago (`efectivo`, `transferencia`, `mercadopago`) y alerta sonora para nuevas órdenes.
   - Modal de previsualización editable antes de abrir WhatsApp (`wa.me`) para avisar al cliente (*"Pedido listo"* / *"Pedido en camino"*) o a la cadetería.
4. **Cadetería Propia y Externa (Sección H):**
   - ABM de cadetes propios (con usuario y clave momentánea) y empresas de cadetería externa (solo WhatsApp).
   - Reglas configurables de aviso a cadetería (*al aceptar*, *X minutos antes de estar listo*, *cuando pasa a listo*, o *manual*) con contador visual de avisos pendientes.
5. **Ventas Automáticas, Reportes y Cierre de Caja Inmutable (Secciones D, E y F):**
   - Al pasar un pedido a `entregado`, se genera automáticamente la venta en `public.ventas` calculando el costo estimado de la receta. Si un pedido entregado se cancela, la venta se marca como **anulada** guardando usuario y motivo.
   - **Reporte de Ventas (`/admin/reportes`, solo Admin):** KPIs, evolución diaria, medios de pago, online vs. manual, ranking de productos, entregas y tiempo promedio por cadete, ganancia estimada y exportación CSV.
   - **Cierre de Caja (`/admin/caja`, solo Admin):** Arqueo diario de efectivo esperado vs. contado, efectivo declarado por cadetes, alerta de pedidos sin medio de pago e historial inmutable.
6. **Herramienta Integral de Mantenimiento del Súper Administrador (`/superadmin` - v2.1):**
   - **Acceso Oculto Seguro:** Pie de página `"Powered by ROLΦ"` sin enlaces visibles, con límite de intentos de login del lado del servidor, alerta visual de intentos fallidos y re-validación de la contraseña del Súper Admin en acciones sensibles.
   - **Ficha Única por Negocio (7 pestañas):** *Resumen*, *Plan y validez*, *Usuarios*, *Diagnóstico*, *Base de datos*, *Backups* e *Historial*.
   - **Diagnóstico Automático y Semáforo de Salud:** Evalúa en un clic configuración, catálogo, recetas, cadetería, usuarios y actividad reciente de uno o todos los negocios (*"Diagnosticar todos"*), actualizando el semáforo (`verde`, `amarillo`, `rojo`) y ofreciendo botones *"Corregir ahora"*.
   - **Simulador End-to-End (`"Probar flujo completo"`):** Ejecuta una prueba automática de 6 pasos con datos marcados como `es_prueba = true` (excluidos de ventas reales, reportes y cierres de caja, sin enviar avisos reales por WhatsApp) y elimina automáticamente los datos de prueba al finalizar.
   - **Mantenimiento y Verificación de Integridad de Base de Datos:** Detecta y repara inconsistencias por negocio (ventas faltantes o desincronizadas, costos de recetas, cierres de caja, ingredientes huérfanos e imágenes sin uso en Storage), permite vista previa (*dry-run*) antes de ejecutar limpiezas y genera un backup automático previo antes de cualquier modificación.
   - **Backups, Restauración y Clonación:** Backups por negocio y backup global de todos los negocios, historial de backups con descarga y restauración en un clic (generando backup automático de resguardo antes de restaurar) y clonación de estructura hacia un negocio nuevo.

---

## Migraciones SQL (Incrementales y Reversibles)

En la carpeta `supabase/` encontrarás:
- `supabase/schema.sql`: Esquema maestro consolidado (v2.1).
- `supabase/migrations/002_ampliacion_integral_v2.sql` y `002_rollback.sql`: Migración incremental y rollback de la ampliación v2.0 (`cadetes`, `ventas`, `cierres_caja`).
- `supabase/migrations/003_superadmin_herramienta_integral.sql` y `003_rollback.sql`: Migración incremental y rollback de la herramienta integral de mantenimiento (`backups_negocio`, `diagnosticos_negocio`, semáforo de salud y banderas `es_prueba`).

---

## Ejecución Local y Seed

1. Configurar `.env.local`:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://tu-proyecto.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=tu-anon-key
   SUPABASE_SERVICE_ROLE_KEY=tu-service-role-key
   SUPERADMIN_EMAIL=martinchiacchio.seg@gmail.com
   SUPERADMIN_PASSWORD=TuPasswordSegura
   ```
2. Ejecutar migración SQL en el SQL Editor de Supabase pegando el contenido de `supabase/migrations/002_ampliacion_integral_v2.sql`.
3. Poblar datos de ejemplo:
   ```bash
   npm run seed
   ```
4. Iniciar servidor de desarrollo:
   ```bash
   npm run dev
   ```
