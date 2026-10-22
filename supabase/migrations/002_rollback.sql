-- ==============================================================================
-- ROLLBACK DE MIGRACIÓN 002: REVERTIR AMPLIACIÓN INTEGRAL V2
-- ==============================================================================

BEGIN;

DROP TABLE IF EXISTS public.cierres_caja CASCADE;
DROP TABLE IF EXISTS public.ventas CASCADE;

ALTER TABLE public.pedido_items DROP COLUMN IF EXISTS opciones_seleccionadas;

DROP POLICY IF EXISTS "Cadete ve sus propios pedidos asignados" ON public.pedidos;
DROP POLICY IF EXISTS "Cadete actualiza estado de sus pedidos asignados" ON public.pedidos;
DROP POLICY IF EXISTS "Cadete lee items de sus pedidos asignados" ON public.pedido_items;

ALTER TABLE public.pedidos
  DROP COLUMN IF EXISTS origen,
  DROP COLUMN IF EXISTS referencias_direccion,
  DROP COLUMN IF EXISTS zona_entrega,
  DROP COLUMN IF EXISTS medio_pago,
  DROP COLUMN IF EXISTS estado_pago,
  DROP COLUMN IF EXISTS monto_a_cobrar,
  DROP COLUMN IF EXISTS monto_cobrado_declarado,
  DROP COLUMN IF EXISTS cadete_id,
  DROP COLUMN IF EXISTS aceptado_at,
  DROP COLUMN IF EXISTS asignado_at,
  DROP COLUMN IF EXISTS aviso_programado_at,
  DROP COLUMN IF EXISTS cadeteria_avisada_at,
  DROP COLUMN IF EXISTS cliente_avisado_listo_at,
  DROP COLUMN IF EXISTS cliente_avisado_camino_at,
  DROP COLUMN IF EXISTS retirado_at,
  DROP COLUMN IF EXISTS entregado_at,
  DROP COLUMN IF EXISTS entrega_lat,
  DROP COLUMN IF EXISTS entrega_lng,
  DROP COLUMN IF EXISTS entrega_precision_m,
  DROP COLUMN IF EXISTS entregado_sin_ubicacion,
  DROP COLUMN IF EXISTS motivo_sin_ubicacion,
  DROP COLUMN IF EXISTS no_entregado_motivo,
  DROP COLUMN IF EXISTS no_entregado_observacion,
  DROP COLUMN IF EXISTS no_entregado_at,
  DROP COLUMN IF EXISTS cerrado_por_usuario_id,
  DROP COLUMN IF EXISTS motivo_cancelacion,
  DROP COLUMN IF EXISTS descuento_total,
  DROP COLUMN IF EXISTS costo_envio,
  DROP COLUMN IF EXISTS metadata_futura;

DROP FUNCTION IF EXISTS public.get_current_cadete_id();
DROP TABLE IF EXISTS public.cadetes CASCADE;

ALTER TABLE public.negocios
  DROP COLUMN IF EXISTS abierto_manual,
  DROP COLUMN IF EXISTS modo_apertura,
  DROP COLUMN IF EXISTS horarios_semanales,
  DROP COLUMN IF EXISTS direccion_local,
  DROP COLUMN IF EXISTS tiempo_preparacion_min,
  DROP COLUMN IF EXISTS momento_aviso_cadeteria,
  DROP COLUMN IF EXISTS minutos_antes_aviso,
  DROP COLUMN IF EXISTS avisar_cliente_en_camino,
  DROP COLUMN IF EXISTS plantillas_whatsapp,
  DROP COLUMN IF EXISTS tipografia_id,
  DROP COLUMN IF EXISTS slogan,
  DROP COLUMN IF EXISTS banner_url,
  DROP COLUMN IF EXISTS tema_catalogo,
  DROP COLUMN IF EXISTS estilo_bordes;

ALTER TABLE public.usuarios
  DROP COLUMN IF EXISTS acepto_privacidad_gps,
  DROP COLUMN IF EXISTS acepto_privacidad_at,
  DROP COLUMN IF EXISTS telefono,
  DROP COLUMN IF EXISTS push_subscription;

COMMIT;
