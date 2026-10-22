export type UserRole = 'superadmin' | 'admin' | 'vendedor' | 'cadete';

export type TipografiaId = 'modern' | 'editorial' | 'artisan' | 'bold';
export type ModoApertura = 'manual' | 'automatico';
export type MomentoAvisoCadeteria = 'al_aceptar' | 'minutos_antes' | 'listo' | 'manual';
export type MedioPago = 'efectivo' | 'transferencia' | 'mercadopago';
export type EstadoPago = 'pendiente' | 'pagado';
export type OrigenPedido = 'online' | 'manual';
export type TipoEntrega = 'retiro' | 'envio';
export type EstadoPedido = 'nuevo' | 'en_preparacion' | 'listo' | 'en_camino' | 'entregado' | 'cancelado';
export type TipoCadete = 'propio' | 'externa';

export interface FranjaHoraria {
  apertura: string; // "11:30"
  cierre: string;   // "15:00"
}

export interface DiaHorario {
  activo: boolean;
  franjas: FranjaHoraria[]; // hasta 2 franjas por día
}

export type DiaSemanaKey = 'lunes' | 'martes' | 'miercoles' | 'jueves' | 'viernes' | 'sabado' | 'domingo';

export type HorariosSemanales = Record<DiaSemanaKey, DiaHorario>;

export interface PlantillasWhatsApp {
  cliente_listo: string;
  cliente_en_camino: string;
  cadeteria_externa: string;
  cadete_propio: string;
}

export interface Plan {
  id: string;
  nombre: string;
  duracion_dias: number;
  precio: number;
  descripcion: string | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export interface HorariosNegocio {
  dias: string;
  apertura: string;
  cierre: string;
}

export interface Negocio {
  id: string;
  plan_id: string | null;
  nombre: string;
  slug: string;
  logo_url: string | null;
  banner_url?: string | null;
  slogan?: string | null;
  color_primario: string;
  color_secundario: string;
  tipografia_id?: TipografiaId;
  tema_catalogo?: 'oscuro' | 'claro';
  estilo_bordes?: 'suave' | 'recto' | 'redondeado';
  telefono: string | null;
  whatsapp_numero: string | null;
  direccion_local?: string | null;
  abierto_manual?: boolean;
  modo_apertura?: ModoApertura;
  horarios: HorariosNegocio | null;
  horarios_semanales?: HorariosSemanales | null;
  tiempo_preparacion_min?: number;
  momento_aviso_cadeteria?: MomentoAvisoCadeteria;
  minutos_antes_aviso?: number;
  avisar_cliente_en_camino?: boolean;
  plantillas_whatsapp?: PlantillasWhatsApp | null;
  mensaje_bienvenida: string | null;
  mensaje_cierre: string | null;
  fecha_vencimiento: string;
  activo: boolean;
  salud_estado?: 'verde' | 'amarillo' | 'rojo' | 'sin_diagnosticar';
  salud_actualizado_at?: string | null;
  salud_resumen?: Record<string, unknown> | null;
  ultimo_backup_at?: string | null;
  created_at: string;
  updated_at: string;
  // Relaciones y estados calculados
  plan?: Plan;
  dias_restantes?: number;
  estado_vencimiento?: 'vigente' | 'por_vencer' | 'vencido';
  abierto_efectivo?: boolean;
  proximo_horario_texto?: string;
}

export interface Usuario {
  id: string;
  negocio_id: string | null;
  email: string;
  nombre: string;
  telefono?: string | null;
  role: UserRole;
  must_change_password: boolean;
  acepto_privacidad_gps?: boolean;
  acepto_privacidad_at?: string | null;
  push_subscription?: Record<string, unknown> | null;
  activo: boolean;
  created_at: string;
  updated_at: string;
  negocio?: Negocio;
}

export interface Cadete {
  id: string;
  negocio_id: string;
  tipo: TipoCadete;
  usuario_id: string | null;
  nombre: string;
  telefono_whatsapp: string;
  es_predeterminado: boolean;
  activo: boolean;
  created_at: string;
  updated_at: string;
  usuario?: Usuario;
}

export interface Categoria {
  id: string;
  negocio_id: string;
  nombre: string;
  orden: number;
  created_at: string;
}

export interface Ingrediente {
  id: string;
  negocio_id: string;
  producto_id: string;
  nombre: string;
  cantidad: number;
  unidad: string;
  costo_unitario: number | null;
  created_at: string;
}

export interface Producto {
  id: string;
  negocio_id: string;
  categoria_id: string | null;
  nombre: string;
  descripcion: string | null;
  precio_venta: number;
  imagen_url: string | null;
  receta: string | null;
  costo_total: number;
  visible_catalogo: boolean;
  orden: number;
  created_at: string;
  updated_at: string;
  categoria?: Categoria;
  ingredientes?: Ingrediente[];
}

export interface Pedido {
  id: string;
  negocio_id: string;
  numero_pedido: number;
  origen: OrigenPedido;
  cliente_nombre: string;
  cliente_telefono: string;
  tipo_entrega: TipoEntrega;
  direccion: string | null;
  referencias_direccion?: string | null;
  zona_entrega?: string | null;
  observaciones: string | null;
  total: number;
  descuento_total?: number;
  costo_envio?: number;
  medio_pago?: MedioPago | null;
  estado_pago?: EstadoPago;
  monto_a_cobrar?: number | null;
  monto_cobrado_declarado?: number | null;
  estado: EstadoPedido;
  cadete_id?: string | null;
  aceptado_at?: string | null;
  asignado_at?: string | null;
  aviso_programado_at?: string | null;
  cadeteria_avisada_at?: string | null;
  cliente_avisado_listo_at?: string | null;
  cliente_avisado_camino_at?: string | null;
  retirado_at?: string | null;
  entregado_at?: string | null;
  entrega_lat?: number | null;
  entrega_lng?: number | null;
  entrega_precision_m?: number | null;
  entregado_sin_ubicacion?: boolean;
  motivo_sin_ubicacion?: string | null;
  no_entregado_motivo?: string | null;
  no_entregado_observacion?: string | null;
  no_entregado_at?: string | null;
  cerrado_por_usuario_id?: string | null;
  motivo_cancelacion?: string | null;
  es_prueba?: boolean;
  created_at: string;
  updated_at: string;
  items?: PedidoItem[];
  cadete?: Cadete | null;
}

export interface PedidoItem {
  id: string;
  pedido_id: string;
  negocio_id: string;
  producto_id: string | null;
  nombre_producto: string;
  precio_unitario: number;
  cantidad: number;
  subtotal: number;
  aclaraciones: string | null;
  opciones_seleccionadas?: Record<string, unknown>[];
  created_at: string;
}

export interface Venta {
  id: string;
  negocio_id: string;
  pedido_id: string;
  fecha_venta: string;
  total: number;
  costo_estimado: number;
  tiene_costos_cargados: boolean;
  medio_pago: MedioPago | null;
  origen: OrigenPedido;
  tipo_entrega: TipoEntrega;
  cadete_id: string | null;
  tiempo_entrega_min: number | null;
  cerrado_por_usuario_id: string | null;
  anulada: boolean;
  motivo_anulacion: string | null;
  anulada_por_usuario_id: string | null;
  anulada_at: string | null;
  es_prueba?: boolean;
  created_at: string;
  updated_at: string;
  pedido?: Pedido;
  cadete?: Cadete;
}

export interface BackupNegocio {
  id: string;
  negocio_id: string;
  negocio_nombre: string;
  negocio_slug: string;
  version: string;
  tipo: 'manual' | 'pre_restauracion' | 'pre_mantenimiento' | 'pre_eliminacion' | 'global';
  descripcion: string | null;
  tamano_bytes: number;
  creado_por_id: string | null;
  creado_por_email: string | null;
  estadisticas: Record<string, number>;
  payload?: Record<string, unknown>;
  created_at: string;
}

export interface ControlDiagnostico {
  id: string;
  categoria: 'cuenta_plan' | 'configuracion' | 'catalogo' | 'cadeteria' | 'catalogo_publico' | 'integridad';
  titulo: string;
  estado: 'ok' | 'advertencia' | 'error';
  detalle: string;
  accion_sugerida?: string;
  accion_codigo?: string;
}

export interface DiagnosticoNegocio {
  id: string;
  negocio_id: string;
  semaforo: 'verde' | 'amarillo' | 'rojo';
  puntaje: number;
  resumen: string;
  controles: ControlDiagnostico[];
  ejecutado_por_id: string | null;
  ejecutado_por_email: string | null;
  created_at: string;
}

export interface CierreCaja {
  id: string;
  negocio_id: string;
  cerrado_por_usuario_id: string | null;
  cerrado_por_nombre: string | null;
  fecha_referencia: string;
  fecha_cierre: string;
  total_vendido: number;
  total_efectivo_esperado: number;
  total_transferencia: number;
  total_mercadopago: number;
  efectivo_declarado_cadetes: number;
  efectivo_contado: number;
  diferencia_efectivo: number;
  cantidad_pedidos: number;
  cantidad_anulaciones: number;
  total_anulaciones: number;
  observaciones: string | null;
  resumen_json: Record<string, unknown>;
  created_at: string;
}

export interface AuditoriaAcceso {
  id: string;
  usuario_id: string | null;
  email: string | null;
  ip_address: string | null;
  user_agent: string | null;
  evento: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}
