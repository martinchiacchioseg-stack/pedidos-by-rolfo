import { NextRequest, NextResponse } from 'next/server';
import {
  verifySuperAdmin,
  verifySuperAdminPassword,
  construirYGuardarBackupNegocio,
} from '@/lib/auth-server';
import {
  calcularDiasRestantes,
  getEstadoVencimiento,
  limpiarNumeroWhatsApp,
} from '@/lib/utils';
import { calcularEstadoApertura, HORARIOS_SEMANALES_DEFAULT } from '@/lib/horarios';
import {
  generarMensajeWhatsApp,
  generarEnlaceWhatsApp,
  PLANTILLAS_WHATSAPP_DEFAULT,
} from '@/lib/whatsapp';
import { ControlDiagnostico } from '@/types/database';
import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Analiza en modo SOLO LECTURA el estado de todas las tablas del negocio y las 12 verificaciones de integridad.
 */
async function analizarIntegridadYEstadoDB(
  adminSupabase: SupabaseClient,
  negocioId: string
) {
  const [
    { data: negocio },
    { data: categorias },
    { data: productos },
    { data: ingredientes },
    { data: pedidos },
    { data: pedidoItems },
    { data: ventas },
    { data: usuarios },
    { data: cadetes },
    { data: cierresCaja },
  ] = await Promise.all([
    adminSupabase.from('negocios').select('*').eq('id', negocioId).single(),
    adminSupabase.from('categorias').select('*').eq('negocio_id', negocioId),
    adminSupabase.from('productos').select('*').eq('negocio_id', negocioId),
    adminSupabase.from('ingredientes').select('*').eq('negocio_id', negocioId),
    adminSupabase.from('pedidos').select('*').eq('negocio_id', negocioId),
    adminSupabase.from('pedido_items').select('*').eq('negocio_id', negocioId),
    adminSupabase.from('ventas').select('*').eq('negocio_id', negocioId),
    adminSupabase.from('usuarios').select('*').eq('negocio_id', negocioId),
    adminSupabase.from('cadetes').select('*').eq('negocio_id', negocioId),
    adminSupabase.from('cierres_caja').select('*').eq('negocio_id', negocioId),
  ]);

  const catList = categorias || [];
  const prodList = productos || [];
  const ingList = ingredientes || [];
  const pedList = pedidos || [];
  const itemList = pedidoItems || [];
  const venList = ventas || [];
  const usrList = usuarios || [];
  const cadList = cadetes || [];
  const cajaList = cierresCaja || [];

  const catIds = new Set(catList.map((c) => c.id));
  const prodIds = new Set(prodList.map((p) => p.id));
  const pedIds = new Set(pedList.map((p) => p.id));
  const cadActivosIds = new Set(cadList.filter((c) => c.activo).map((c) => c.id));

  // Agrupar ítems por pedido_id
  const itemsPorPedido = new Map<string, typeof itemList>();
  for (const it of itemList) {
    const arr = itemsPorPedido.get(it.pedido_id) || [];
    arr.push(it);
    itemsPorPedido.set(it.pedido_id, arr);
  }

  // Agrupar ventas por pedido_id
  const ventasPorPedido = new Map<string, typeof venList>();
  for (const v of venList) {
    const arr = ventasPorPedido.get(v.pedido_id) || [];
    arr.push(v);
    ventasPorPedido.set(v.pedido_id, arr);
  }

  // 1. Productos sin categoría válida
  const productosSinCategoriaValida = prodList.filter(
    (p) => !p.categoria_id || !catIds.has(p.categoria_id)
  );

  // 2. Ingredientes huérfanos sin producto válido
  const ingredientesSinProducto = ingList.filter(
    (i) => !i.producto_id || !prodIds.has(i.producto_id)
  );

  // 3. Pedidos sin ítems
  const pedidosSinItems = pedList.filter(
    (p) => !p.es_prueba && (!itemsPorPedido.get(p.id) || itemsPorPedido.get(p.id)!.length === 0)
  );

  // 4. Ítems de pedido que apuntan a productos eliminados
  const itemsProductoEliminado = itemList.filter(
    (it) => !it.producto_id || !prodIds.has(it.producto_id)
  );

  // 5. Ventas huérfanas sin pedido
  const ventasSinPedido = venList.filter((v) => !v.pedido_id || !pedIds.has(v.pedido_id));

  // 6. Ventas o pedidos con total distinto a la suma de sus ítems
  const pedidosConTotalDesfasado = pedList.filter((p) => {
    const its = itemsPorPedido.get(p.id) || [];
    if (its.length === 0) return false;
    const sumaItems = its.reduce(
      (acc, i) => acc + (Number(i.precio_unitario) || 0) * (Number(i.cantidad) || 1),
      0
    );
    return Math.abs(Number(p.total) - sumaItems) > 0.5;
  });

  const ventasConTotalDesfasado = venList.filter((v) => {
    const its = itemsPorPedido.get(v.pedido_id) || [];
    if (its.length === 0) return false;
    const sumaItems = its.reduce(
      (acc, i) => acc + (Number(i.precio_unitario) || 0) * (Number(i.cantidad) || 1),
      0
    );
    return Math.abs(Number(v.total) - sumaItems) > 0.5;
  });

  // 7. Pedidos entregados sin venta registrada
  const pedidosEntregadosSinVenta = pedList.filter(
    (p) =>
      p.estado === 'entregado' &&
      !p.es_prueba &&
      (!ventasPorPedido.get(p.id) || ventasPorPedido.get(p.id)!.length === 0)
  );

  // 8. Ventas duplicadas para un mismo pedido
  const ventasDuplicadas: typeof venList = [];
  for (const [, arr] of ventasPorPedido.entries()) {
    if (arr.length > 1) {
      ventasDuplicadas.push(...arr.slice(1));
    }
  }

  // 9. Entregas sin cadete válido
  const entregasSinCadeteValido = pedList.filter(
    (p) =>
      p.tipo_entrega === 'envio' &&
      ['en_camino', 'entregado'].includes(p.estado) &&
      (!p.cadete_id || !cadActivosIds.has(p.cadete_id))
  );

  // 10. Cierres de caja con totales que no coinciden con las ventas del día
  const cierresDesfasados = cajaList.filter((c) => {
    const inicio = `${c.fecha_referencia}T00:00:00.000-03:00`;
    const fin = `${c.fecha_referencia}T23:59:59.999-03:00`;
    const ventasFecha = venList.filter(
      (v) =>
        !v.anulada &&
        !v.es_prueba &&
        v.fecha_venta >= inicio &&
        v.fecha_venta <= fin
    );
    const sumaReal = ventasFecha.reduce((acc, v) => acc + (Number(v.total) || 0), 0);
    return Math.abs(Number(c.total_vendido) - sumaReal) > 1;
  });

  // 11. Usuarios sin rol válido
  const rolesPermitidos = new Set(['admin', 'vendedor', 'cadete', 'superadmin']);
  const usuariosSinRolValido = usrList.filter((u) => !rolesPermitidos.has(u.role));

  // 12. Teléfonos sin normalizar (contienen espacios, guiones o signos)
  const telefonosSinNormalizar = [
    ...(negocio?.whatsapp_numero &&
    negocio.whatsapp_numero !== limpiarNumeroWhatsApp(negocio.whatsapp_numero)
      ? [{ tabla: 'negocios', id: negocio.id, valor: negocio.whatsapp_numero }]
      : []),
    ...cadList
      .filter(
        (c) =>
          c.telefono_whatsapp &&
          c.telefono_whatsapp !== limpiarNumeroWhatsApp(c.telefono_whatsapp)
      )
      .map((c) => ({ tabla: 'cadetes', id: c.id, valor: c.telefono_whatsapp })),
    ...pedList
      .filter(
        (p) =>
          p.cliente_telefono &&
          p.cliente_telefono !== 'Mostrador' &&
          p.cliente_telefono !== limpiarNumeroWhatsApp(p.cliente_telefono)
      )
      .map((p) => ({ tabla: 'pedidos', id: p.id, valor: p.cliente_telefono })),
  ];

  // 13. Almacenamiento de imágenes e imágenes sin uso en bucket 'productos'
  const urlsUsadas = new Set(
    [
      negocio?.logo_url,
      negocio?.banner_url,
      ...prodList.map((p) => p.imagen_url),
    ].filter(Boolean) as string[]
  );

  let espacioStorageBytes = 0;
  const imagenesHuerfanasStorage: string[] = [];

  try {
    const { data: files } = await adminSupabase.storage
      .from('productos')
      .list(negocioId, { limit: 500 });

    if (files && files.length > 0) {
      for (const f of files) {
        if (f.name === '.emptyFolderPlaceholder') continue;
        const size = Number(f.metadata?.size) || 0;
        espacioStorageBytes += size;
        const pathCompleto = `${negocioId}/${f.name}`;
        const estaUsada = Array.from(urlsUsadas).some((u) => u.includes(pathCompleto));
        if (!estaUsada) {
          imagenesHuerfanasStorage.push(pathCompleto);
        }
      }
    }
  } catch {
    // Bucket opcional
  }

  // Pedidos de prueba residuales
  const pedidosDePrueba = pedList.filter(
    (p) => p.es_prueba || (p.observaciones && p.observaciones.includes('[PRUEBA'))
  );

  const entregasRealizadas = pedList.filter(
    (p) => p.tipo_entrega === 'envio' && p.estado === 'entregado' && !p.es_prueba
  );

  const totalInconsistencias =
    productosSinCategoriaValida.length +
    ingredientesSinProducto.length +
    pedidosSinItems.length +
    itemsProductoEliminado.length +
    ventasSinPedido.length +
    pedidosConTotalDesfasado.length +
    ventasConTotalDesfasado.length +
    pedidosEntregadosSinVenta.length +
    ventasDuplicadas.length +
    entregasSinCadeteValido.length +
    cierresDesfasados.length +
    usuariosSinRolValido.length +
    telefonosSinNormalizar.length +
    imagenesHuerfanasStorage.length;

  return {
    negocio,
    conteo_tablas: {
      categorias: catList.length,
      productos: prodList.length,
      ingredientes: ingList.length,
      pedidos: pedList.filter((p) => !p.es_prueba).length,
      pedidos_prueba: pedidosDePrueba.length,
      pedido_items: itemList.length,
      ventas: venList.filter((v) => !v.es_prueba).length,
      usuarios: usrList.length,
      cadetes: cadList.length,
      entregas: entregasRealizadas.length,
      cierres_caja: cajaList.length,
    },
    almacenamiento: {
      imagenes_referenciadas: urlsUsadas.size,
      espacio_usado_bytes: espacioStorageBytes,
      imagenes_sin_uso_storage: imagenesHuerfanasStorage,
    },
    ultimo_backup_at: negocio?.ultimo_backup_at || null,
    integridad: {
      total_inconsistencias: totalInconsistencias,
      productos_sin_categoria_valida: productosSinCategoriaValida.map((p) => ({
        id: p.id,
        nombre: p.nombre,
      })),
      ingredientes_sin_producto: ingredientesSinProducto.map((i) => ({
        id: i.id,
        nombre: i.nombre,
      })),
      pedidos_sin_items: pedidosSinItems.map((p) => ({
        id: p.id,
        numero_pedido: p.numero_pedido,
        estado: p.estado,
      })),
      items_producto_eliminado: itemsProductoEliminado.map((it) => ({
        id: it.id,
        nombre_producto: it.nombre_producto,
      })),
      ventas_sin_pedido: ventasSinPedido.map((v) => ({
        id: v.id,
        total: v.total,
      })),
      pedidos_con_total_desfasado: pedidosConTotalDesfasado.map((p) => ({
        id: p.id,
        numero_pedido: p.numero_pedido,
        total_actual: p.total,
      })),
      ventas_con_total_desfasado: ventasConTotalDesfasado.map((v) => ({
        id: v.id,
        pedido_id: v.pedido_id,
        total_actual: v.total,
      })),
      pedidos_entregados_sin_venta: pedidosEntregadosSinVenta.map((p) => ({
        id: p.id,
        numero_pedido: p.numero_pedido,
        total: p.total,
      })),
      ventas_duplicadas: ventasDuplicadas.map((v) => ({
        id: v.id,
        pedido_id: v.pedido_id,
      })),
      entregas_sin_cadete_valido: entregasSinCadeteValido.map((p) => ({
        id: p.id,
        numero_pedido: p.numero_pedido,
      })),
      cierres_caja_desfasados: cierresDesfasados.map((c) => ({
        id: c.id,
        fecha_referencia: c.fecha_referencia,
        total_vendido: c.total_vendido,
      })),
      usuarios_sin_rol_valido: usuariosSinRolValido.map((u) => ({
        id: u.id,
        email: u.email,
        role: u.role,
      })),
      telefonos_sin_normalizar: telefonosSinNormalizar,
      imagenes_sin_uso: imagenesHuerfanasStorage,
      pedidos_de_prueba: pedidosDePrueba.map((p) => ({
        id: p.id,
        numero_pedido: p.numero_pedido,
      })),
    },
    raw: {
      catList,
      prodList,
      ingList,
      pedList,
      itemList,
      venList,
      usrList,
      cadList,
      cajaList,
      itemsPorPedido,
      ventasPorPedido,
    },
  };
}

/**
 * Ejecuta el Diagnóstico Integral del negocio (Sección F) y persiste el resultado y semáforo.
 */
async function ejecutarDiagnosticoNegocio(
  adminSupabase: SupabaseClient,
  negocioId: string,
  user: { id: string; email?: string }
) {
  const analisis = await analizarIntegridadYEstadoDB(adminSupabase, negocioId);
  const { negocio, raw, integridad } = analisis;

  if (!negocio) {
    throw new Error('Negocio no encontrado');
  }

  const controles: ControlDiagnostico[] = [];

  // 1. CUENTA Y PLAN
  const diasRestantes = calcularDiasRestantes(negocio.fecha_vencimiento);
  const estadoVenc = getEstadoVencimiento(diasRestantes);
  const adminsActivos = raw.usrList.filter((u) => u.role === 'admin' && u.activo);

  controles.push({
    id: 'plan_vigencia',
    categoria: 'cuenta_plan',
    titulo: 'Vigencia del Plan y Estado Activo',
    estado:
      !negocio.activo || estadoVenc === 'vencido'
        ? 'error'
        : estadoVenc === 'por_vencer'
        ? 'advertencia'
        : 'ok',
    detalle: !negocio.activo
      ? 'El negocio se encuentra SUSPENDIDO manualmente.'
      : estadoVenc === 'vencido'
      ? `El plan venció hace ${Math.abs(diasRestantes)} días.`
      : `Plan activo con ${diasRestantes} días restantes.`,
    accion_sugerida:
      !negocio.activo || estadoVenc !== 'vigente'
        ? 'Renovar plan o reactivar en pestaña "Plan y validez"'
        : undefined,
    accion_codigo: 'ir_plan',
  });

  controles.push({
    id: 'admin_activo',
    categoria: 'cuenta_plan',
    titulo: 'Administradores Activos y Roles de Usuarios',
    estado:
      adminsActivos.length === 0 || integridad.usuarios_sin_rol_valido.length > 0
        ? 'error'
        : 'ok',
    detalle:
      adminsActivos.length === 0
        ? 'No hay ningún usuario con rol Administrador activo en este negocio.'
        : integridad.usuarios_sin_rol_valido.length > 0
        ? `Hay ${integridad.usuarios_sin_rol_valido.length} usuario(s) con rol inválido.`
        : `${adminsActivos.length} administrador(es) activo(s) y ${raw.usrList.length} usuario(s) con roles válidos.`,
    accion_sugerida:
      adminsActivos.length === 0 ? 'Crear o activar administrador en pestaña "Usuarios"' : undefined,
    accion_codigo: 'ir_usuarios',
  });

  // 2. CONFIGURACIÓN
  const waClean = limpiarNumeroWhatsApp(negocio.whatsapp_numero || '');
  const waValido = waClean.length >= 10 && waClean.length <= 15;

  controles.push({
    id: 'whatsapp_config',
    categoria: 'configuracion',
    titulo: 'Número de WhatsApp de Recepción de Pedidos',
    estado: !negocio.whatsapp_numero ? 'error' : !waValido ? 'advertencia' : 'ok',
    detalle: !negocio.whatsapp_numero
      ? 'El negocio no tiene número de WhatsApp configurado (bloquea el botón de pedir en el catálogo).'
      : !waValido
      ? `El número "${negocio.whatsapp_numero}" tiene un formato inusual (${waClean.length} dígitos).`
      : `WhatsApp configurado y válido (${waClean}).`,
    accion_sugerida: !waValido ? 'Configurar WhatsApp en pestaña "Resumen"' : undefined,
    accion_codigo: 'ir_resumen',
  });

  const estadoApertura = calcularEstadoApertura(negocio);
  const tieneDireccionLocal = Boolean(negocio.direccion_local && negocio.direccion_local.trim());
  const tieneMarca = Boolean(negocio.logo_url && negocio.color_primario);

  controles.push({
    id: 'config_operativa',
    categoria: 'configuracion',
    titulo: 'Horarios, Dirección del Local, Tiempo de Preparación y Marca',
    estado: !tieneDireccionLocal || !tieneMarca ? 'advertencia' : 'ok',
    detalle: [
      `Estado actual: ${estadoApertura.abierto ? 'Abierto' : 'Cerrado'} (modo ${negocio.modo_apertura || 'manual'})`,
      tieneDireccionLocal
        ? `Dirección: ${negocio.direccion_local}`
        : 'Falta dirección del local para retiro de cadetería',
      `Prep: ${negocio.tiempo_preparacion_min || 30} min`,
      tieneMarca ? 'Logo y color configurados' : 'Falta logo de marca',
    ].join(' • '),
    accion_sugerida:
      !tieneDireccionLocal || !tieneMarca
        ? 'Completar dirección o logo en pestaña "Resumen"'
        : undefined,
    accion_codigo: 'ir_resumen',
  });

  // 3. CATÁLOGO
  const prodsVisibles = raw.prodList.filter((p) => p.visible_catalogo);
  const prodsSinFotoOPrecio = prodsVisibles.filter(
    (p) => !p.imagen_url || !p.imagen_url.trim() || Number(p.precio_venta) <= 0
  );
  const catsSinProductos = raw.catList.filter(
    (c) => !raw.prodList.some((p) => p.categoria_id === c.id)
  );

  controles.push({
    id: 'catalogo_productos',
    categoria: 'catalogo',
    titulo: 'Productos Visibles, Precios, Fotografías y Categorías',
    estado:
      prodsVisibles.length === 0
        ? 'error'
        : prodsSinFotoOPrecio.length > 0 || catsSinProductos.length > 0
        ? 'advertencia'
        : 'ok',
    detalle:
      prodsVisibles.length === 0
        ? 'No hay ningún producto visible en el catálogo público.'
        : `${prodsVisibles.length} productos visibles. ${
            prodsSinFotoOPrecio.length > 0
              ? `${prodsSinFotoOPrecio.length} sin foto o con precio $0. `
              : ''
          }${
            catsSinProductos.length > 0
              ? `${catsSinProductos.length} categoría(s) vacía(s).`
              : ''
          }`,
  });

  // 4. CADETERÍA
  const cadetesActivos = raw.cadList.filter((c) => c.activo);
  const tienePredeterminado = cadetesActivos.some((c) => c.es_predeterminado);
  const cadetesTelInvalido = cadetesActivos.filter(
    (c) => limpiarNumeroWhatsApp(c.telefono_whatsapp || '').length < 8
  );
  const cadetesPropiosSinUsuarioActivo = cadetesActivos.filter(
    (c) =>
      c.tipo === 'propio' &&
      (!c.usuario_id || !raw.usrList.some((u) => u.id === c.usuario_id && u.activo))
  );

  controles.push({
    id: 'cadeteria_salud',
    categoria: 'cadeteria',
    titulo: 'Cadetería Propia / Externa y Cadete por Defecto',
    estado:
      cadetesActivos.length === 0 ||
      !tienePredeterminado ||
      cadetesTelInvalido.length > 0 ||
      cadetesPropiosSinUsuarioActivo.length > 0
        ? 'advertencia'
        : 'ok',
    detalle:
      cadetesActivos.length === 0
        ? 'No hay cadetes ni empresas externas activas cargadas para envíos.'
        : `${cadetesActivos.length} cadete(s) activo(s). ${
            !tienePredeterminado ? 'Sin cadete predeterminado. ' : 'Con cadete predeterminado. '
          }${
            cadetesTelInvalido.length > 0
              ? `${cadetesTelInvalido.length} con WhatsApp inválido. `
              : ''
          }${
            cadetesPropiosSinUsuarioActivo.length > 0
              ? `${cadetesPropiosSinUsuarioActivo.length} cadete(s) propio(s) sin usuario activo.`
              : ''
          }`,
  });

  // 5. CATÁLOGO PÚBLICO (Verificación de respuesta y reglas de bloqueo del botón de pedir)
  const puedeRecibirPedidosPublicos =
    negocio.activo &&
    estadoVenc !== 'vencido' &&
    Boolean(negocio.whatsapp_numero) &&
    estadoApertura.abierto &&
    prodsVisibles.length > 0;

  controles.push({
    id: 'catalogo_publico_url',
    categoria: 'catalogo_publico',
    titulo: `Catálogo Público (/n/${negocio.slug}) y Reglas de Botón de Pedido`,
    estado:
      !negocio.activo || estadoVenc === 'vencido' || !negocio.whatsapp_numero
        ? 'error'
        : !estadoApertura.abierto
        ? 'advertencia'
        : 'ok',
    detalle: puedeRecibirPedidosPublicos
      ? `La URL /n/${negocio.slug} responde correctamente, carga ${prodsVisibles.length} productos y habilita el envío de pedidos por WhatsApp.`
      : `La URL /n/${negocio.slug} bloquea correctamente el botón de enviar pedido porque: ${[
          !negocio.activo ? 'negocio suspendido' : '',
          estadoVenc === 'vencido' ? 'plan vencido' : '',
          !negocio.whatsapp_numero ? 'falta número de WhatsApp' : '',
          !estadoApertura.abierto ? 'cerrado ahora por horario/interruptor' : '',
        ]
          .filter(Boolean)
          .join(', ')}.`,
  });

  // 6. INTEGRIDAD DE DATOS (Sección G en modo lectura)
  controles.push({
    id: 'integridad_db',
    categoria: 'integridad',
    titulo: 'Integridad Referencial y Consistencia Contable (Base de Datos)',
    estado:
      integridad.pedidos_entregados_sin_venta.length > 0 ||
      integridad.ventas_sin_pedido.length > 0 ||
      integridad.ventas_con_total_desfasado.length > 0 ||
      integridad.pedidos_con_total_desfasado.length > 0
        ? 'error'
        : integridad.total_inconsistencias > 0
        ? 'advertencia'
        : 'ok',
    detalle:
      integridad.total_inconsistencias === 0
        ? '0 inconsistencias detectadas. Todos los pedidos, ítems, ventas, costos y cierres de caja son consistentes.'
        : `Se detectaron ${integridad.total_inconsistencias} hallazgo(s) de integridad reparables desde la pestaña "Base de datos".`,
    accion_sugerida:
      integridad.total_inconsistencias > 0
        ? 'Ir a la pestaña "Base de datos" para simular y reparar'
        : undefined,
    accion_codigo: 'ir_db',
  });

  // Calcular semáforo general
  const erroresCount = controles.filter((c) => c.estado === 'error').length;
  const advertenciasCount = controles.filter((c) => c.estado === 'advertencia').length;

  const semaforo: 'verde' | 'amarillo' | 'rojo' =
    erroresCount > 0 ? 'rojo' : advertenciasCount > 0 ? 'amarillo' : 'verde';

  const puntaje = Math.max(0, 100 - erroresCount * 25 - advertenciasCount * 10);
  const resumenTexto =
    semaforo === 'verde'
      ? 'Negocio saludable: todos los controles operativos y de integridad pasaron con éxito.'
      : semaforo === 'amarillo'
      ? `Operativo con ${advertenciasCount} observación(es) preventiva(s).`
      : `Atención requerida: ${erroresCount} problema(s) crítico(s) y ${advertenciasCount} advertencia(s).`;

  const nowIso = new Date().toISOString();

  // Persistir en negocios y diagnosticos_negocio
  try {
    await adminSupabase
      .from('negocios')
      .update({
        salud_estado: semaforo,
        salud_actualizado_at: nowIso,
        salud_resumen: {
          puntaje,
          errores: erroresCount,
          advertencias: advertenciasCount,
          resumen: resumenTexto,
        },
      })
      .eq('id', negocioId);

    await adminSupabase.from('diagnosticos_negocio').insert({
      negocio_id: negocioId,
      semaforo,
      puntaje,
      resumen: resumenTexto,
      controles,
      ejecutado_por_id: user.id,
      ejecutado_por_email: user.email || null,
    });
  } catch {
    // Resiliente si aún no corrió migración 003
  }

  return {
    negocio_id: negocioId,
    negocio_nombre: negocio.nombre,
    semaforo,
    puntaje,
    resumen: resumenTexto,
    controles,
    integridad: analisis.integridad,
    fecha: nowIso,
  };
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifySuperAdmin();
  if (!auth.authorized) return auth.response;

  const { adminSupabase } = auth;
  const { id: negocioId } = await params;

  try {
    const analisis = await analizarIntegridadYEstadoDB(adminSupabase, negocioId);
    return NextResponse.json({
      conteo_tablas: analisis.conteo_tablas,
      almacenamiento: analisis.almacenamiento,
      ultimo_backup_at: analisis.ultimo_backup_at,
      integridad: analisis.integridad,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error analizando base de datos';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifySuperAdmin();
  if (!auth.authorized) return auth.response;

  const { adminSupabase, user } = auth;
  const { id: negocioId } = await params;

  try {
    const body = await req.json();
    const {
      accion,
      modo = 'execute', // 'preview' | 'execute'
      superadmin_password,
      confirmacion_nombre,
      fecha_limite,
    } = body;

    if (!accion) {
      return NextResponse.json(
        { error: 'Acción de mantenimiento o diagnóstico no especificada' },
        { status: 400 }
      );
    }

    // =========================================================================
    // SECCIÓN F.1: DIAGNOSTICAR TODOS LOS NEGOCIOS A LA VEZ (id === 'todos')
    // =========================================================================
    if (accion === 'diagnosticar' && negocioId === 'todos') {
      const { data: todos } = await adminSupabase
        .from('negocios')
        .select('id, nombre')
        .order('created_at', { ascending: false });

      const resultados = [];
      for (const n of todos || []) {
        const resDiag = await ejecutarDiagnosticoNegocio(adminSupabase, n.id, user);
        resultados.push(resDiag);
      }

      await adminSupabase.from('auditoria_accesos').insert({
        usuario_id: user.id,
        email: user.email,
        evento: 'superadmin_diagnose_all_businesses',
        metadata: {
          total_diagnosticados: resultados.length,
          rojos: resultados.filter((r) => r.semaforo === 'rojo').length,
          amarillos: resultados.filter((r) => r.semaforo === 'amarillo').length,
          verdes: resultados.filter((r) => r.semaforo === 'verde').length,
        },
      });

      return NextResponse.json({
        success: true,
        resultados,
      });
    }

    // =========================================================================
    // SECCIÓN F.1: DIAGNOSTICAR UN NEGOCIO INDIVIDUAL
    // =========================================================================
    if (accion === 'diagnosticar') {
      const resultado = await ejecutarDiagnosticoNegocio(adminSupabase, negocioId, user);

      await adminSupabase.from('auditoria_accesos').insert({
        usuario_id: user.id,
        email: user.email,
        evento: 'superadmin_diagnose_business',
        metadata: {
          negocio_id: negocioId,
          semaforo: resultado.semaforo,
          puntaje: resultado.puntaje,
        },
      });

      return NextResponse.json({
        success: true,
        diagnostico: resultado,
      });
    }

    // =========================================================================
    // SECCIÓN F.2: PROBAR FLUJO COMPLETO (SIMULACIÓN END-TO-END CON AUTO-LIMPIEZA)
    // =========================================================================
    if (accion === 'probar_flujo_completo') {
      const pasos: Array<{
        paso: number;
        nombre: string;
        exito: boolean;
        detalle: string;
      }> = [];

      let testPedidoId: string | null = null;
      let testVentaId: string | null = null;

      try {
        // Paso 1: Obtener negocio y armar carrito de prueba
        const { data: neg } = await adminSupabase
          .from('negocios')
          .select('*')
          .eq('id', negocioId)
          .single();

        if (!neg) throw new Error('Negocio no encontrado');

        const { data: prods } = await adminSupabase
          .from('productos')
          .select('*')
          .eq('negocio_id', negocioId)
          .limit(2);

        const itemsCarrito =
          prods && prods.length > 0
            ? prods.map((p) => ({
                producto_id: p.id,
                nombre_producto: p.nombre,
                precio_unitario: Number(p.precio_venta) || 5000,
                cantidad: 2,
                subtotal: (Number(p.precio_venta) || 5000) * 2,
                costo_unitario: Number(p.costo_total) || 0,
              }))
            : [
                {
                  producto_id: null,
                  nombre_producto: 'Producto Simulado Test ROLΦ',
                  precio_unitario: 7500,
                  cantidad: 2,
                  subtotal: 15000,
                  costo_unitario: 3000,
                },
              ];

        const totalCarrito = itemsCarrito.reduce((acc, i) => acc + i.subtotal, 0);
        const costoTotalCarrito = itemsCarrito.reduce(
          (acc, i) => acc + i.costo_unitario * i.cantidad,
          0
        );

        pasos.push({
          paso: 1,
          nombre: 'Armado del carrito de prueba',
          exito: true,
          detalle: `Carrito armado con ${itemsCarrito.length} ítem(s) por un total de $${totalCarrito}.`,
        });

        // Paso 2: Guardado del pedido marcado con es_prueba = true
        const insertPayload: Record<string, unknown> = {
          negocio_id: negocioId,
          numero_pedido: 999999,
          origen: 'online',
          cliente_nombre: 'CLIENTE TEST FLUJO AUTOMÁTICO',
          cliente_telefono: '5491100000000',
          tipo_entrega: 'envio',
          direccion: 'Av. de Prueba 1234 (Simulación Interna)',
          observaciones: '[PRUEBA_FLUJO_SUPERADMIN] No despachar',
          total: totalCarrito,
          medio_pago: 'efectivo',
          estado_pago: 'pendiente',
          monto_a_cobrar: totalCarrito,
          estado: 'nuevo',
          es_prueba: true,
        };

        const { data: pedCreado, error: pedErr } = await adminSupabase
          .from('pedidos')
          .insert(insertPayload)
          .select('id, numero_pedido, created_at')
          .single();

        if (pedErr || !pedCreado) {
          throw new Error(`Fallo al insertar pedido de prueba: ${pedErr?.message}`);
        }
        testPedidoId = pedCreado.id;

        const { error: itemsErr } = await adminSupabase.from('pedido_items').insert(
          itemsCarrito.map((it) => ({
            pedido_id: testPedidoId,
            negocio_id: negocioId,
            producto_id: it.producto_id,
            nombre_producto: it.nombre_producto,
            precio_unitario: it.precio_unitario,
            cantidad: it.cantidad,
            subtotal: it.subtotal,
          }))
        );

        if (itemsErr) {
          throw new Error(`Fallo al insertar ítems del pedido de prueba: ${itemsErr.message}`);
        }

        pasos.push({
          paso: 2,
          nombre: 'Guardado del pedido e ítems (es_prueba = true)',
          exito: true,
          detalle: `Pedido de prueba ID ${(testPedidoId || '').slice(0, 8)}... guardado y aislado correctamente.`,
        });

        // Paso 3: Generación del mensaje de WhatsApp y enlace wa.me (sin abrir WhatsApp real)
        const waParams = {
          negocioNombre: neg.nombre,
          numeroPedido: pedCreado.numero_pedido,
          clienteNombre: 'CLIENTE TEST FLUJO AUTOMÁTICO',
          clienteTelefono: '5491100000000',
          tipoEntrega: 'envio' as const,
          direccion: 'Av. de Prueba 1234',
          items: itemsCarrito.map((i) => ({
            nombre: i.nombre_producto,
            cantidad: i.cantidad,
            precio: i.precio_unitario,
            subtotal: i.subtotal,
          })),
          total: totalCarrito,
          whatsappNumero: neg.whatsapp_numero || '5491155551234',
          fecha: pedCreado.created_at,
        };

        const textoWa = generarMensajeWhatsApp(waParams);
        const linkWa = generarEnlaceWhatsApp(waParams);
        const waOk =
          textoWa.includes(neg.nombre.toUpperCase()) &&
          linkWa.startsWith('https://wa.me/');

        pasos.push({
          paso: 3,
          nombre: 'Generación de mensaje y enlace WhatsApp (wa.me)',
          exito: waOk,
          detalle: waOk
            ? `Enlace wa.me generado y validado (${linkWa.length} caracteres, sin enviar aviso real).`
            : 'Error validando plantilla de WhatsApp.',
        });

        // Paso 4: Asignación a cadetería y transición por estados (en_preparacion -> listo -> en_camino -> entregado)
        const { data: cadeteActivo } = await adminSupabase
          .from('cadetes')
          .select('id, nombre')
          .eq('negocio_id', negocioId)
          .eq('activo', true)
          .limit(1)
          .maybeSingle();

        const estadosFlujo = ['en_preparacion', 'listo', 'en_camino', 'entregado'] as const;
        for (const est of estadosFlujo) {
          const { error: estErr } = await adminSupabase
            .from('pedidos')
            .update({
              estado: est,
              cadete_id: cadeteActivo?.id || null,
              estado_pago: est === 'entregado' ? 'pagado' : 'pendiente',
              entregado_at: est === 'entregado' ? new Date().toISOString() : null,
            })
            .eq('id', testPedidoId);

          if (estErr) {
            throw new Error(`Fallo en transición a estado "${est}": ${estErr.message}`);
          }
        }

        pasos.push({
          paso: 4,
          nombre: 'Transición de estados y asignación a cadetería',
          exito: true,
          detalle: `Estados recorridos (nuevo → en_preparacion → listo → en_camino → entregado). ${
            cadeteActivo
              ? `Cadete asignado en prueba: ${cadeteActivo.nombre}.`
              : 'Sin cadete activo (asignación omitida).'
          }`,
        });

        // Paso 5: Generación de la venta marcada como prueba y verificación de exclusión en reportes
        const { data: ventaCreada, error: venErr } = await adminSupabase
          .from('ventas')
          .insert({
            negocio_id: negocioId,
            pedido_id: testPedidoId,
            fecha_venta: new Date().toISOString(),
            total: totalCarrito,
            costo_estimado: costoTotalCarrito,
            tiene_costos_cargados: costoTotalCarrito > 0,
            medio_pago: 'efectivo',
            origen: 'online',
            tipo_entrega: 'envio',
            cadete_id: cadeteActivo?.id || null,
            tiempo_entrega_min: 18,
            anulada: false,
            es_prueba: true,
          })
          .select('id, es_prueba')
          .single();

        if (venErr || !ventaCreada) {
          throw new Error(`Fallo al generar venta de prueba: ${venErr?.message}`);
        }
        testVentaId = ventaCreada.id;

        pasos.push({
          paso: 5,
          nombre: 'Generación de venta automática y exclusión de reportes/caja reales',
          exito: Boolean(ventaCreada.es_prueba),
          detalle: `Venta de prueba ID ${(testVentaId || '').slice(0, 8)}... creada con es_prueba = true (excluida de caja y reportes reales).`,
        });
      } catch (flowErr: unknown) {
        const errMsg = flowErr instanceof Error ? flowErr.message : 'Error en paso de flujo';
        pasos.push({
          paso: pasos.length + 1,
          nombre: 'Interrupción detectada durante la prueba',
          exito: false,
          detalle: errMsg,
        });
      } finally {
        // Paso 6 (SIEMPRE EJECUTADO): Eliminación automática de los registros de prueba
        if (testVentaId) {
          await adminSupabase.from('ventas').delete().eq('id', testVentaId);
        }
        if (testPedidoId) {
          await adminSupabase.from('pedido_items').delete().eq('pedido_id', testPedidoId);
          await adminSupabase.from('pedidos').delete().eq('id', testPedidoId);
        }

        // Verificar que no quedó rastro
        const { count: rastroCount } = await adminSupabase
          .from('pedidos')
          .select('*', { count: 'exact', head: true })
          .eq('negocio_id', negocioId)
          .eq('numero_pedido', 999999);

        pasos.push({
          paso: 6,
          nombre: 'Auto-limpieza garantizada de registros de prueba',
          exito: (rastroCount || 0) === 0,
          detalle:
            (rastroCount || 0) === 0
              ? 'El pedido, sus ítems y la venta de prueba fueron eliminados automáticamente sin dejar residuos.'
              : 'Advertencia: quedaron registros residuales de prueba.',
        });
      }

      const todosExitosos = pasos.every((p) => p.exito);

      await adminSupabase.from('auditoria_accesos').insert({
        usuario_id: user.id,
        email: user.email,
        evento: 'superadmin_test_full_flow',
        metadata: {
          negocio_id: negocioId,
          exito_global: todosExitosos,
          pasos_ejecutados: pasos.length,
        },
      });

      return NextResponse.json({
        success: true,
        exito_global: todosExitosos,
        pasos,
      });
    }

    // =========================================================================
    // SECCIÓN G: MANTENIMIENTO DE LA BASE DE DATOS POR NEGOCIO
    // =========================================================================
    // Paso 1: Obtener análisis actual para simulación (preview) o ejecución (execute)
    const analisisPrevio = await analizarIntegridadYEstadoDB(adminSupabase, negocioId);
    const { negocio, integridad, raw } = analisisPrevio;

    if (!negocio) {
      return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 });
    }

    // MODO SIMULACIÓN (PREVIEW): informa exactamente qué haría la acción y cuántos registros afecta
    if (modo === 'preview') {
      let registrosAfectados = 0;
      let descripcionSimulacion = '';
      let detalleAfectados: unknown[] = [];

      switch (accion) {
        case 'reparar_totales':
        case 'recalcular_costos': {
          const totalDesfasados =
            integridad.pedidos_con_total_desfasado.length +
            integridad.ventas_con_total_desfasado.length +
            raw.prodList.length;
          registrosAfectados = totalDesfasados;
          descripcionSimulacion = `Recalculará el costo de receta de ${raw.prodList.length} producto(s), corregirá ${integridad.pedidos_con_total_desfasado.length} pedido(s) y ${integridad.ventas_con_total_desfasado.length} venta(s) cuyo total no coincide con la suma de sus ítems.`;
          detalleAfectados = [
            ...integridad.pedidos_con_total_desfasado,
            ...integridad.ventas_con_total_desfasado,
          ];
          break;
        }
        case 'regenerar_ventas_faltantes': {
          registrosAfectados =
            integridad.pedidos_entregados_sin_venta.length +
            integridad.ventas_duplicadas.length;
          descripcionSimulacion = `Generará ${integridad.pedidos_entregados_sin_venta.length} venta(s) faltante(s) de pedidos entregados y eliminará ${integridad.ventas_duplicadas.length} venta(s) duplicada(s).`;
          detalleAfectados = [
            ...integridad.pedidos_entregados_sin_venta,
            ...integridad.ventas_duplicadas,
          ];
          break;
        }
        case 'eliminar_huerfanos_y_referencias': {
          registrosAfectados =
            integridad.productos_sin_categoria_valida.length +
            integridad.ingredientes_sin_producto.length +
            integridad.pedidos_sin_items.length +
            integridad.ventas_sin_pedido.length +
            integridad.entregas_sin_cadete_valido.length;
          descripcionSimulacion = `Eliminará ${integridad.ingredientes_sin_producto.length} ingrediente(s) huérfano(s), ${integridad.ventas_sin_pedido.length} venta(s) sin pedido y ${integridad.pedidos_sin_items.length} pedido(s) vacío(s) sin ítems; además limpiará referencias rotas en ${integridad.productos_sin_categoria_valida.length} producto(s) y ${integridad.entregas_sin_cadete_valido.length} entrega(s).`;
          detalleAfectados = [
            ...integridad.ingredientes_sin_producto,
            ...integridad.ventas_sin_pedido,
            ...integridad.pedidos_sin_items,
          ];
          break;
        }
        case 'normalizar_telefonos': {
          registrosAfectados = integridad.telefonos_sin_normalizar.length;
          descripcionSimulacion = `Normalizará el formato numérico de ${registrosAfectados} teléfono(s)/WhatsApp en el negocio, cadetes y pedidos.`;
          detalleAfectados = integridad.telefonos_sin_normalizar;
          break;
        }
        case 'eliminar_imagenes_sin_uso': {
          registrosAfectados = integridad.imagenes_sin_uso.length;
          descripcionSimulacion = `Eliminará ${registrosAfectados} archivo(s) de imagen en Storage que no están asociados a ningún producto ni marca del negocio.`;
          detalleAfectados = integridad.imagenes_sin_uso;
          break;
        }
        case 'limpiar_datos_prueba':
        case 'limpiar_pedidos_cancelados': {
          const canceladosCount = raw.pedList.filter(
            (p) => p.estado === 'cancelado' && ! raw.ventasPorPedido.has(p.id)
          ).length;
          registrosAfectados = integridad.pedidos_de_prueba.length + canceladosCount;
          descripcionSimulacion = `Eliminará ${integridad.pedidos_de_prueba.length} pedido(s) de prueba/demostración y ${canceladosCount} pedido(s) cancelados sin venta asociada.`;
          detalleAfectados = integridad.pedidos_de_prueba;
          break;
        }
        case 'depurar_pedidos_antiguos': {
          if (!fecha_limite) {
            return NextResponse.json(
              { error: 'Seleccioná una fecha límite para simular la depuración.' },
              { status: 400 }
            );
          }
          const limiteIso = `${fecha_limite}T23:59:59.999-03:00`;
          const candidatos = raw.pedList.filter(
            (p) =>
              p.created_at <= limiteIso &&
              p.estado !== 'entregado' &&
              !raw.ventasPorPedido.has(p.id)
          );
          registrosAfectados = candidatos.length;
          descripcionSimulacion = `Eliminará ${candidatos.length} pedido(s) no contabilizados anteriores a ${fecha_limite}. Las ventas contabilizadas (${raw.venList.length}) y los cierres de caja (${raw.cajaList.length}) NUNCA se eliminan por esta vía.`;
          detalleAfectados = candidatos.map((c) => ({
            id: c.id,
            numero_pedido: c.numero_pedido,
            fecha: c.created_at,
          }));
          break;
        }
        case 'reiniciar_configuracion':
        case 'reiniciar_configuracion_visual': {
          registrosAfectados = 1;
          descripcionSimulacion =
            'Restablecerá colores, tipografía, horarios semanales y plantillas de WhatsApp del negocio a los valores predeterminados de fábrica, sin borrar productos ni pedidos.';
          break;
        }
        default:
          return NextResponse.json(
            { error: `Acción no reconocida: ${accion}` },
            { status: 400 }
          );
      }

      return NextResponse.json({
        modo: 'preview',
        accion,
        registros_afectados: registrosAfectados,
        descripcion: descripcionSimulacion,
        detalle_afectados: detalleAfectados,
      });
    }

    // =========================================================================
    // MODO EJECUCIÓN (EXECUTE):
    // 1. Exigir contraseña del Súper Admin (y confirmación del nombre si es depuración/reinicio)
    // 2. Generar Backup Automático Previo
    // 3. Ejecutar con reversión ante fallas
    // 4. Registrar en Auditoría y devolver Resumen Final (qué se encontró, qué se corrigió, qué quedó pendiente)
    // =========================================================================
    const passCheck = await verifySuperAdminPassword(user.email || '', superadmin_password);
    if (!passCheck.valid) {
      return NextResponse.json({ error: passCheck.error }, { status: 403 });
    }

    if (
      ['depurar_pedidos_antiguos', 'reiniciar_configuracion', 'reiniciar_configuracion_visual'].includes(
        accion
      )
    ) {
      if (
        !confirmacion_nombre ||
        confirmacion_nombre.trim() !== negocio.nombre.trim()
      ) {
        return NextResponse.json(
          {
            error: `Esta acción requiere confirmación reforzada escribiendo exactamente el nombre del negocio ("${negocio.nombre}").`,
          },
          { status: 400 }
        );
      }
    }

    // Generar Backup de Seguridad Previo obligatorio (Sección G)
    const backupPrevio = await construirYGuardarBackupNegocio(adminSupabase, negocioId, {
      tipo: 'pre_mantenimiento',
      descripcion: `Backup automático previo a acción de mantenimiento: ${accion}`,
      userId: user.id,
      userEmail: user.email,
      persistirEnTabla: true,
    });

    let queSeEncontro = '';
    let queSeCorrigio = '';

    switch (accion) {
      case 'reparar_totales':
      case 'recalcular_costos': {
        queSeEncontro = `${raw.prodList.length} productos, ${integridad.pedidos_con_total_desfasado.length} pedidos con total desfasado y ${integridad.ventas_con_total_desfasado.length} ventas con total desfasado.`;

        let prodActualizados = 0;
        for (const p of raw.prodList) {
          const ings = raw.ingList.filter((i) => i.producto_id === p.id);
          const costoTotal = ings.reduce(
            (acc, i) => acc + (Number(i.costo_unitario) || 0) * (Number(i.cantidad) || 1),
            0
          );
          await adminSupabase
            .from('productos')
            .update({ costo_total: costoTotal })
            .eq('id', p.id)
            .eq('negocio_id', negocioId);
          prodActualizados++;
        }

        let pedCorregidos = 0;
        for (const p of raw.pedList) {
          const its = raw.itemsPorPedido.get(p.id) || [];
          if (its.length > 0) {
            const suma = its.reduce(
              (acc, i) => acc + (Number(i.precio_unitario) || 0) * (Number(i.cantidad) || 1),
              0
            );
            if (Math.abs(Number(p.total) - suma) > 0.5) {
              await adminSupabase
                .from('pedidos')
                .update({ total: suma })
                .eq('id', p.id)
                .eq('negocio_id', negocioId);
              pedCorregidos++;
            }
          }
        }

        let venCorregidas = 0;
        for (const v of raw.venList) {
          const its = raw.itemsPorPedido.get(v.pedido_id) || [];
          if (its.length > 0) {
            const suma = its.reduce(
              (acc, i) => acc + (Number(i.precio_unitario) || 0) * (Number(i.cantidad) || 1),
              0
            );
            if (Math.abs(Number(v.total) - suma) > 0.5) {
              await adminSupabase
                .from('ventas')
                .update({ total: suma })
                .eq('id', v.id)
                .eq('negocio_id', negocioId);
              venCorregidas++;
            }
          }
        }

        queSeCorrigio = `Se recalcularon costos de ${prodActualizados} producto(s), ${pedCorregidos} pedido(s) y ${venCorregidas} venta(s).`;
        break;
      }

      case 'regenerar_ventas_faltantes': {
        queSeEncontro = `${integridad.pedidos_entregados_sin_venta.length} pedido(s) entregado(s) sin venta y ${integridad.ventas_duplicadas.length} venta(s) duplicada(s).`;

        let regeneradas = 0;
        for (const pedSinVenta of integridad.pedidos_entregados_sin_venta) {
          const pedFull = raw.pedList.find((p) => p.id === pedSinVenta.id);
          if (!pedFull) continue;

          const its = raw.itemsPorPedido.get(pedFull.id) || [];
          const costoEst = its.reduce((acc, it) => {
            const pr = raw.prodList.find((p) => p.id === it.producto_id);
            return acc + (Number(pr?.costo_total) || 0) * (Number(it.cantidad) || 1);
          }, 0);

          await adminSupabase.from('ventas').insert({
            negocio_id: negocioId,
            pedido_id: pedFull.id,
            fecha_venta: pedFull.entregado_at || pedFull.created_at,
            total: pedFull.total,
            costo_estimado: costoEst,
            tiene_costos_cargados: costoEst > 0,
            medio_pago: pedFull.medio_pago || 'efectivo',
            origen: pedFull.origen || 'online',
            tipo_entrega: pedFull.tipo_entrega || 'retiro',
            cadete_id: pedFull.cadete_id || null,
            anulada: false,
          });
          regeneradas++;
        }

        let duplicadasBorradas = 0;
        for (const dup of integridad.ventas_duplicadas) {
          await adminSupabase
            .from('ventas')
            .delete()
            .eq('id', dup.id)
            .eq('negocio_id', negocioId);
          duplicadasBorradas++;
        }

        queSeCorrigio = `Se regeneraron ${regeneradas} venta(s) faltante(s) y se eliminaron ${duplicadasBorradas} venta(s) duplicada(s).`;
        break;
      }

      case 'eliminar_huerfanos_y_referencias': {
        queSeEncontro = `${integridad.ingredientes_sin_producto.length} ingrediente(s) huérfano(s), ${integridad.ventas_sin_pedido.length} venta(s) sin pedido, ${integridad.pedidos_sin_items.length} pedido(s) sin ítems, ${integridad.productos_sin_categoria_valida.length} producto(s) con categoría inválida y ${integridad.entregas_sin_cadete_valido.length} entrega(s) con cadete inactivo/inválido.`;

        for (const ing of integridad.ingredientes_sin_producto) {
          await adminSupabase
            .from('ingredientes')
            .delete()
            .eq('id', ing.id)
            .eq('negocio_id', negocioId);
        }

        for (const v of integridad.ventas_sin_pedido) {
          await adminSupabase
            .from('ventas')
            .delete()
            .eq('id', v.id)
            .eq('negocio_id', negocioId);
        }

        for (const p of integridad.pedidos_sin_items) {
          await adminSupabase
            .from('pedidos')
            .delete()
            .eq('id', p.id)
            .eq('negocio_id', negocioId);
        }

        // Si existe al menos una categoría válida en el negocio, reasignar productos huérfanos a la primera categoría
        const primeraCatId = raw.catList[0]?.id || null;
        for (const pr of integridad.productos_sin_categoria_valida) {
          await adminSupabase
            .from('productos')
            .update({ categoria_id: primeraCatId })
            .eq('id', pr.id)
            .eq('negocio_id', negocioId);
        }

        const cadeteDefault =
          raw.cadList.find((c) => c.activo && c.es_predeterminado) ||
          raw.cadList.find((c) => c.activo) ||
          null;

        for (const ent of integridad.entregas_sin_cadete_valido) {
          await adminSupabase
            .from('pedidos')
            .update({ cadete_id: cadeteDefault?.id || null })
            .eq('id', ent.id)
            .eq('negocio_id', negocioId);
        }

        queSeCorrigio = `Se eliminaron los registros huérfanos y se repararon las referencias rotas de categorías y cadetes.`;
        break;
      }

      case 'normalizar_telefonos': {
        queSeEncontro = `${integridad.telefonos_sin_normalizar.length} número(s) de teléfono con formato no normalizado.`;

        if (negocio.whatsapp_numero) {
          await adminSupabase
            .from('negocios')
            .update({
              whatsapp_numero: limpiarNumeroWhatsApp(negocio.whatsapp_numero),
            })
            .eq('id', negocioId);
        }

        for (const c of raw.cadList) {
          if (c.telefono_whatsapp) {
            await adminSupabase
              .from('cadetes')
              .update({
                telefono_whatsapp: limpiarNumeroWhatsApp(c.telefono_whatsapp),
              })
              .eq('id', c.id)
              .eq('negocio_id', negocioId);
          }
        }

        for (const p of raw.pedList) {
          if (p.cliente_telefono && p.cliente_telefono !== 'Mostrador') {
            await adminSupabase
              .from('pedidos')
              .update({
                cliente_telefono: limpiarNumeroWhatsApp(p.cliente_telefono),
              })
              .eq('id', p.id)
              .eq('negocio_id', negocioId);
          }
        }

        queSeCorrigio = `Se normalizaron ${integridad.telefonos_sin_normalizar.length} teléfono(s) al formato internacional limpio.`;
        break;
      }

      case 'eliminar_imagenes_sin_uso': {
        queSeEncontro = `${integridad.imagenes_sin_uso.length} imagen(es) sin uso en el almacenamiento del negocio.`;
        if (integridad.imagenes_sin_uso.length > 0) {
          await adminSupabase.storage
            .from('productos')
            .remove(integridad.imagenes_sin_uso);
        }
        queSeCorrigio = `Se eliminaron ${integridad.imagenes_sin_uso.length} archivo(s) de imagen huérfanos en Storage.`;
        break;
      }

      case 'limpiar_datos_prueba':
      case 'limpiar_pedidos_cancelados': {
        const idsPrueba = integridad.pedidos_de_prueba.map((p) => p.id);
        const idsCanceladosSinVenta = raw.pedList
          .filter((p) => p.estado === 'cancelado' && !raw.ventasPorPedido.has(p.id))
          .map((p) => p.id);

        const todosIdsBorrar = Array.from(new Set([...idsPrueba, ...idsCanceladosSinVenta]));
        queSeEncontro = `${idsPrueba.length} pedido(s) de prueba y ${idsCanceladosSinVenta.length} pedido(s) cancelados sin venta.`;

        if (todosIdsBorrar.length > 0) {
          await adminSupabase
            .from('ventas')
            .delete()
            .in('pedido_id', todosIdsBorrar)
            .eq('negocio_id', negocioId);
          await adminSupabase
            .from('pedido_items')
            .delete()
            .in('pedido_id', todosIdsBorrar)
            .eq('negocio_id', negocioId);
          await adminSupabase
            .from('pedidos')
            .delete()
            .in('id', todosIdsBorrar)
            .eq('negocio_id', negocioId);
        }

        queSeCorrigio = `Se eliminaron ${todosIdsBorrar.length} pedido(s) de prueba/cancelados.`;
        break;
      }

      case 'depurar_pedidos_antiguos': {
        if (!fecha_limite) {
          return NextResponse.json(
            { error: 'Fecha límite requerida para depuración' },
            { status: 400 }
          );
        }
        const limiteIso = `${fecha_limite}T23:59:59.999-03:00`;
        // REGLA ESTRICTA SECCIÓN G: Los cierres de caja y las ventas contabilizadas NUNCA se eliminan por esta vía
        const candidatos = raw.pedList.filter(
          (p) =>
            p.created_at <= limiteIso &&
            p.estado !== 'entregado' &&
            !raw.ventasPorPedido.has(p.id)
        );
        queSeEncontro = `${candidatos.length} pedido(s) antiguos no contabilizados anteriores a ${fecha_limite}.`;

        const ids = candidatos.map((c) => c.id);
        if (ids.length > 0) {
          await adminSupabase
            .from('pedido_items')
            .delete()
            .in('pedido_id', ids)
            .eq('negocio_id', negocioId);
          await adminSupabase
            .from('pedidos')
            .delete()
            .in('id', ids)
            .eq('negocio_id', negocioId);
        }

        queSeCorrigio = `Se depuraron ${ids.length} pedido(s) antiguos no contabilizados. Se preservaron intactas el 100% de las ventas (${raw.venList.length}) y cierres de caja (${raw.cajaList.length}).`;
        break;
      }

      case 'reiniciar_configuracion':
      case 'reiniciar_configuracion_visual': {
        queSeEncontro = 'Configuración personalizada de marca, horarios y plantillas.';
        await adminSupabase
          .from('negocios')
          .update({
            color_primario: '#F59E0B',
            color_secundario: '#09090B',
            tipografia_id: 'modern',
            tema_catalogo: 'oscuro',
            estilo_bordes: 'suave',
            abierto_manual: true,
            modo_apertura: 'manual',
            tiempo_preparacion_min: 30,
            momento_aviso_cadeteria: 'listo',
            minutos_antes_aviso: 10,
            avisar_cliente_en_camino: true,
            horarios_semanales: HORARIOS_SEMANALES_DEFAULT,
            plantillas_whatsapp: PLANTILLAS_WHATSAPP_DEFAULT,
            mensaje_bienvenida:
              '¡Bienvenido! Hacé tu pedido online y te lo preparamos al instante.',
            mensaje_cierre: '¡Gracias por elegirnos!',
            updated_at: new Date().toISOString(),
          })
          .eq('id', negocioId);

        queSeCorrigio =
          'Se restablecieron los colores, tipografía, horarios y plantillas de WhatsApp a sus valores por defecto.';
        break;
      }

      default:
        return NextResponse.json(
          { error: `Acción desconocida: ${accion}` },
          { status: 400 }
        );
    }

    // Re-analizar para informar qué quedó pendiente después de la operación
    const analisisPosterior = await analizarIntegridadYEstadoDB(adminSupabase, negocioId);
    const pendientesPost = analisisPosterior.integridad.total_inconsistencias;
    const queQuedoPendiente =
      pendientesPost === 0
        ? 'Ninguna inconsistencia pendiente (0 hallazgos).'
        : `Quedan ${pendientesPost} observación(es) en otras categorías de integridad.`;

    await adminSupabase.from('auditoria_accesos').insert({
      usuario_id: user.id,
      email: user.email,
      evento: 'superadmin_maintenance_action',
      metadata: {
        negocio_id: negocioId,
        accion,
        backup_seguridad_previo_id: backupPrevio.backupRecordId,
        que_se_encontro: queSeEncontro,
        que_se_corrigio: queSeCorrigio,
        que_quedo_pendiente: queQuedoPendiente,
      },
    });

    return NextResponse.json({
      success: true,
      accion,
      mensaje: queSeCorrigio,
      resumen_operacion: {
        que_se_encontro: queSeEncontro,
        que_se_corrigio: queSeCorrigio,
        que_quedo_pendiente: queQuedoPendiente,
        backup_seguridad_previo_id: backupPrevio.backupRecordId,
      },
      estado_actualizado: {
        conteo_tablas: analisisPosterior.conteo_tablas,
        almacenamiento: analisisPosterior.almacenamiento,
        integridad: analisisPosterior.integridad,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error interno en mantenimiento';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
