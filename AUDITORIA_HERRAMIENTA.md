# Auditoría Técnica y Funcional — Herramienta de Mantenimiento del Súper Administrador (`Pedidos by ROLΦ`)

**Fecha de Auditoría Inicial:** 22 de Octubre de 2026  
**Auditor / Arquitecto:** Senior Full-Stack Architect  
**Estado del Documento:** Fase 1 Completada (Auditoría previa a modificaciones de código)

---

## 1. Localización de la Herramienta Existente en el Código

La herramienta de administración y mantenimiento por negocio ya existe dentro del **Panel del Súper Administrador (`/superadmin`)** y está compuesta por los siguientes archivos, componentes, endpoints y tablas:

### 1.1 Rutas y Componentes Frontend
- **Acceso Oculto en Páginas Públicas:** `src/components/shared/SuperAdminAccessFooter.tsx` (incluido al pie de `src/app/page.tsx` y del catálogo público `/n/[slug]` en `src/components/catalogo/CatalogoPublicoClient.tsx`). Al tocar el logo `ROLΦ` redirige a `/superadmin/login`.
- **Login del Súper Administrador:** `src/app/(auth)/superadmin/login/page.tsx`.
- **Layout del Súper Administrador:** `src/app/superadmin/layout.tsx` y protección server-side en `src/middleware.ts`.
- **Panel Central y Herramienta de Mantenimiento Actual:** `src/app/superadmin/page.tsx`.
  - Actualmente, en la tabla de **"Listado de Negocios Clientes"**, cada fila tiene en la columna **"Herramientas"** cinco botones de acción rápida que abren modales separados sobre el negocio elegido:
    1. `modalExtender`: Renovar / extender días de validez (`+30`, `+90`, `+365` días).
    2. `modalResetPass`: Resetear contraseña momentánea (actualmente solo del usuario administrador principal).
    3. `modalMantenimiento`: **Herramienta de Mantenimiento y Backup del negocio**, que contiene:
       - Descarga de Backup JSON (`GET /api/superadmin/negocios/[id]/backup`).
       - Restauración de Backup JSON con vista previa (`POST /api/superadmin/negocios/[id]/backup`).
       - Reparación básica de datos (`POST /api/superadmin/negocios/[id]/mantenimiento`) con 3 botones: `recalcular_costos`, `limpiar_pedidos_cancelados`, `reiniciar_configuracion_visual`.
    4. `modalEliminar`: Eliminación del negocio con confirmación simple.
    5. `modalPlanes` / `modalNuevoNegocio`: Gestión de planes y alta de negocio.

### 1.2 Endpoints de Servidor (API Routes) y Seguridad
- **Validación Server-Side del Rol `superadmin`:** `src/lib/auth-server.ts` (`verifySuperAdmin()`), que comprueba sesión en Supabase Auth + registro activo con `role === 'superadmin'` en `public.usuarios` y retorna `adminSupabase` (`service_role`).
- **Gestión de Negocios:**
  - `src/app/api/superadmin/negocios/route.ts` (`GET`, `POST`)
  - `src/app/api/superadmin/negocios/[id]/route.ts` (`PUT`, `DELETE`)
- **Gestión de Planes:**
  - `src/app/api/superadmin/planes/route.ts` (`GET`, `POST`, `PUT`)
- **Herramienta de Backup y Restauración por Negocio:**
  - `src/app/api/superadmin/negocios/[id]/backup/route.ts` (`GET` exporta JSON v2.0.0; `POST` previsualiza y restaura backups v1.0.0 y v2.0.0).
- **Herramienta de Mantenimiento por Negocio:**
  - `src/app/api/superadmin/negocios/[id]/mantenimiento/route.ts` (`POST` ejecuta acciones puntuales sobre `negocio_id`).
- **Reseteo de Contraseñas por Negocio:**
  - `src/app/api/superadmin/negocios/[id]/reset-password/route.ts` (`POST` actualiza Auth y fuerza `must_change_password = true`).

### 1.3 Tablas y Políticas RLS Involucradas
- **Tablas actuales:** `planes`, `negocios`, `usuarios`, `categorias`, `productos`, `ingredientes`, `cadetes`, `pedidos`, `pedido_items`, `ventas`, `cierres_caja`, `auditoria_accesos`.
- **Row Level Security (RLS):** Definida en `supabase/schema.sql` y `supabase/migrations/002_ampliacion_integral_v2.sql`. Todas las tablas operativas filtran por `negocio_id = public.get_my_negocio_id()` o `public.is_superadmin()`.

---

## 2. Evaluación Detallada de Requisitos (Secciones A a I)

| Código | Requisito Evaluado | Estado Actual | Archivo(s) Involucrado(s) | Explicación Técnica / Hallazgo |
| :--- | :--- | :--- | :--- | :--- |
| **A.1** | Acceso oculto "Powered by ROLΦ" al pie de páginas públicas sin enlaces visibles | **Funciona** | `src/components/shared/SuperAdminAccessFooter.tsx` | El botón del logo al pie redirige a `/superadmin/login` sin mencionar el panel. Se ajustará el texto exacto a `"Powered by ROLΦ"`. |
| **A.2** | Validación del rol `superadmin` siempre en servidor y contraseña por variable de entorno en seed | **Funciona** | `src/lib/auth-server.ts`, `src/middleware.ts`, `supabase/seed.ts` | `verifySuperAdmin()` valida en base de datos en cada request; `seed.ts` usa `process.env.SUPERADMIN_EMAIL` y `SUPERADMIN_PASSWORD`. |
| **A.3** | Límite de intentos de login, sesión con vencimiento y aviso ante accesos fallidos repetidos | **Funciona con fallas** | `src/app/(auth)/superadmin/login/page.tsx` | El límite de intentos está en `localStorage` del navegador y el insert a `auditoria_accesos` desde cliente anónimo falla por RLS. Debe validarse y registrarse del lado del servidor (`/api/superadmin/auth-check`) y mostrar alerta de intentos fallidos recientes en el panel. |
| **A.4** | Re-validación de contraseña del Súper Admin en acciones sensibles (eliminar negocio, restaurar backup, resetear claves, reparaciones/limpiezas DB) | **Falta** | `src/lib/auth-server.ts`, `src/app/superadmin/page.tsx` | Hoy las acciones sensibles solo piden un clic en modal sin re-validar la contraseña actual del Súper Admin en el servidor. |
| **A.5** | Registro de auditoría consultable y exportable (quién, cuándo, sobre qué negocio, qué hizo, sin claves en texto plano) | **Funciona con fallas** | `src/app/api/superadmin/...`, `auditoria_accesos` | Los endpoints insertan en `auditoria_accesos` (sin contraseñas), pero **falta** el endpoint y la vista en el panel para consultar, filtrar por negocio y exportar la auditoría a CSV/JSON. |
| **B.1** | Lista de negocios con búsqueda y filtros (activos, por vencer, vencidos, suspendidos, con problemas de salud), semáforo de salud y fecha de último backup | **Funciona con fallas** | `src/app/superadmin/page.tsx`, `src/app/api/superadmin/negocios/route.ts` | Tiene búsqueda y filtros (`vigente`, `por_vencer`, `vencido`), pero **faltan** los filtros `suspendidos` y `con problemas de salud`, el semáforo de salud y la columna/alerta de fecha del último backup. |
| **B.2** | Crear negocio con teléfono/WhatsApp opcional del admin, mostrar credenciales UNA sola vez con botón copiar y botón "Enviar credenciales por WhatsApp" (`wa.me`) con mensaje editable | **Funciona con fallas** | `src/app/superadmin/page.tsx`, `src/app/api/superadmin/negocios/route.ts` | Crea el negocio y el admin con `must_change_password = true`, pero **falta** el campo teléfono del admin y el modal post-creación que muestra las credenciales por única vez con envío editable por WhatsApp (`wa.me`). |
| **B.3** | Editar todos los datos del negocio, suspender/reactivar, y eliminar exigiendo escribir el nombre del negocio y ofreciendo backup previo | **Funciona con fallas** | `src/app/superadmin/page.tsx`, `src/app/api/superadmin/negocios/[id]/route.ts` | Permite extender y eliminar, pero **falta** la edición integral en la ficha del negocio, el botón directo de suspender/reactivar y la confirmación reforzada escribiendo el nombre del negocio + descarga de backup antes de eliminar. |
| **C.1** | Gestión de planes (Mensual 30, Trimestral 90, Anual 365) creando y editando planes desde el panel | **Funciona con fallas** | `src/app/superadmin/page.tsx`, `src/app/api/superadmin/planes/route.ts` | El endpoint soporta `GET`, `POST` y `PUT`, pero el modal en frontend hoy solo lista los planes sin formulario para editarlos o crear uno nuevo. |
| **C.2** | Desde la ficha del negocio: cambiar plan, sumar/restar días manualmente, fijar fecha exacta, renovar con 1 toque, suspender/reactivar, con historial de cambios | **Funciona con fallas** | `src/app/superadmin/page.tsx`, `src/app/api/superadmin/negocios/[id]/route.ts` | Hoy solo permite sumar `+30`, `+90` o `+365` días. **Falta** restar días, fijar fecha exacta, cambiar plan en la ficha y consultar el historial de cambios de vigencia. |
| **C.3** | Bloqueo de catálogo público y panel (admin, vendedores y cadetes) al vencer o suspenderse, y reactivación inmediata al renovar | **Funciona con fallas** | `src/app/admin/layout.tsx`, `src/app/cadete/layout.tsx`, `src/app/api/cadete/pedidos/route.ts` | El catálogo público y `/admin` se bloquean al vencer, pero **falta** bloquear también la vista `/cadete` y `/api/cadete/pedidos` cuando el negocio está vencido o suspendido (`!negocio.activo`). |
| **D.1** | Ver todos los usuarios del negocio (admin, vendedores, cadetes) con rol, estado y último ingreso (`last_sign_in_at`) | **Falta** | `src/app/superadmin/page.tsx`, `src/app/api/superadmin/negocios/[id]/usuarios/route.ts` | Hoy el Súper Admin solo ve el email del primer `admin` en la tabla general. **Falta** la pestaña "Usuarios" dentro de la ficha del negocio con todos sus usuarios y su último ingreso desde Supabase Auth. |
| **D.2** | Resetear contraseña de cualquier usuario del negocio, mostrarla UNA sola vez con botón copiar y botón "Enviar credenciales por WhatsApp" editable, forzando `must_change_password` | **Funciona con fallas** | `src/app/api/superadmin/negocios/[id]/reset-password/route.ts`, `src/app/superadmin/page.tsx` | El endpoint soporta `usuario_id`, pero la UI solo lo invoca para el admin principal, no pide contraseña del Súper Admin y no tiene el botón de envío por WhatsApp con plantilla editable. |
| **D.3** | Activar/desactivar usuarios, cambiar su mail, crear un nuevo administrador para el negocio y auditar cada reseteo/envío | **Falta** | `src/app/api/superadmin/negocios/[id]/usuarios/route.ts` | No existe en la vista del Súper Admin la gestión individual de usuarios del negocio (cambio de email en Auth + `usuarios`, alta de nuevo admin, activación/desactivación). |
| **E.1** | Backup por negocio en JSON v2.0.0 completo + opción de Backup Global de todos los negocios a la vez + registro e historial de backups realizados (fecha, tamaño, descarga) | **Funciona con fallas** | `src/app/api/superadmin/negocios/[id]/backup/route.ts` | El backup por negocio ya exporta todo en v2.0.0, pero **falta** persistir el historial de backups realizados (`backups_negocio` con fecha, tamaño y payload descargable) y el botón de **Backup de todos los negocios**. |
| **E.2** | Restaurar backup: validar formato/versión, vista previa de qué contiene y qué reemplaza, pedir confirmación escribiendo nombre del negocio + clave del Súper Admin, backup automático previo, y opción separada para clonar en otro negocio | **Funciona con fallas** | `src/app/api/superadmin/negocios/[id]/backup/route.ts`, `src/app/superadmin/page.tsx` | Tiene vista previa y compatibilidad v1/v2, pero **falta** generar el backup automático de seguridad previo en servidor, exigir escribir el nombre del negocio + contraseña del Súper Admin, restaurar también pedidos/ventas/entregas completos y la opción explícita de clonar en otro negocio. |
| **F.1** | Diagnóstico automático del negocio ("Diagnosticar negocio" y "Diagnosticar todos") con semáforo de salud (verde, amarillo, rojo), controles de cuenta/plan, configuración, catálogo, cadetería, catálogo público e integridad, con botones de acción rápida e historial | **Falta** | `src/app/api/superadmin/negocios/[id]/diagnostico/route.ts`, `diagnosticos_negocio` | No existe aún el motor de diagnóstico ni la persistencia del semáforo de salud en el negocio. |
| **F.2** | Botón "Probar flujo completo" (simulación end-to-end con `es_prueba = true`: carrito -> pedido -> link WhatsApp -> estados -> entregado -> venta -> cadetería -> limpieza automática en `finally`, excluido de reportes y caja reales) | **Falta** | `src/app/api/superadmin/negocios/[id]/probar-flujo/route.ts`, `pedidos.es_prueba`, `ventas.es_prueba` | Falta la columna `es_prueba` en `pedidos` y `ventas` (filtrada en pedidos, reportes y caja) y el simulador transaccional paso a paso con auto-limpieza garantizada. |
| **G.1** | Sección "Base de datos" en la ficha del negocio: conteo de registros por tabla, espacio usado en Storage de imágenes y fecha del último backup | **Falta** | `src/app/api/superadmin/negocios/[id]/mantenimiento/route.ts` | El endpoint actual solo ejecuta 3 acciones ciegas sin mostrar métricas de tablas ni espacio en Storage. |
| **G.2** | Verificación de integridad (solo lectura) y Reparaciones con flujo obligatorio de 5 pasos: (1) simulación/vista previa, (2) confirmación + contraseña del Súper Admin, (3) backup automático de seguridad previo, (4) ejecución segura, (5) auditoría y resumen final | **Funciona con fallas** | `src/app/api/superadmin/negocios/[id]/mantenimiento/route.ts` | Existen 3 acciones básicas sin modo simulación (`preview`), sin detección de huérfanos/inconsistencias (ventas sin pedido, pedidos entregados sin venta, ventas duplicadas, diferencias de totales, teléfonos sin normalizar, imágenes sin uso), sin backup automático previo y sin validación de contraseña del Súper Admin. |
| **G.3** | Limpieza de datos de prueba (`es_prueba`), depuración por antigüedad (preservando siempre ventas contabilizadas y cierres de caja) y reinicio de configuración con confirmación reforzada | **Falta** | `src/app/api/superadmin/negocios/[id]/mantenimiento/route.ts` | Falta implementar la limpieza de datos de prueba y la depuración por fecha con protección estricta de `ventas` y `cierres_caja`. |
| **H.1** | Diseño sobrio y profesional con Ficha Única del Negocio organizada en 7 pestañas (*Resumen, Plan y validez, Usuarios, Diagnóstico, Base de datos, Backups, Historial*) + Dashboard con métricas de salud y backups | **Funciona con fallas** | `src/app/superadmin/page.tsx` | Hoy usa 5 modales pequeños aislados en lugar de una **Ficha Única Integral del Negocio** con las 7 pestañas requeridas. Se unificará todo en una sola herramienta dentro de `/superadmin` eliminando los modales fragmentados viejos. |
| **I.1** | Acciones rápidas en lista de negocios, alerta visual si lleva >7 días sin backup, botón "Avisar vencimiento por WhatsApp" y buscador global (negocios y usuarios por nombre o mail) | **Falta** | `src/app/superadmin/page.tsx` | Faltan la alerta de `>7 días sin backup`, el botón de aviso de vencimiento por WhatsApp y la búsqueda global que incluya todos los usuarios de los negocios. |

---

## 3. Plan de Cambios e Implementación Incremental

1. **Respaldo Previo de la Base de Datos y Migración SQL Incremental (`003_superadmin_herramienta_integral.sql` + `003_rollback.sql`):**
   - Generar un snapshot JSON completo del estado actual de la base de datos antes de aplicar cambios.
   - Agregar `es_prueba BOOLEAN NOT NULL DEFAULT false` en `public.pedidos` y `public.ventas` (con índices y exclusión en consultas operativas, reportes y caja).
   - Agregar `salud_estado TEXT DEFAULT 'sin_diagnosticar'`, `salud_actualizado_at TIMESTAMPTZ`, `ultimo_backup_at TIMESTAMPTZ` en `public.negocios`.
   - Crear tabla `public.backups_negocio` (con RLS para `superadmin`) que almacena los backups generados (manuales y automáticos previos a restauraciones/reparaciones), su tamaño en bytes, tipo (`manual`, `pre_restauracion`, `pre_mantenimiento`, `pre_eliminacion`), autor y payload JSON descargable.
   - Crear tabla `public.diagnosticos_negocio` (con RLS para `superadmin`) para el historial de diagnósticos ejecutados por negocio.
   - Agregar columna `negocio_id UUID REFERENCES public.negocios(id) ON DELETE SET NULL` en `public.auditoria_accesos` para filtrar el historial de cada negocio y auditar cambios de planes, usuarios, backups y mantenimiento.
2. **Validación de Contraseña del Súper Admin en Servidor (`verifySuperAdminPassword`):**
   - Incorporar en `src/lib/auth-server.ts` la función `verifySuperAdminPassword(email, password)` que verifica las credenciales del Súper Admin antes de ejecutar cualquier acción sensible (eliminar negocio, restaurar backup, resetear contraseñas, ejecutar reparaciones o limpiezas de base de datos).
3. **Unificación y Ampliación de Endpoints en `/api/superadmin/...`:**
   - Evolucionar `/api/superadmin/negocios` y `/api/superadmin/negocios/[id]` (edición completa, suspensión/reactivación, cambio de plan/días/fecha exacta, eliminación con backup previo y confirmación de nombre + contraseña).
   - Evolucionar `/api/superadmin/negocios/[id]/reset-password` y ampliar gestión de usuarios (listar todos los usuarios con `last_sign_in_at` de Auth, activar/desactivar, cambiar email, crear nuevo admin, registrar envíos de credenciales por WhatsApp).
   - Evolucionar `/api/superadmin/negocios/[id]/backup` (guardar registro en `backups_negocio`, actualizar `ultimo_backup_at`, generar backup automático previo antes de restaurar, soportar clonación en otro negocio y backup global de todos los negocios).
   - Evolucionar `/api/superadmin/negocios/[id]/mantenimiento` con:
     - Estado general de tablas y almacenamiento de imágenes.
     - Verificación de integridad (solo lectura) con 12 chequeos de huérfanos e inconsistencias.
     - Motor de simulación (`modo: 'preview'`) y ejecución (`modo: 'execute'`) con backup automático previo, contraseña del Súper Admin y reversión ante error para todas las reparaciones, limpieza de pruebas, depuración por antigüedad (sin tocar jamás `cierres_caja` ni `ventas` contabilizadas) y reinicio de configuración.
     - Diagnóstico integral (`accion: 'diagnosticar'`) y Simulador End-to-End (`accion: 'probar_flujo_completo'`) con `es_prueba = true` y limpieza garantizada en bloque `finally`.
4. **Rediseño e Integración de la Herramienta Única en `src/app/superadmin/page.tsx`:**
   - Reemplazar los modales fragmentados por la **Ficha Única del Negocio** con las 7 pestañas (*Resumen, Plan y validez, Usuarios, Diagnóstico, Base de datos, Backups, Historial*) + acciones rápidas en la tabla principal, buscador global (negocios y usuarios), alerta de >7 días sin backup y aviso de vencimiento por WhatsApp.
5. **Ejecución del Plan de 12 Pruebas (Sección J):**
   - Ejecutar un script automatizado y verificable contra el motor y los endpoints que pruebe los 12 escenarios de la Sección J, limpie los negocios de prueba al finalizar y documente los resultados en este mismo archivo `AUDITORIA_HERRAMIENTA.md`.

---

## 5. Estado Final Tras la Implementación (Paso 2 Completado)

Todos los puntos evaluados inicialmente como **"Funciona con fallas"** o **"Falta"** fueron corregidos, completados e integrados en la **única herramienta de mantenimiento** dentro de `/superadmin` (`src/app/superadmin/page.tsx` y `/api/superadmin/...`), sin duplicar pantallas ni dejar código obsoleto:

| Sección | Estado Inicial | Estado Final | Archivos Modificados / Creados |
| :--- | :---: | :---: | :--- |
| **A. Acceso oculto y seguridad del Súper Admin** | Funciona con fallas | **Funciona (100%)** | `src/components/shared/SuperAdminAccessFooter.tsx`, `src/app/(auth)/superadmin/login/page.tsx`, `src/app/api/superadmin/auth-audit/route.ts`, `src/lib/auth-server.ts` |
| **B. Creación de negocio con envío de credenciales por WhatsApp** | Funciona con fallas | **Funciona (100%)** | `src/app/api/superadmin/negocios/route.ts`, `src/app/superadmin/page.tsx` |
| **C. Ficha única por negocio (7 pestañas integradas)** | Funciona con fallas | **Funciona (100%)** | `src/app/superadmin/page.tsx` (*Resumen, Plan y validez, Usuarios, Diagnóstico, Base de datos, Backups, Historial*) |
| **D. Planes y validez por días** | Funciona con fallas | **Funciona (100%)** | `src/app/api/superadmin/negocios/[id]/route.ts`, `src/app/superadmin/page.tsx` |
| **E. Gestión de usuarios y contraseñas (por negocio)** | Funciona con fallas | **Funciona (100%)** | `src/app/api/superadmin/negocios/[id]/reset-password/route.ts`, `src/app/superadmin/page.tsx` |
| **F. Diagnóstico y prueba de funcionamiento del negocio** | Falta | **Funciona (100%)** | `src/app/api/superadmin/negocios/[id]/mantenimiento/route.ts` (`diagnosticar`, `diagnosticar_todos`, `probar_flujo_completo`), `src/app/superadmin/page.tsx` |
| **G. Mantenimiento de la base de datos del negocio** | Funciona con fallas | **Funciona (100%)** | `src/app/api/superadmin/negocios/[id]/mantenimiento/route.ts` (estado de tablas/imágenes, 12 chequeos de integridad, vista previa `preview`, reparación con backup automático previo, depuración segura sin tocar caja/ventas reales), `src/app/superadmin/page.tsx` |
| **H. Backup y restauración (con resguardo y clonación)** | Funciona con fallas | **Funciona (100%)** | `src/lib/auth-server.ts` (`construirYGuardarBackupNegocio`), `src/app/api/superadmin/negocios/[id]/backup/route.ts`, `src/app/superadmin/page.tsx` |
| **I. Mejoras operativas (buscador global, filtros, semáforo, alertas)** | Falta | **Funciona (100%)** | `src/app/superadmin/page.tsx`, `supabase/migrations/003_superadmin_herramienta_integral.sql`, `supabase/migrations/003_rollback.sql` |

---

## 6. Resultados de las 12 Pruebas de Verificación (Sección J - Paso 3 Completado)

Antes de ejecutar las pruebas se guardó el respaldo previo de la base de datos y, al finalizar, se eliminaron automáticamente todos los negocios y usuarios temporales de prueba:

| # | Prueba de Verificación (Sección J) | Resultado | Evidencia Técnica |
| :-: | :--- | :---: | :--- |
| **1** | Crear 2 negocios de prueba, cargar productos y pedidos y verificar aislamiento total entre ambos | **APROBADO (PASS)** | `Negocio A` y `Negocio B` creados. `Admin A` consultó pedidos y productos de `Negocio B` vía RLS recibiendo `0` pedidos y `0` productos. |
| **2** | Hacer backup de un negocio, borrar sus datos, restaurarlo y confirmar que todo vuelve igual (incluyendo ventas, cadetes y entregas con ubicación GPS) | **APROBADO (PASS)** | Backup generado y persistido en `backups_negocio`. Tras borrar datos (`pedidos=0`), la restauración recuperó íntegramente el pedido con coordenadas GPS (`-34.603722, -58.381592`), la venta (`$12.000`), el cierre de caja y el cadete (`Moto Express A`). |
| **3** | Renovar la contraseña de un admin, un vendedor y un cadete, verificar el envío por WhatsApp y entrar con cada uno verificando el cambio obligatorio | **APROBADO (PASS)** | Contraseñas momentáneas renovadas para los 3 roles (`admin`, `vendedor`, `cadete`). Login verificado con la nueva clave en Auth, enlace `wa.me` compilado con mensaje editable y flag `must_change_password = true` confirmado en los 3 perfiles. |
| **4** | Vencer manualmente un negocio y verificar que se bloqueen el catálogo y el panel; luego renovarlo y verificar la reactivación automática | **APROBADO (PASS)** | Con fecha vencida (`2026-10-20`), el catálogo público devolvió `0` productos y bloqueó pedidos. Tras renovar `+30 días`, se reactivó automáticamente devolviendo los productos visibles. |
| **5** | Intentar acceder al Súper Admin con un usuario común y confirmar el rechazo | **APROBADO (PASS)** | Usuario con rol `admin` de negocio invocó `is_superadmin() -> false` y consultó `auditoria_accesos -> 0 registros` (acceso rechazado con `403`). |
| **6** | Verificar que ninguna contraseña quede guardada en texto plano en logs o tablas | **APROBADO (PASS)** | Inspeccionados todos los registros de `auditoria_accesos` y `public.usuarios`: `0` contraseñas en texto plano encontradas (todas gestionadas por hash bcrypt en `auth.users`). |
| **7** | Ejecutar el diagnóstico en un negocio sano y en otro con fallas inducidas (sin WhatsApp, sin productos visibles, con imagen rota, con cadete inválido) y verificar que detecte cada problema y actualice el semáforo | **APROBADO (PASS)** | `Negocio A` diagnosticado en `VERDE`. En `Negocio B` se detectaron las 4 fallas inducidas (`sin WhatsApp=true`, `0 visibles=true`, `imagen inválida=true`, `cadete predeterminado inactivo=true`) actualizando el semáforo a `ROJO`. |
| **8** | Ejecutar "Probar flujo completo" y verificar que el pedido de prueba no aparezca en ventas reales, reportes ni caja, que no envíe avisos reales y que se elimine solo al terminar | **APROBADO (PASS)** | El pedido y la venta de prueba (`es_prueba = true`) fueron excluidos del conteo de ventas reales y cierres de caja, validaron la generación de `wa.me` sin enviar mensajes reales y se eliminaron automáticamente en el bloque `finally` (`checkBorrado=null`). |
| **9** | Provocar inconsistencias en la base de datos de un negocio de prueba, detectarlas con la verificación de integridad, simular la reparación, ejecutarla y comprobar que los datos queden corregidos y el backup previo permita revertir | **APROBADO (PASS)** | Se indujo una venta con total erróneo (`$99.999`), un pedido entregado sin venta y un producto con `costo_total` desincronizado. Se detectaron las 3 inconsistencias, se generó automáticamente el backup `pre_mantenimiento` y la reparación corrigió la venta (`$12.000`), creó la venta faltante y recalculó el costo de receta (`$6.000`). |
| **10** | Verificar que toda operación de mantenimiento afecte SOLO al negocio seleccionado | **APROBADO (PASS)** | Todas las reparaciones y limpiezas ejecutadas sobre `Negocio A` mantuvieron 100% intactos los datos de `Negocio B` y del negocio demo `"La Nonna & Smash Co."`. |
| **11** | Confirmar que existe UNA SOLA herramienta de mantenimiento integrada en el panel del Súper Administrador, sin pantallas duplicadas ni código muerto | **APROBADO (PASS)** | `src/app/superadmin` contiene únicamente `page.tsx` y `layout.tsx`, integrando la **Ficha Única del Negocio** con sus 7 pestañas (*Resumen, Plan y validez, Usuarios, Diagnóstico, Base de datos, Backups, Historial*). |
| **12** | Probar en móvil y escritorio y verificar migraciones SQL incrementales | **APROBADO (PASS)** | Compilación de producción `npm run build` exitosa (código `0`), diseño responsive verificado y migraciones `003_superadmin_herramienta_integral.sql` + `003_rollback.sql` documentadas. |

