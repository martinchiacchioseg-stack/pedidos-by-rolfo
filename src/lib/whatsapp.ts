import {
  formatCurrency,
  formatDate,
  generarLinkGoogleMaps,
  calcularHoraEstimadaAR,
  limpiarNumeroWhatsApp,
} from './utils';
import { TipoEntrega, Pedido, Negocio, PlantillasWhatsApp } from '@/types/database';

export const PLANTILLAS_WHATSAPP_DEFAULT: PlantillasWhatsApp = {
  cliente_listo:
    'Hola {nombre}, tu pedido N° #{numero_pedido} de {negocio} ya está listo para retirar. Total: {total}. ¡Gracias por elegirnos!',
  cliente_en_camino:
    'Hola {nombre}, tu pedido N° #{numero_pedido} de {negocio} ya salió en camino a {direccion}. Hora estimada de llegada: {hora_estimada}. ¡Que lo disfrutes!',
  cadeteria_externa:
    'PEDIDO LISTO PARA RETIRAR - #{numero_pedido}\nRetirar en: {direccion_retiro} ({negocio})\nEntregar a: {nombre} ({telefono})\nDirección: {direccion}\nReferencias: {referencias}\nMapa: {link_mapa}\nMedio de pago: {medio_pago}\nMonto a cobrar en efectivo: {monto_a_cobrar}\nObservaciones: {observaciones}',
  cadete_propio:
    'Nuevo envío asignado #{numero_pedido} en {negocio}.\nRetiro: {direccion_retiro}\nCliente: {nombre} ({telefono})\nDestino: {direccion} ({referencias})\nMapa: {link_mapa}\nCobrar: {monto_a_cobrar} ({medio_pago})\nHora estimada: {hora_estimada}',
};

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
  referencias?: string | null;
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
    referencias,
    observaciones,
    items,
    total,
    fecha,
  } = params;

  const fechaFormateada = fecha ? formatDate(fecha) : formatDate(new Date().toISOString());
  const modalidadTexto = tipoEntrega === 'envio' ? 'Envío a domicilio' : 'Retiro en el local';

  let mensaje = `*NUEVO PEDIDO #${numeroPedido} - ${negocioNombre.toUpperCase()}*\n`;
  mensaje += `Fecha: ${fechaFormateada}\n\n`;

  mensaje += `*DATOS DEL CLIENTE:*\n`;
  mensaje += `• Nombre: ${clienteNombre}\n`;
  mensaje += `• Teléfono: ${clienteTelefono}\n`;
  mensaje += `• Modalidad: ${modalidadTexto}\n`;
  if (tipoEntrega === 'envio' && direccion) {
    mensaje += `• Dirección de Entrega: ${direccion}\n`;
    if (referencias && referencias.trim()) {
      mensaje += `• Referencias: ${referencias.trim()}\n`;
    }
  }
  mensaje += `\n`;

  mensaje += `*DETALLE DEL PEDIDO:*\n`;
  items.forEach((item) => {
    mensaje += `- ${item.cantidad}x *${item.nombre}* (${formatCurrency(item.subtotal)})\n`;
    if (item.aclaraciones && item.aclaraciones.trim()) {
      mensaje += `  Nota: _${item.aclaraciones.trim()}_\n`;
    }
  });
  mensaje += `\n`;

  mensaje += `*TOTAL: ${formatCurrency(total)}*\n\n`;

  if (observaciones && observaciones.trim()) {
    mensaje += `*OBSERVACIONES:*\n"${observaciones.trim()}"\n\n`;
  }

  mensaje += `-------------------------------------\n`;
  mensaje += `Pedido generado desde Pedidos by ROLΦ`;

  return mensaje;
}

export function generarEnlaceWhatsApp(params: PedidoWhatsAppParams): string {
  const texto = generarMensajeWhatsApp(params);
  const cleanNumber = limpiarNumeroWhatsApp(params.whatsappNumero);
  return `https://wa.me/${cleanNumber}?text=${encodeURIComponent(texto)}`;
}

export function formatearMedioPagoLabel(medio?: string | null): string {
  switch (medio) {
    case 'efectivo':
      return 'Efectivo';
    case 'transferencia':
      return 'Transferencia';
    case 'mercadopago':
      return 'MercadoPago';
    default:
      return 'A confirmar';
  }
}

export function compilarPlantillaWhatsApp(
  plantilla: string,
  pedido: Partial<Pedido>,
  negocio: Partial<Negocio>
): string {
  const direccionCompleta = pedido.direccion || 'Retiro en el local';
  const referencias = pedido.referencias_direccion || 'Sin referencias adicionales';
  const linkMapa = pedido.direccion ? generarLinkGoogleMaps(pedido.direccion) : '-';
  const medioPago = formatearMedioPagoLabel(pedido.medio_pago);
  const montoCobrar =
    pedido.medio_pago === 'efectivo'
      ? formatCurrency(pedido.monto_a_cobrar ?? pedido.total ?? 0)
      : pedido.estado_pago === 'pagado'
      ? 'Ya pagado ($0)'
      : formatCurrency(pedido.total ?? 0);

  const horaEstimada = calcularHoraEstimadaAR(negocio.tiempo_preparacion_min || 30);

  const vars: Record<string, string> = {
    '{nombre}': pedido.cliente_nombre || 'Cliente',
    '{numero_pedido}': String(pedido.numero_pedido || ''),
    '{total}': formatCurrency(pedido.total || 0),
    '{hora_estimada}': horaEstimada,
    '{negocio}': negocio.nombre || 'Nuestro Local',
    '{telefono}': pedido.cliente_telefono || '-',
    '{direccion}': direccionCompleta,
    '{referencias}': referencias,
    '{link_mapa}': linkMapa,
    '{medio_pago}': medioPago,
    '{monto_a_cobrar}': montoCobrar,
    '{observaciones}': pedido.observaciones || 'Ninguna',
    '{direccion_retiro}': negocio.direccion_local || negocio.nombre || 'Local comercial',
  };

  let resultado = plantilla;
  for (const [token, valor] of Object.entries(vars)) {
    resultado = resultado.split(token).join(valor);
  }
  return resultado;
}

export function abrirWhatsAppConTexto(telefono: string, texto: string): void {
  const clean = limpiarNumeroWhatsApp(telefono);
  if (!clean) return;
  const url = `https://wa.me/${clean}?text=${encodeURIComponent(texto)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}
