export type UserRole = 'superadmin' | 'admin' | 'vendedor';

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
  color_primario: string;
  color_secundario: string;
  telefono: string | null;
  whatsapp_numero: string | null;
  horarios: HorariosNegocio | null;
  mensaje_bienvenida: string | null;
  mensaje_cierre: string | null;
  fecha_vencimiento: string;
  activo: boolean;
  created_at: string;
  updated_at: string;
  // Relaciones opcionales
  plan?: Plan;
  dias_restantes?: number;
  estado_vencimiento?: 'vigente' | 'por_vencer' | 'vencido';
}

export interface Usuario {
  id: string;
  negocio_id: string | null;
  email: string;
  nombre: string;
  role: UserRole;
  must_change_password: boolean;
  activo: boolean;
  created_at: string;
  updated_at: string;
  negocio?: Negocio;
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

export type TipoEntrega = 'retiro' | 'envio';
export type EstadoPedido = 'nuevo' | 'en_preparacion' | 'listo' | 'entregado' | 'cancelado';

export interface Pedido {
  id: string;
  negocio_id: string;
  numero_pedido: number;
  cliente_nombre: string;
  cliente_telefono: string;
  tipo_entrega: TipoEntrega;
  direccion: string | null;
  observaciones: string | null;
  total: number;
  estado: EstadoPedido;
  created_at: string;
  updated_at: string;
  items?: PedidoItem[];
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
