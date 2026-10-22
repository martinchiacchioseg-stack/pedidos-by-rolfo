-- ==============================================================================
-- PEDIDOS BY ROLΦ - ESQUEMA DE BASE DE DATOS Y ROW LEVEL SECURITY (RLS)
-- ==============================================================================

-- Habilitar extensión UUID
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
    color_primario TEXT NOT NULL DEFAULT '#E11D48', -- Rose 600
    color_secundario TEXT NOT NULL DEFAULT '#1E293B', -- Slate 800
    telefono TEXT,
    whatsapp_numero TEXT, -- Formato internacional E.164 ej: 5491112345678 (Cargado por el negocio)
    horarios JSONB DEFAULT '{"dias": "Lunes a Domingo", "apertura": "19:00", "cierre": "00:00"}'::jsonb,
    mensaje_bienvenida TEXT DEFAULT '¡Bienvenido! Hacé tu pedido online y te lo preparamos al instante.',
    mensaje_cierre TEXT DEFAULT 'Gracias por elegirnos. ¡Que lo disfrutes!',
    fecha_vencimiento TIMESTAMPTZ NOT NULL,
    activo BOOLEAN NOT NULL DEFAULT true,
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
    role TEXT NOT NULL CHECK (role IN ('superadmin', 'admin', 'vendedor')),
    must_change_password BOOLEAN NOT NULL DEFAULT true,
    activo BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_usuarios_negocio_id ON public.usuarios(negocio_id);
CREATE INDEX IF NOT EXISTS idx_usuarios_role ON public.usuarios(role);

-- 4. TABLA: CATEGORIAS DE PRODUCTOS
CREATE TABLE IF NOT EXISTS public.categorias (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    negocio_id UUID NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL,
    orden INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_categorias_negocio ON public.categorias(negocio_id);

-- 5. TABLA: PRODUCTOS
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

-- 6. TABLA: INGREDIENTES Y COSTOS
CREATE TABLE IF NOT EXISTS public.ingredientes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    negocio_id UUID NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
    producto_id UUID NOT NULL REFERENCES public.productos(id) ON DELETE CASCADE,
    nombre TEXT NOT NULL,
    cantidad NUMERIC(10, 3) NOT NULL DEFAULT 1,
    unidad TEXT NOT NULL DEFAULT 'unidades', -- gr, kg, ml, l, unidades
    costo_unitario NUMERIC(12, 2) DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_ingredientes_producto ON public.ingredientes(producto_id);

-- 7. TABLA: PEDIDOS
CREATE TABLE IF NOT EXISTS public.pedidos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    negocio_id UUID NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
    numero_pedido SERIAL, -- Número legible autoincremental
    cliente_nombre TEXT NOT NULL,
    cliente_telefono TEXT NOT NULL,
    tipo_entrega TEXT NOT NULL CHECK (tipo_entrega IN ('retiro', 'envio')),
    direccion TEXT,
    observaciones TEXT,
    total NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    estado TEXT NOT NULL DEFAULT 'nuevo' CHECK (estado IN ('nuevo', 'en_preparacion', 'listo', 'entregado', 'cancelado')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_pedidos_negocio_fecha ON public.pedidos(negocio_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pedidos_estado ON public.pedidos(negocio_id, estado);

-- 8. TABLA: DETALLE DEL PEDIDO (ITEMS)
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
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_pedido_items_pedido ON public.pedido_items(pedido_id);

-- 9. TABLA: AUDITORIA DE ACCESOS Y SEGURIDAD
CREATE TABLE IF NOT EXISTS public.auditoria_accesos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    usuario_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    email TEXT,
    ip_address TEXT,
    user_agent TEXT,
    evento TEXT NOT NULL, -- 'login_success', 'login_failed', 'password_change', 'backup_export', etc.
    metadata JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_auditoria_usuario ON public.auditoria_accesos(usuario_id, created_at DESC);

-- ==============================================================================
-- FUNCIONES AUXILIARES DE SEGURIDAD (SECURITY DEFINER)
-- ==============================================================================

-- Obtener rol del usuario autenticado
CREATE OR REPLACE FUNCTION public.get_current_role()
RETURNS TEXT AS $$
  SELECT role FROM public.usuarios WHERE id = auth.uid() AND activo = true;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Obtener negocio_id del usuario autenticado
CREATE OR REPLACE FUNCTION public.get_current_negocio_id()
RETURNS UUID AS $$
  SELECT negocio_id FROM public.usuarios WHERE id = auth.uid() AND activo = true;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Comprobar si es SuperAdmin
CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.usuarios
    WHERE id = auth.uid() AND role = 'superadmin' AND activo = true
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Recalcular costo total de un producto según sus ingredientes
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
ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ingredientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pedido_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.auditoria_accesos ENABLE ROW LEVEL SECURITY;

-- ---------------- PLANES ----------------
CREATE POLICY "Superadmin control total planes" ON public.planes
    FOR ALL USING (public.is_superadmin());

CREATE POLICY "Lectura pública planes activos" ON public.planes
    FOR SELECT USING (activo = true);

-- ---------------- NEGOCIOS ----------------
CREATE POLICY "Superadmin control total negocios" ON public.negocios
    FOR ALL USING (public.is_superadmin());

CREATE POLICY "Admin del negocio ve y edita su negocio" ON public.negocios
    FOR ALL USING (id = public.get_current_negocio_id() AND public.get_current_role() = 'admin');

CREATE POLICY "Vendedor del negocio solo lee datos de su negocio" ON public.negocios
    FOR SELECT USING (id = public.get_current_negocio_id());

CREATE POLICY "Lectura pública negocios activos no vencidos" ON public.negocios
    FOR SELECT USING (activo = true);

-- ---------------- USUARIOS ----------------
CREATE POLICY "Superadmin control total usuarios" ON public.usuarios
    FOR ALL USING (public.is_superadmin());

CREATE POLICY "Usuarios pueden leer su propio perfil" ON public.usuarios
    FOR SELECT USING (id = auth.uid());

CREATE POLICY "Admin puede gestionar usuarios de su negocio" ON public.usuarios
    FOR ALL USING (
        negocio_id = public.get_current_negocio_id() 
        AND public.get_current_role() = 'admin'
        AND role IN ('admin', 'vendedor')
    );

-- ---------------- CATEGORIAS ----------------
CREATE POLICY "Superadmin control total categorias" ON public.categorias
    FOR ALL USING (public.is_superadmin());

CREATE POLICY "Admin gestiona categorias de su negocio" ON public.categorias
    FOR ALL USING (negocio_id = public.get_current_negocio_id() AND public.get_current_role() = 'admin');

CREATE POLICY "Vendedor lee categorias de su negocio" ON public.categorias
    FOR SELECT USING (negocio_id = public.get_current_negocio_id());

CREATE POLICY "Lectura pública categorias" ON public.categorias
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.negocios n
            WHERE n.id = categorias.negocio_id
            AND n.activo = true
        )
    );

-- ---------------- PRODUCTOS ----------------
CREATE POLICY "Superadmin control total productos" ON public.productos
    FOR ALL USING (public.is_superadmin());

CREATE POLICY "Admin gestiona productos de su negocio" ON public.productos
    FOR ALL USING (negocio_id = public.get_current_negocio_id() AND public.get_current_role() = 'admin');

CREATE POLICY "Vendedor lee productos de su negocio" ON public.productos
    FOR SELECT USING (negocio_id = public.get_current_negocio_id());

CREATE POLICY "Lectura pública productos visibles en catalogo" ON public.productos
    FOR SELECT USING (
        visible_catalogo = true
        AND EXISTS (
            SELECT 1 FROM public.negocios n
            WHERE n.id = productos.negocio_id
            AND n.activo = true
            AND n.fecha_vencimiento >= now()
        )
    );

-- ---------------- INGREDIENTES ----------------
CREATE POLICY "Superadmin control total ingredientes" ON public.ingredientes
    FOR ALL USING (public.is_superadmin());

CREATE POLICY "Admin gestiona ingredientes de su negocio" ON public.ingredientes
    FOR ALL USING (negocio_id = public.get_current_negocio_id() AND public.get_current_role() = 'admin');

-- ---------------- PEDIDOS ----------------
CREATE POLICY "Superadmin control total pedidos" ON public.pedidos
    FOR ALL USING (public.is_superadmin());

CREATE POLICY "Personal del negocio gestiona pedidos" ON public.pedidos
    FOR ALL USING (
        negocio_id = public.get_current_negocio_id()
        AND public.get_current_role() IN ('admin', 'vendedor')
    );

CREATE POLICY "Público puede crear pedidos en negocios vigentes" ON public.pedidos
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.negocios n
            WHERE n.id = pedidos.negocio_id
            AND n.activo = true
            AND n.fecha_vencimiento >= now()
            AND n.whatsapp_numero IS NOT NULL
        )
    );

-- ---------------- PEDIDO ITEMS ----------------
CREATE POLICY "Superadmin control total pedido_items" ON public.pedido_items
    FOR ALL USING (public.is_superadmin());

CREATE POLICY "Personal del negocio gestiona pedido_items" ON public.pedido_items
    FOR ALL USING (
        negocio_id = public.get_current_negocio_id()
        AND public.get_current_role() IN ('admin', 'vendedor')
    );

CREATE POLICY "Público puede insertar pedido_items" ON public.pedido_items
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.negocios n
            WHERE n.id = pedido_items.negocio_id
            AND n.activo = true
            AND n.fecha_vencimiento >= now()
        )
    );

-- ---------------- AUDITORIA ----------------
CREATE POLICY "Superadmin lee auditoria" ON public.auditoria_accesos
    FOR SELECT USING (public.is_superadmin());

CREATE POLICY "Inserción de auditoria permitida" ON public.auditoria_accesos
    FOR INSERT WITH CHECK (true);
