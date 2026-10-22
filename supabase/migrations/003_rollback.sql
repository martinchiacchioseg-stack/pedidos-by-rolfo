-- =================================================================================
-- ROLLBACK MIGRACIÓN 003: HERRAMIENTA INTEGRAL DE MANTENIMIENTO SÚPER ADMIN
-- =================================================================================

BEGIN;

DROP TABLE IF EXISTS public.diagnosticos_negocio CASCADE;
DROP TABLE IF EXISTS public.backups_negocio CASCADE;

ALTER TABLE public.auditoria_accesos
  DROP COLUMN IF EXISTS negocio_id;

ALTER TABLE public.ventas
  DROP COLUMN IF EXISTS es_prueba;

ALTER TABLE public.pedidos
  DROP COLUMN IF EXISTS es_prueba;

ALTER TABLE public.negocios
  DROP COLUMN IF EXISTS salud_estado,
  DROP COLUMN IF EXISTS salud_actualizado_at,
  DROP COLUMN IF EXISTS salud_resumen,
  DROP COLUMN IF EXISTS ultimo_backup_at;

COMMIT;
