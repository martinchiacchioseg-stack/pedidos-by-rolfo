import { formatCurrency, formatDate } from './utils';
import { TipoEntrega } from '@/types/database';

export interface ItemParaWhatsApp {
  nombre: string;
  cantidad: number;
  precio: number;
  subtotal: number;
  aclaraciones?: string | null;
}

export interface PedidoWhatsAppParams {
  negocioNombre: string;
  numeroPedido: number;
  clienteNombre: string;
  clienteTelefono: string;
  tipoEntrega: TipoEntrega;
  direccion?: string | null;
  observaciones?: string | null;
  items: ItemParaWhatsApp[];
  total: number;
  whatsappNumero: string;
  fecha?: string;
}

export function generarMensajeWhatsApp(params: PedidoWhatsAppParams): string {
  const {
    negocioNombre,
    numeroPedido,
    clienteNombre,
    clienteTelefono,
    tipoEntrega,
    direccion,
    observaciones,
    items,
    total,
    fecha,
  } = params;

  const fechaFormateada = fecha ? formatDate(fecha) : formatDate(new Date().toISOString());
  const iconoEntrega = tipoEntrega === 'envio' ? '🛵 Envío a domicilio' : '🛍️ Retiro en el local';

  let mensaje = `*NUEVO PEDIDO #${numeroPedido} - ${negocioNombre.toUpperCase()}*\n`;
  mensaje += `📅 _${fechaFormateada}_\n\n`;

  mensaje += `👤 *DATOS DEL CLIENTE:*\n`;
  mensaje += `• *Nombre:* ${clienteNombre}\n`;
  mensaje += `• *Teléfono:* ${clienteTelefono}\n`;
  mensaje += `• *Modalidad:* ${iconoEntrega}\n`;
  if (tipoEntrega === 'envio' && direccion) {
    mensaje += `• *Dirección de Entrega:* ${direccion}\n`;
  }
  mensaje += `\n`;

  mensaje += `📋 *DETALLE DEL PEDIDO:*\n`;
  items.forEach((item) => {
    mensaje += `▫️ ${item.cantidad}x *${item.nombre}* (${formatCurrency(item.subtotal)})\n`;
    if (item.aclaraciones && item.aclaraciones.trim()) {
      mensaje += `   ↳ _Nota: ${item.aclaraciones.trim()}_\n`;
    }
  });
  mensaje += `\n`;

  mensaje += `💰 *TOTAL A PAGAR: ${formatCurrency(total)}*\n\n`;

  if (observaciones && observaciones.trim()) {
    mensaje += `💬 *OBSERVACIONES:*\n"${observaciones.trim()}"\n\n`;
  }

  mensaje += `-------------------------------------\n`;
  mensaje += `_Pedido generado desde el menú digital de Pedidos by ROLΦ_`;

  return mensaje;
}

export function generarEnlaceWhatsApp(params: PedidoWhatsAppParams): string {
  const texto = generarMensajeWhatsApp(params);
  const cleanNumber = params.whatsappNumero.replace(/[^0-9]/g, '');
  return `https://wa.me/${cleanNumber}?text=${encodeURIComponent(texto)}`;
}
