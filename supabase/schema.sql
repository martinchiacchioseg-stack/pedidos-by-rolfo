-- ==============================================================================
-- PEDIDOS BY ROLΦ - ESQUEMA MAESTRO DE BASE DE DATOS Y ROW LEVEL SECURITY (RLS)
-- Versión 2.0 (Incluye migración incremental 002)
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. TABLA: PLANES DE SUSCRIPCIÓN
CREATE TABLE IF NOT EXISTS public.planes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    nombre TEXT NOT NULL,
    duracion_dias INTEGER NOT NULL CHECK (duracion_dias > 0),
    precio NUMERIC(12, 2) DEFAULT 0.00,
    descripcion TEXT,
    activo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2. TABLA: NEGOCIOS
CREATE TABLE IF NOT EXISTS public.negocios (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    plan_id UUID REFERENCES public.planes(id) ON DELETE SET NULL,
    nombre TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    logo_url TEXT,
    banner_url TEXT,
    slogan TEXT,
    color_primario TEXT NOT NULL DEFAULT '#E11D48',
    color_secundario TEXT NOT NULL DEFAULT '#1E293B',
    tipografia_id TEXT NOT NULL DEFAULT 'modern' CHECK (tipografia_id IN ('modern', 'editorial', 'artisan', 'bold')),
    tema_catalogo TEXT NOT NULL DEFAULT 'oscuro' CHECK (tema_catalogo IN ('oscuro', 'claro')),
    estilo_bordes TEXT NOT NULL DEFAULT 'suave' CHECK (estilo_bordes IN ('suave', 'recto', 'redondeado')),
    telefono TEXT,
    whatsapp_numero TEXT,
    direccion_local TEXT DEFAULT 'Av. Corrientes 1234, CABA',
    abierto_manual BOOLEAN NOT NULL DEFAULT true,
    modo_apertura TEXT NOT NULL DEFAULT 'manual' CHECK (modo_apertura IN ('manual', 'automatico')),
    horarios JSONB DEFAULT '{"dias": "Lunes a Domingo", "apertura": "19:00", "cierre": "00:00"}'::jsonb,
    horarios_semanales JSONB DEFAULT '{
      "lunes": {"activo": true, "franjas": [{"apertura": "11:30", "cierre": "15:00"}, {"apertura": "19:30", "cierre": "23:59"}]},
      "martes": {"activo": true, "franjas": [{"apertura": "11:30", "cierre": "15:00"}, {"apertura": "19:30", "cierre": "23:59"}]},
      "miercoles": {"activo": true, "franjas": [{"apertura": "11:30", "cierre": "15:00"}, {"apertura": "19:30", "cierre": "23:59"}]},
      "jueves": {"activo": true, "franjas": [{"apertura": "11:30", "cierre": "15:00"}, {"apertura": "19:30", "cierre": "23:59"}]},
      "viernes": {"activo": true, "franjas": [{"apertura": "11:30", "cierre": "15:00"}, {"apertura": "19:30", "cierre": "01:00"}]},
      "sabado": {"activo": true, "franjas": [{"apertura": "12:00", "cierre": "15:30"}, {"apertura": "19:30", "cierre": "01:30"}]},
      "domingo": {"activo": true, "franjas": [{"apertura": "19:30", "cierre": "00:00"}]}
    }'::jsonb,
    tiempo_preparacion_min INTEGER NOT NULL DEFAULT 30 CHECK (tiempo_preparacion_min >= 0),
    momento_aviso_cadeteria TEXT NOT NULL DEFAULT 'listo' CHECK (momento_aviso_cadeteria IN ('al_aceptar', 'minutos_antes', 'listo', 'manual')),
    minutos_antes_aviso INTEGER NOT NULL DEFAULT 10 CHECK (minutos_antes_aviso >= 0),
    avisar_cliente_en_camino BOOLEAN NOT NULL DEFAULT true,
    plantillas_whatsapp JSONB DEFAULT '{
      "cliente_listo": "Hola {nombre}, tu pedido N° #{numero_pedido} de {negocio} ya está listo para retirar. Total: {total}. ¡Gracias por elegirnos!",
      "cliente_en_camino": "Hola {nombre}, tu pedido N° #{numero_pedido} de {negocio} ya está en camino a {direccion}. Hora estimada: {hora_estimada}. ¡Que lo disfrutes!",
      "cadeteria_externa": "PEDIDO LISTO PARA RETIRAR - #{numero_pedido}\nRetirar en: {direccion_retiro} ({negocio})\nEntregar a: {nombre} ({telefono})\nDirección: {direccion}\nReferencias: {referencias}\nMapa: {link_mapa}\nMedio de pago: {medio_pago}\nMonto a cobrar en efectivo: {monto_a_cobrar}\nObservaciones: {observaciones}",
      "cadete_propio": "Nuevo envío asignado #{numero_pedido} en {negocio}.\nRetiro: {direccion_retiro}\nCliente: {nombre} ({telefono})\nDestino: {direccion} ({referencias})\nMapa: {link_mapa}\nCobrar: {monto_a_cobrar} ({medio_pago})\nHora estimada: {hora_estimada}"
    }'::jsonb,
    mensaje_bienvenida TEXT DEFAULT '¡Bienvenido! Hacé tu pedido online y te lo preparamos al instante.',
    mensaje_cierre TEXT DEFAULT 'Gracias por elegirnos. ¡Que lo disfrutes!',
    fecha_vencimiento TIMESTAMPTZ NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT true,
    salud_estado TEXT NOT NULL DEFAULT 'verde' CHECK (salud_estado IN ('verde', 'amarillo', 'rojo')),
    salud_ultimo_check TIMESTAMPTZ,
    salud_resumen JSONB DEFAULT '{}'::jsonb,
    ultimo_backup_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_negocios_slug ON public.negocios(slug);
CREATE INDEX IF NOT EXISTS idx_negocios_activo_vencimiento ON public.negocios(activo, fecha_vencimiento);

-- 3. TABLA: USUARIOS (Perfiles asociados a auth.users)
CREATE TABLE IF NOT EXISTS public.usuarios (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    negocio_id UUID REFERENCES public.negocios(id) ON DELETE CASCADE,
    email TEXT NOT NULL,
    nombre TEXT NOT NULL,
    telefono TEXT,
    role TEXT NOT NULL CHECK (role IN ('superadmin', 'admin', 'vendedor', 'cadete')),
    must_change_password BOOLEAN NOT NULL DEFAULT true,
    acepto_privacidad_gps BOOLEAN NOT NULL DEFAULT false,
    acepto_privacidad_at TIMESTAMPTZ,
    push_subscription JSONB,
    activo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_usuarios_negocio_id ON public.usuarios(negocio_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_role ON public.usuarios(role);

-- 4. TABLA: CADETES (Propios con usuario o Empresas externas)
CREATE TABLE IF NOT EXISTS public.cadetes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    negocio_id UUID NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
    tipo TEXT NOT NULL CHECK (tipo IN ('propio', 'externa')),
    usuario_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
    nombre TEXT NOT NULL,
    telefono_whatsapp TEXT NOT NULL,
    es_predeterminado BOOLEAN NOT NULL DEFAULT false,
    activo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_cadetes_negocio ON public.cadetes(negocio_id, activo);
CREATE INDEX IF NOT EXISTS idx_cadetes_usuario ON public.cadetes(usuario_id);

-- 5. TABLA: CATEGORIAS DE PRODUCTOS
CREATE TABLE IF NOT EXISTS public.categorias (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    negocio_id UUID NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL,
    orden INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_categorias_negocio ON public.categorias(negocio_id);

-- 6. TABLA: PRODUCTOS
CREATE TABLE IF NOT EXISTS public.productos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    negocio_id UUID NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
    categoria_id UUID REFERENCES public.categorias(id) ON DELETE SET NULL,
    nombre TEXT NOT NULL,
    descripcion TEXT,
    precio_venta NUMERIC(12, 2) NOT NULL DEFAULT 0.00 CHECK (precio_venta >= 0),
    imagen_url TEXT,
    receta TEXT,
    costo_total NUMERIC(12, 2) DEFAULT 0.00,
    visible_catalogo BOOLEAN NOT NULL DEFAULT true,
    orden INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_productos_negocio_cat ON public.productos(negocio_id, categoria_id);
CREATE INDEX IF NOT EXISTS idx_productos_visible ON public.productos(negocio_id, visible_catalogo);

-- 7. TABLA: INGREDIENTES Y COSTOS
CREATE TABLE IF NOT EXISTS public.ingredientes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    negocio_id UUID NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
    producto_id UUID NOT NULL REFERENCES public.productos(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL,
    cantidad NUMERIC(10, 3) NOT NULL DEFAULT 1,
    unidad TEXT NOT NULL DEFAULT 'unidades',
    costo_unitario NUMERIC(12, 2) DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_ingredientes_producto ON public.ingredientes(producto_id);

-- 8. TABLA: PEDIDOS
CREATE TABLE IF NOT EXISTS public.pedidos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    negocio_id UUID NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
    numero_pedido SERIAL,
    origen TEXT NOT NULL DEFAULT 'online' CHECK (origen IN ('online', 'manual')),
    cliente_nombre TEXT NOT NULL,
    cliente_telefono TEXT NOT NULL,
    tipo_entrega TEXT NOT NULL CHECK (tipo_entrega IN ('retiro', 'envio')),
    direccion TEXT,
    referencias_direccion TEXT,
    zona_entrega TEXT,
    observaciones TEXT,
    total NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    descuento_total NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    costo_envio NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    medio_pago TEXT CHECK (medio_pago IS NULL OR medio_pago IN ('efectivo', 'transferencia', 'mercadopago')),
    estado_pago TEXT NOT NULL DEFAULT 'pendiente' CHECK (estado_pago IN ('pendiente', 'pagado')),
    monto_a_cobrar NUMERIC(12, 2),
    monto_cobrado_declarado NUMERIC(12, 2),
    estado TEXT NOT NULL DEFAULT 'nuevo' CHECK (estado IN ('nuevo', 'en_preparacion', 'listo', 'en_camino', 'entregado', 'cancelado')),
    cadete_id UUID REFERENCES public.cadetes(id) ON DELETE SET NULL,
    aceptado_at TIMESTAMPTZ,
    asignado_at TIMESTAMPTZ,
    aviso_programado_at TIMESTAMPTZ,
    cadeteria_avisada_at TIMESTAMPTZ,
    cliente_avisado_listo_at TIMESTAMPTZ,
    cliente_avisado_camino_at TIMESTAMPTZ,
    retirado_at TIMESTAMPTZ,
    entregado_at TIMESTAMPTZ,
    entrega_lat NUMERIC(10, 7),
    entrega_lng NUMERIC(10, 7),
    entrega_precision_m NUMERIC(8, 2),
    entregado_sin_ubicacion BOOLEAN NOT NULL DEFAULT false,
    motivo_sin_ubicacion TEXT,
    no_entregado_motivo TEXT,
    no_entregado_observacion TEXT,
    no_entregado_at TIMESTAMPTZ,
    cerrado_por_usuario_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
    motivo_cancelacion TEXT,
    es_prueba BOOLEAN NOT NULL DEFAULT false,
    metadata_futura JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_pedidos_negocio_fecha ON public.pedidos(negocio_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pedidos_estado ON public.pedidos(negocio_id, estado);
CREATE INDEX IF NOT EXISTS idx_pedidos_cadete ON public.pedidos(cadete_id, estado);
CREATE INDEX IF NOT EXISTS idx_pedidos_origen ON public.pedidos(negocio_id, origen);

-- 9. TABLA: DETALLE DEL PEDIDO (ITEMS)
CREATE TABLE IF NOT EXISTS public.pedido_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pedido_id UUID NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
    negocio_id UUID NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
    producto_id UUID REFERENCES public.productos(id) ON DELETE SET NULL,
    nombre_producto TEXT NOT NULL,
    precio_unitario NUMERIC(12, 2) NOT NULL,
    cantidad INTEGER NOT NULL DEFAULT 1 CHECK (cantidad > 0),
    subtotal NUMERIC(12, 2) NOT NULL,
    aclaraciones TEXT,
    opciones_seleccionadas JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_pedido_items_pedido ON public.pedido_items(pedido_id);

-- 10. TABLA: VENTAS AUTOMÁTICAS
CREATE TABLE IF NOT EXISTS public.ventas (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    negocio_id UUID NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
    pedido_id UUID NOT NULL UNIQUE REFERENCES public.pedidos(id) ON DELETE CASCADE,
    fecha_venta TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    total NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    costo_estimado NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    tiene_costos_cargados BOOLEAN NOT NULL DEFAULT false,
    medio_pago TEXT CHECK (medio_pago IS NULL OR medio_pago IN ('efectivo', 'transferencia', 'mercadopago')),
    origen TEXT NOT NULL DEFAULT 'online' CHECK (origen IN ('online', 'manual')),
    tipo_entrega TEXT NOT NULL DEFAULT 'retiro' CHECK (tipo_entrega IN ('retiro', 'envio')),
    cadete_id UUID REFERENCES public.cadetes(id) ON DELETE SET NULL,
    tiempo_entrega_min INTEGER,
    cerrado_por_usuario_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
    anulada BOOLEAN NOT NULL DEFAULT false,
    motivo_anulacion TEXT,
    anulada_por_usuario_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
    anulada_at TIMESTAMPTZ,
    es_prueba BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_ventas_negocio_fecha ON public.ventas(negocio_id, fecha_venta DESC);
CREATE INDEX IF NOT EXISTS idx_ventas_anulada ON public.ventas(negocio_id, anulada);

-- 11. TABLA: CIERRES DE CAJA
CREATE TABLE IF NOT EXISTS public.cierres_caja (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    negocio_id UUID NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
    cerrado_por_usuario_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
    cerrado_por_nombre TEXT,
    fecha_referencia DATE NOT NULL,
    fecha_cierre TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    total_vendido NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_efectivo_esperado NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_transferencia NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    total_mercadopago NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    efectivo_declarado_cadetes NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    efectivo_contado NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    diferencia_efectivo NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    cantidad_pedidos INTEGER NOT NULL DEFAULT 0,
    cantidad_anulaciones INTEGER NOT NULL DEFAULT 0,
    total_anulaciones NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    observaciones TEXT,
    resumen_json JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_cierres_caja_negocio_fecha ON public.cierres_caja(negocio_id, fecha_cierre DESC);

-- 12. TABLA: AUDITORIA DE ACCESOS Y SEGURIDAD
CREATE TABLE IF NOT EXISTS public.auditoria_accesos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    negocio_id UUID REFERENCES public.negocios(id) ON DELETE SET NULL,
    email TEXT,
    ip_address TEXT,
    user_agent TEXT,
    evento TEXT NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_auditoria_usuario ON public.auditoria_accesos(usuario_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auditoria_negocio ON public.auditoria_accesos(negocio_id, created_at DESC);

-- 13. TABLA: HISTORIAL DE BACKUPS POR NEGOCIO Y GLOBALES
CREATE TABLE IF NOT EXISTS public.backups_negocio (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    negocio_id UUID REFERENCES public.negocios(id) ON DELETE CASCADE,
    creado_por_usuario_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
    creado_por_email TEXT,
    tipo TEXT NOT NULL DEFAULT 'manual' CHECK (tipo IN ('manual', 'pre_restauracion', 'pre_mantenimiento', 'global')),
    version_esquema TEXT NOT NULL DEFAULT '2.1',
    tamano_bytes INTEGER NOT NULL DEFAULT 0,
    conteo_registros JSONB NOT NULL DEFAULT '{}'::jsonb,
    notas TEXT,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_backups_negocio_fecha ON public.backups_negocio(negocio_id, created_at DESC);

-- 14. TABLA: HISTORIAL DE DIAGNÓSTICOS Y PRUEBAS DE FLUJO
CREATE TABLE IF NOT EXISTS public.diagnosticos_negocio (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    negocio_id UUID NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
    ejecutado_por_usuario_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
    tipo TEXT NOT NULL DEFAULT 'diagnostico' CHECK (tipo IN ('diagnostico', 'prueba_flujo', 'integridad_bd')),
    semaforo TEXT NOT NULL CHECK (semaforo IN ('verde', 'amarillo', 'rojo')),
    resumen TEXT NOT NULL,
    resultados JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_diagnosticos_negocio_fecha ON public.diagnosticos_negocio(negocio_id, created_at DESC);

-- ==============================================================================
-- FUNCIONES AUXILIARES DE SEGURIDAD (SECURITY DEFINER)
-- ==============================================================================

CREATE OR REPLACE FUNCTION public.get_current_role()
RETURNS TEXT AS $$
  SELECT role FROM public.usuarios WHERE id = auth.uid() AND activo = true;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.get_current_negocio_id()
RETURNS UUID AS $$
  SELECT negocio_id FROM public.usuarios WHERE id = auth.uid() AND activo = true;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.usuarios
    WHERE id = auth.uid() AND role = 'superadmin' AND activo = true
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.get_current_cadete_id()
RETURNS UUID AS $$
  SELECT id FROM public.cadetes WHERE usuario_id = auth.uid() AND activo = true LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.recalcular_costo_producto(p_producto_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE public.productos
  SET costo_total = COALESCE((
    SELECT SUM(cantidad * COALESCE(costo_unitario, 0))
    FROM public.ingredientes
    WHERE producto_id = p_producto_id
  ), 0)
  WHERE id = p_producto_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ==============================================================================

ALTER TABLE public.planes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.negocios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cadetes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingredientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedido_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ventas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cierres_caja ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auditoria_accesos ENABLE ROW LEVEL SECURITY;

-- PLANES
CREATE POLICY "Superadmin control total planes" ON public.planes FOR ALL USING (public.is_superadmin());
CREATE POLICY "Lectura pública planes activos" ON public.planes FOR SELECT USING (activo = true);

-- NEGOCIOS
CREATE POLICY "Superadmin control total negocios" ON public.negocios FOR ALL USING (public.is_superadmin());
CREATE POLICY "Admin del negocio ve y edita su negocio" ON public.negocios FOR ALL USING (id = public.get_current_negocio_id() AND public.get_current_role() = 'admin');
CREATE POLICY "Personal del negocio lee datos de su negocio" ON public.negocios FOR SELECT USING (id = public.get_current_negocio_id());
CREATE POLICY "Lectura pública negocios activos no vencidos" ON public.negocios FOR SELECT USING (activo = true);

-- USUARIOS
CREATE POLICY "Superadmin control total usuarios" ON public.usuarios FOR ALL USING (public.is_superadmin());
CREATE POLICY "Usuarios pueden leer su propio perfil" ON public.usuarios FOR SELECT USING (id = auth.uid());
CREATE POLICY "Usuarios actualizan su propio perfil basico" ON public.usuarios FOR UPDATE USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "Admin puede gestionar usuarios de su negocio" ON public.usuarios FOR ALL USING (
    negocio_id = public.get_current_negocio_id()
    AND public.get_current_role() = 'admin'
    AND role IN ('admin', 'vendedor', 'cadete')
);

-- CADETES
CREATE POLICY "Superadmin control total cadetes" ON public.cadetes FOR ALL USING (public.is_superadmin());
CREATE POLICY "Admin gestiona cadetes de su negocio" ON public.cadetes FOR ALL USING (negocio_id = public.get_current_negocio_id() AND public.get_current_role() = 'admin');
CREATE POLICY "Vendedor lee cadetes de su negocio" ON public.cadetes FOR SELECT USING (negocio_id = public.get_current_negocio_id() AND public.get_current_role() = 'vendedor');
CREATE POLICY "Cadete lee su propio registro de cadete" ON public.cadetes FOR SELECT USING (usuario_id = auth.uid() AND public.get_current_role() = 'cadete');

-- CATEGORIAS
CREATE POLICY "Superadmin control total categorias" ON public.categorias FOR ALL USING (public.is_superadmin());
CREATE POLICY "Admin gestiona categorias de su negocio" ON public.categorias FOR ALL USING (negocio_id = public.get_current_negocio_id() AND public.get_current_role() = 'admin');
CREATE POLICY "Vendedor lee categorias de su negocio" ON public.categorias FOR SELECT USING (negocio_id = public.get_current_negocio_id() AND public.get_current_role() = 'vendedor');
CREATE POLICY "Lectura pública categorias" ON public.categorias FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.negocios n WHERE n.id = categorias.negocio_id AND n.activo = true)
);

-- PRODUCTOS
CREATE POLICY "Superadmin control total productos" ON public.productos FOR ALL USING (public.is_superadmin());
CREATE POLICY "Admin gestiona productos de su negocio" ON public.productos FOR ALL USING (negocio_id = public.get_current_negocio_id() AND public.get_current_role() = 'admin');
CREATE POLICY "Vendedor lee productos de su negocio" ON public.productos FOR SELECT USING (negocio_id = public.get_current_negocio_id() AND public.get_current_role() = 'vendedor');
CREATE POLICY "Lectura pública productos visibles en catalogo" ON public.productos FOR SELECT USING (
    visible_catalogo = true
    AND EXISTS (SELECT 1 FROM public.negocios n WHERE n.id = productos.negocio_id AND n.activo = true AND n.fecha_vencimiento >= now())
);

-- INGREDIENTES
CREATE POLICY "Superadmin control total ingredientes" ON public.ingredientes FOR ALL USING (public.is_superadmin());
CREATE POLICY "Admin gestiona ingredientes de su negocio" ON public.ingredientes FOR ALL USING (negocio_id = public.get_current_negocio_id() AND public.get_current_role() = 'admin');

-- PEDIDOS
CREATE POLICY "Superadmin control total pedidos" ON public.pedidos FOR ALL USING (public.is_superadmin());
CREATE POLICY "Personal del negocio gestiona pedidos" ON public.pedidos FOR ALL USING (
    negocio_id = public.get_current_negocio_id() AND public.get_current_role() IN ('admin', 'vendedor')
);
CREATE POLICY "Cadete ve sus propios pedidos asignados" ON public.pedidos FOR SELECT USING (
    negocio_id = public.get_current_negocio_id()
    AND public.get_current_role() = 'cadete'
    AND cadete_id = public.get_current_cadete_id()
    AND created_at >= (now() - interval '30 days')
);
CREATE POLICY "Cadete actualiza estado de sus pedidos asignados" ON public.pedidos FOR UPDATE USING (
    negocio_id = public.get_current_negocio_id()
    AND public.get_current_role() = 'cadete'
    AND cadete_id = public.get_current_cadete_id()
);
CREATE POLICY "Público puede crear pedidos en negocios vigentes" ON public.pedidos FOR INSERT WITH CHECK (
    EXISTS (
        SELECT 1 FROM public.negocios n
        WHERE n.id = pedidos.negocio_id AND n.activo = true AND n.fecha_vencimiento >= now() AND n.whatsapp_numero IS NOT NULL
    )
);

-- PEDIDO ITEMS
CREATE POLICY "Superadmin control total pedido_items" ON public.pedido_items FOR ALL USING (public.is_superadmin());
CREATE POLICY "Personal del negocio gestiona pedido_items" ON public.pedido_items FOR ALL USING (
    negocio_id = public.get_current_negocio_id() AND public.get_current_role() IN ('admin', 'vendedor')
);
CREATE POLICY "Cadete lee items de sus pedidos asignados" ON public.pedido_items FOR SELECT USING (
    negocio_id = public.get_current_negocio_id()
    AND public.get_current_role() = 'cadete'
    AND EXISTS (SELECT 1 FROM public.pedidos p WHERE p.id = pedido_items.pedido_id AND p.cadete_id = public.get_current_cadete_id())
);
CREATE POLICY "Público puede insertar pedido_items" ON public.pedido_items FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.negocios n WHERE n.id = pedido_items.negocio_id AND n.activo = true AND n.fecha_vencimiento >= now())
);

-- VENTAS
CREATE POLICY "Superadmin control total ventas" ON public.ventas FOR ALL USING (public.is_superadmin());
CREATE POLICY "Admin gestiona ventas de su negocio" ON public.ventas FOR ALL USING (negocio_id = public.get_current_negocio_id() AND public.get_current_role() = 'admin');

-- CIERRES DE CAJA (Inmutables: solo SELECT e INSERT)
CREATE POLICY "Superadmin control total cierres_caja" ON public.cierres_caja FOR ALL USING (public.is_superadmin());
CREATE POLICY "Admin lee cierres_caja de su negocio" ON public.cierres_caja FOR SELECT USING (negocio_id = public.get_current_negocio_id() AND public.get_current_role() = 'admin');
CREATE POLICY "Admin crea cierres_caja de su negocio" ON public.cierres_caja FOR INSERT WITH CHECK (negocio_id = public.get_current_negocio_id() AND public.get_current_role() = 'admin');

-- AUDITORIA Y MANTENIMIENTO SUPERADMIN
ALTER TABLE public.backups_negocio ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diagnosticos_negocio ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Superadmin lee auditoria" ON public.auditoria_accesos FOR SELECT USING (public.is_superadmin());
CREATE POLICY "Inserción de auditoria permitida" ON public.auditoria_accesos FOR INSERT WITH CHECK (true);
CREATE POLICY "Superadmin control total backups_negocio" ON public.backups_negocio FOR ALL USING (public.is_superadmin());
CREATE POLICY "Superadmin control total diagnosticos_negocio" ON public.diagnosticos_negocio FOR ALL USING (public.is_superadmin());
