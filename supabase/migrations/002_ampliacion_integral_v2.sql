-- ==============================================================================
-- MIGRACIÓN INCREMENTAL V2: AMPLIACIÓN INTEGRAL PEDIDOS BY ROLΦ
-- Conserva todos los datos existentes. Incluye RLS por negocio_id.
-- Zona horaria de referencia: America/Argentina/Buenos_Aires
-- ==============================================================================

BEGIN;

-- 1. AMPLIAR TABLA USUARIOS (Nuevo rol 'cadete', privacidad GPS y Web Push)
ALTER TABLE public.usuarios DROP CONSTRAINT IF EXISTS usuarios_role_check;
ALTER TABLE public.usuarios
  ADD CONSTRAINT usuarios_role_check
  CHECK (role IN ('superadmin', 'admin', 'vendedor', 'cadete'));

ALTER TABLE public.usuarios
  ADD COLUMN IF NOT EXISTS acepto_privacidad_gps BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS acepto_privacidad_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS telefono TEXT,
  ADD COLUMN IF NOT EXISTS push_subscription JSONB;

-- Actualizar política de Admin para poder gestionar también usuarios con rol 'cadete'
DROP POLICY IF EXISTS "Admin puede gestionar usuarios de su negocio" ON public.usuarios;
CREATE POLICY "Admin puede gestionar usuarios de su negocio" ON public.usuarios
  FOR ALL USING (
    negocio_id = public.get_current_negocio_id()
    AND public.get_current_role() = 'admin'
    AND role IN ('admin', 'vendedor', 'cadete')
  );

-- Permitir al usuario actualizar su propio consentimiento de privacidad GPS y push_subscription
DROP POLICY IF EXISTS "Usuarios actualizan su propio perfil basico" ON public.usuarios;
CREATE POLICY "Usuarios actualizan su propio perfil basico" ON public.usuarios
  FOR UPDATE USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- 2. AMPLIAR TABLA NEGOCIOS (Horarios doble franja, Abierto/Cerrado, Cadetería, Plantillas y Marca)
ALTER TABLE public.negocios
  ADD COLUMN IF NOT EXISTS abierto_manual BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS modo_apertura TEXT NOT NULL DEFAULT 'manual'
    CHECK (modo_apertura IN ('manual', 'automatico')),
  ADD COLUMN IF NOT EXISTS horarios_semanales JSONB DEFAULT '{
    "lunes": {"activo": true, "franjas": [{"apertura": "11:30", "cierre": "15:00"}, {"apertura": "19:30", "cierre": "23:59"}]},
    "martes": {"activo": true, "franjas": [{"apertura": "11:30", "cierre": "15:00"}, {"apertura": "19:30", "cierre": "23:59"}]},
    "miercoles": {"activo": true, "franjas": [{"apertura": "11:30", "cierre": "15:00"}, {"apertura": "19:30", "cierre": "23:59"}]},
    "jueves": {"activo": true, "franjas": [{"apertura": "11:30", "cierre": "15:00"}, {"apertura": "19:30", "cierre": "23:59"}]},
    "viernes": {"activo": true, "franjas": [{"apertura": "11:30", "cierre": "15:00"}, {"apertura": "19:30", "cierre": "01:00"}]},
    "sabado": {"activo": true, "franjas": [{"apertura": "12:00", "cierre": "15:30"}, {"apertura": "19:30", "cierre": "01:30"}]},
    "domingo": {"activo": true, "franjas": [{"apertura": "19:30", "cierre": "00:00"}]}
  }'::jsonb,
  ADD COLUMN IF NOT EXISTS direccion_local TEXT DEFAULT 'Av. Corrientes 1234, CABA',
  ADD COLUMN IF NOT EXISTS tiempo_preparacion_min INTEGER NOT NULL DEFAULT 30 CHECK (tiempo_preparacion_min >= 0),
  ADD COLUMN IF NOT EXISTS momento_aviso_cadeteria TEXT NOT NULL DEFAULT 'listo'
    CHECK (momento_aviso_cadeteria IN ('al_aceptar', 'minutos_antes', 'listo', 'manual')),
  ADD COLUMN IF NOT EXISTS minutos_antes_aviso INTEGER NOT NULL DEFAULT 10 CHECK (minutos_antes_aviso >= 0),
  ADD COLUMN IF NOT EXISTS avisar_cliente_en_camino BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS plantillas_whatsapp JSONB DEFAULT '{
    "cliente_listo": "Hola {nombre}, tu pedido N° #{numero_pedido} de {negocio} ya está listo para retirar. Total: {total}. ¡Gracias por elegirnos!",
    "cliente_en_camino": "Hola {nombre}, tu pedido N° #{numero_pedido} de {negocio} ya está en camino a {direccion}. Hora estimada: {hora_estimada}. ¡Que lo disfrutes!",
    "cadeteria_externa": "PEDIDO LISTO PARA RETIRAR - #{numero_pedido}\nRetirar en: {direccion_retiro} ({negocio})\nEntregar a: {nombre} ({telefono})\nDirección: {direccion}\nReferencias: {referencias}\nMapa: {link_mapa}\nMedio de pago: {medio_pago}\nMonto a cobrar en efectivo: {monto_a_cobrar}\nObservaciones: {observaciones}",
    "cadete_propio": "Nuevo envío asignado #{numero_pedido} en {negocio}.\nRetiro: {direccion_retiro}\nCliente: {nombre} ({telefono})\nDestino: {direccion} ({referencias})\nMapa: {link_mapa}\nCobrar: {monto_a_cobrar} ({medio_pago})\nHora estimada: {hora_estimada}"
  }'::jsonb,
  ADD COLUMN IF NOT EXISTS tipografia_id TEXT NOT NULL DEFAULT 'modern'
    CHECK (tipografia_id IN ('modern', 'editorial', 'artisan', 'bold')),
  ADD COLUMN IF NOT EXISTS slogan TEXT,
  ADD COLUMN IF NOT EXISTS banner_url TEXT,
  ADD COLUMN IF NOT EXISTS tema_catalogo TEXT NOT NULL DEFAULT 'oscuro'
    CHECK (tema_catalogo IN ('oscuro', 'claro')),
  ADD COLUMN IF NOT EXISTS estilo_bordes TEXT NOT NULL DEFAULT 'suave'
    CHECK (estilo_bordes IN ('suave', 'recto', 'redondeado'));

-- Permitir a vendedor alternar el estado abierto_manual si se requiere, y a cadete leer datos básicos de su negocio
DROP POLICY IF EXISTS "Vendedor del negocio solo lee datos de su negocio" ON public.negocios;
CREATE POLICY "Personal del negocio lee datos de su negocio" ON public.negocios
  FOR SELECT USING (id = public.get_current_negocio_id());

-- 3. NUEVA TABLA: CADETES (Propios con usuario en la app o Empresas Externas)
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

ALTER TABLE public.cadetes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Superadmin control total cadetes" ON public.cadetes
  FOR ALL USING (public.is_superadmin());

CREATE POLICY "Admin gestiona cadetes de su negocio" ON public.cadetes
  FOR ALL USING (negocio_id = public.get_current_negocio_id() AND public.get_current_role() = 'admin');

CREATE POLICY "Vendedor lee cadetes de su negocio" ON public.cadetes
  FOR SELECT USING (negocio_id = public.get_current_negocio_id() AND public.get_current_role() = 'vendedor');

CREATE POLICY "Cadete lee su propio registro de cadete" ON public.cadetes
  FOR SELECT USING (usuario_id = auth.uid() AND public.get_current_role() = 'cadete');

-- Función auxiliar para obtener el cadete_id del usuario autenticado
CREATE OR REPLACE FUNCTION public.get_current_cadete_id()
RETURNS UUID AS $$
  SELECT id FROM public.cadetes WHERE usuario_id = auth.uid() AND activo = true LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 4. AMPLIAR TABLA PEDIDOS (Estados, Origen, Medio de pago, Cadetería, GPS y Preparación futura)
ALTER TABLE public.pedidos DROP CONSTRAINT IF EXISTS pedidos_estado_check;
ALTER TABLE public.pedidos
  ADD CONSTRAINT pedidos_estado_check
  CHECK (estado IN ('nuevo', 'en_preparacion', 'listo', 'en_camino', 'entregado', 'cancelado'));

ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS origen TEXT NOT NULL DEFAULT 'online'
    CHECK (origen IN ('online', 'manual')),
  ADD COLUMN IF NOT EXISTS referencias_direccion TEXT,
  ADD COLUMN IF NOT EXISTS zona_entrega TEXT,
  ADD COLUMN IF NOT EXISTS medio_pago TEXT
    CHECK (medio_pago IS NULL OR medio_pago IN ('efectivo', 'transferencia', 'mercadopago')),
  ADD COLUMN IF NOT EXISTS estado_pago TEXT NOT NULL DEFAULT 'pendiente'
    CHECK (estado_pago IN ('pendiente', 'pagado')),
  ADD COLUMN IF NOT EXISTS monto_a_cobrar NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS monto_cobrado_declarado NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS cadete_id UUID REFERENCES public.cadetes(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS aceptado_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS asignado_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS aviso_programado_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cadeteria_avisada_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cliente_avisado_listo_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cliente_avisado_camino_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS retirado_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS entregado_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS entrega_lat NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS entrega_lng NUMERIC(10, 7),
  ADD COLUMN IF NOT EXISTS entrega_precision_m NUMERIC(8, 2),
  ADD COLUMN IF NOT EXISTS entregado_sin_ubicacion BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS motivo_sin_ubicacion TEXT,
  ADD COLUMN IF NOT EXISTS no_entregado_motivo TEXT,
  ADD COLUMN IF NOT EXISTS no_entregado_observacion TEXT,
  ADD COLUMN IF NOT EXISTS no_entregado_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cerrado_por_usuario_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS motivo_cancelacion TEXT,
  -- Columnas preparadas para futuras expansiones (Regla 5: cupones, costo envío por zona, mesa, etc.)
  ADD COLUMN IF NOT EXISTS descuento_total NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS costo_envio NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS metadata_futura JSONB DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_pedidos_cadete ON public.pedidos(cadete_id, estado);
CREATE INDEX IF NOT EXISTS idx_pedidos_origen ON public.pedidos(negocio_id, origen);

-- Columna preparada en pedido_items para variantes/extras futuros (Regla 5)
ALTER TABLE public.pedido_items
  ADD COLUMN IF NOT EXISTS opciones_seleccionadas JSONB DEFAULT '[]'::jsonb;

-- Políticas RLS en pedidos y pedido_items para rol 'cadete' (solo ve y actualiza sus propios pedidos asignados)
DROP POLICY IF EXISTS "Cadete ve sus propios pedidos asignados" ON public.pedidos;
CREATE POLICY "Cadete ve sus propios pedidos asignados" ON public.pedidos
  FOR SELECT USING (
    negocio_id = public.get_current_negocio_id()
    AND public.get_current_role() = 'cadete'
    AND cadete_id = public.get_current_cadete_id()
    AND created_at >= (now() - interval '30 days')
  );

DROP POLICY IF EXISTS "Cadete actualiza estado de sus pedidos asignados" ON public.pedidos;
CREATE POLICY "Cadete actualiza estado de sus pedidos asignados" ON public.pedidos
  FOR UPDATE USING (
    negocio_id = public.get_current_negocio_id()
    AND public.get_current_role() = 'cadete'
    AND cadete_id = public.get_current_cadete_id()
  );

DROP POLICY IF EXISTS "Cadete lee items de sus pedidos asignados" ON public.pedido_items;
CREATE POLICY "Cadete lee items de sus pedidos asignados" ON public.pedido_items
  FOR SELECT USING (
    negocio_id = public.get_current_negocio_id()
    AND public.get_current_role() = 'cadete'
    AND EXISTS (
      SELECT 1 FROM public.pedidos p
      WHERE p.id = pedido_items.pedido_id
      AND p.cadete_id = public.get_current_cadete_id()
    )
  );

-- 5. NUEVA TABLA: VENTAS AUTOMÁTICAS (Sección D)
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
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

CREATE INDEX IF NOT EXISTS idx_ventas_negocio_fecha ON public.ventas(negocio_id, fecha_venta DESC);
CREATE INDEX IF NOT EXISTS idx_ventas_anulada ON public.ventas(negocio_id, anulada);

ALTER TABLE public.ventas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Superadmin control total ventas" ON public.ventas
  FOR ALL USING (public.is_superadmin());

CREATE POLICY "Admin gestiona ventas de su negocio" ON public.ventas
  FOR ALL USING (negocio_id = public.get_current_negocio_id() AND public.get_current_role() = 'admin');

-- 6. NUEVA TABLA: CIERRES DE CAJA (Sección F - Inmutable luego de crearse)
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

ALTER TABLE public.cierres_caja ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Superadmin control total cierres_caja" ON public.cierres_caja
  FOR ALL USING (public.is_superadmin());

-- Solo SELECT e INSERT para Admin del negocio (NO se permite UPDATE ni DELETE después de cerrado)
CREATE POLICY "Admin lee cierres_caja de su negocio" ON public.cierres_caja
  FOR SELECT USING (negocio_id = public.get_current_negocio_id() AND public.get_current_role() = 'admin');

CREATE POLICY "Admin crea cierres_caja de su negocio" ON public.cierres_caja
  FOR INSERT WITH CHECK (negocio_id = public.get_current_negocio_id() AND public.get_current_role() = 'admin');

COMMIT;
