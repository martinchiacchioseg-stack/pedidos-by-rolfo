-- =================================================================================
-- MIGRACIÓN INCREMENTAL 003: HERRAMIENTA INTEGRAL DE MANTENIMIENTO SÚPER ADMIN
-- =================================================================================
--Conserva todos los datos existentes y aplica Row Level Security (RLS) a las tablas nuevas.

BEGIN;

-- 1. Nuevas columnas en public.negocios para semáforo de salud y control de último backup
ALTER TABLE public.negocios
  ADD COLUMN IF NOT EXISTS salud_estado TEXT NOT NULL DEFAULT 'sin_diagnosticar'
    CHECK (salud_estado IN ('verde', 'amarillo', 'rojo', 'sin_diagnosticar')),
  ADD COLUMN IF NOT EXISTS salud_actualizado_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS salud_resumen JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS ultimo_backup_at TIMESTAMPTZ;

-- 2. Columna es_prueba en public.pedidos y public.ventas para excluir pruebas de flujo de reportes/caja reales
ALTER TABLE public.pedidos
  ADD COLUMN IF NOT EXISTS es_prueba BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.ventas
  ADD COLUMN IF NOT EXISTS es_prueba BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_pedidos_es_prueba ON public.pedidos(negocio_id, es_prueba);
CREATE INDEX IF NOT EXISTS idx_ventas_es_prueba ON public.ventas(negocio_id, es_prueba);

-- 3. Vincular auditoria_accesos con negocio_id para poder consultar y exportar el historial por negocio
ALTER TABLE public.auditoria_accesos
  ADD COLUMN IF NOT EXISTS negocio_id UUID REFERENCES public.negocios(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_auditoria_negocio_id ON public.auditoria_accesos(negocio_id, created_at DESC);

-- 4. Tabla de Historial de Backups por Negocio (manuales y automáticos de seguridad)
CREATE TABLE IF NOT EXISTS public.backups_negocio (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id UUID NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
  negocio_nombre TEXT NOT NULL,
  negocio_slug TEXT NOT NULL,
  version TEXT NOT NULL DEFAULT '2.0.0',
  tipo TEXT NOT NULL DEFAULT 'manual'
    CHECK (tipo IN ('manual', 'pre_restauracion', 'pre_mantenimiento', 'pre_eliminacion', 'global')),
  descripcion TEXT,
  tamano_bytes INTEGER NOT NULL DEFAULT 0,
  creado_por_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
  creado_por_email TEXT,
  estadisticas JSONB NOT NULL DEFAULT '{}'::jsonb,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_backups_negocio_id ON public.backups_negocio(negocio_id, created_at DESC);

ALTER TABLE public.backups_negocio ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Superadmin gestiona backups_negocio" ON public.backups_negocio;
CREATE POLICY "Superadmin gestiona backups_negocio"
  ON public.backups_negocio
  FOR ALL
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

-- 5. Tabla de Historial de Diagnósticos por Negocio
CREATE TABLE IF NOT EXISTS public.diagnosticos_negocio (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  negocio_id UUID NOT NULL REFERENCES public.negocios(id) ON DELETE CASCADE,
  semaforo TEXT NOT NULL CHECK (semaforo IN ('verde', 'amarillo', 'rojo')),
  puntaje INTEGER NOT NULL DEFAULT 100,
  resumen TEXT NOT NULL,
  controles JSONB NOT NULL DEFAULT '[]'::jsonb,
  ejecutado_por_id UUID REFERENCES public.usuarios(id) ON DELETE SET NULL,
  ejecutado_por_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_diagnosticos_negocio_id ON public.diagnosticos_negocio(negocio_id, created_at DESC);

ALTER TABLE public.diagnosticos_negocio ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Superadmin gestiona diagnosticos_negocio" ON public.diagnosticos_negocio;
CREATE POLICY "Superadmin gestiona diagnosticos_negocio"
  ON public.diagnosticos_negocio
  FOR ALL
  USING (public.is_superadmin())
  WITH CHECK (public.is_superadmin());

COMMIT;
