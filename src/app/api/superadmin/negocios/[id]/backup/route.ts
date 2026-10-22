import { NextRequest, NextResponse } from 'next/server';
import {
  verifySuperAdmin,
  verifySuperAdminPassword,
  construirYGuardarBackupNegocio,
} from '@/lib/auth-server';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifySuperAdmin();
  if (!auth.authorized) return auth.response;

  const { adminSupabase, user } = auth;
  const { id: negocioId } = await params;
  const searchParams = req.nextUrl.searchParams;
  const backupIdEspecifico = searchParams.get('backup_id');

  try {
    // 1. Descargar un backup histórico guardado en public.backups_negocio
    if (backupIdEspecifico) {
      const { data: savedBackup, error: bErr } = await adminSupabase
        .from('backups_negocio')
        .select('*')
        .eq('id', backupIdEspecifico)
        .eq('negocio_id', negocioId)
        .single();

      if (bErr || !savedBackup) {
        return NextResponse.json({ error: 'Backup histórico no encontrado' }, { status: 404 });
      }

      return NextResponse.json(savedBackup.payload, {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="backup-${savedBackup.negocio_slug}-${savedBackup.created_at.slice(0, 10)}.json"`,
        },
      });
    }

    // 2. OPCIÓN GLOBAL: Backup de TODOS los negocios a la vez (id === 'todos')
    if (negocioId === 'todos') {
      const { data: todosNegocios } = await adminSupabase
        .from('negocios')
        .select('id, nombre, slug')
        .order('created_at', { ascending: true });

      const backupsNegocios = [];
      for (const neg of todosNegocios || []) {
        const res = await construirYGuardarBackupNegocio(adminSupabase, neg.id, {
          tipo: 'global',
          descripcion: 'Backup global de toda la plataforma',
          userId: user.id,
          userEmail: user.email,
          persistirEnTabla: true,
        });
        backupsNegocios.push(res.backupPayload);
      }

      const globalPayload = {
        app: 'Pedidos by ROLΦ',
        version: '2.0.0',
        tipo: 'backup_global_multinegocio',
        export_date: new Date().toISOString(),
        total_negocios: backupsNegocios.length,
        negocios: backupsNegocios,
      };

      await adminSupabase.from('auditoria_accesos').insert({
        usuario_id: user.id,
        email: user.email,
        evento: 'superadmin_export_backup_global',
        metadata: { total_negocios: backupsNegocios.length },
      });

      return NextResponse.json(globalPayload, {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="backup-global-rolfo-${new Date().toISOString().slice(0, 10)}.json"`,
        },
      });
    }

    // 3. Backup individual de un negocio
    const { backupRecordId, tamanoBytes, backupPayload } =
      await construirYGuardarBackupNegocio(adminSupabase, negocioId, {
        tipo: 'manual',
        descripcion: 'Backup manual descargado desde el panel del Súper Admin',
        userId: user.id,
        userEmail: user.email,
        persistirEnTabla: true,
      });

    await adminSupabase.from('auditoria_accesos').insert({
      usuario_id: user.id,
      email: user.email,
      evento: 'superadmin_export_backup_v2',
      metadata: {
        negocio_id: negocioId,
        backup_id: backupRecordId,
        tamano_bytes: tamanoBytes,
        items_count: backupPayload.estadisticas,
      },
    });

    return NextResponse.json(backupPayload, {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="backup-${backupPayload.negocio.slug}-v2-${new Date().toISOString().slice(0, 10)}.json"`,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * POST /api/superadmin/negocios/[id]/backup
 * Previsualiza, restaura o clona un backup v1.0.0 o v2.0.0 generando un backup de seguridad previo.
 */
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
      backup,
      modo, // 'preview' | 'restore' | 'clonar'
      confirmacion_nombre,
      superadmin_password,
    } = body;

    if (!backup || !backup.version || !backup.negocio) {
      return NextResponse.json(
        {
          error:
            'El archivo provisto no tiene un formato válido de backup de Pedidos by ROLΦ.',
        },
        { status: 400 }
      );
    }

    const { data: negocioDestino } = await adminSupabase
      .from('negocios')
      .select('id, nombre, slug')
      .eq('id', negocioId)
      .single();

    if (!negocioDestino) {
      return NextResponse.json({ error: 'Negocio destino no encontrado' }, { status: 404 });
    }

    const esClonacion =
      modo === 'clonar' ||
      (backup.negocio.id && backup.negocio.id !== negocioId);

    // MODO PREVISUALIZACIÓN: muestra lo que contiene el archivo y qué reemplaza en el negocio destino
    if (modo === 'preview') {
      const [
        { count: catActuales },
        { count: prodActuales },
        { count: ingActuales },
        { count: cadActuales },
        { count: pedActuales },
        { count: venActuales },
        { count: cajaActuales },
      ] = await Promise.all([
        adminSupabase
          .from('categorias')
          .select('*', { count: 'exact', head: true })
          .eq('negocio_id', negocioId),
        adminSupabase
          .from('productos')
          .select('*', { count: 'exact', head: true })
          .eq('negocio_id', negocioId),
        adminSupabase
          .from('ingredientes')
          .select('*', { count: 'exact', head: true })
          .eq('negocio_id', negocioId),
        adminSupabase
          .from('cadetes')
          .select('*', { count: 'exact', head: true })
          .eq('negocio_id', negocioId),
        adminSupabase
          .from('pedidos')
          .select('*', { count: 'exact', head: true })
          .eq('negocio_id', negocioId),
        adminSupabase
          .from('ventas')
          .select('*', { count: 'exact', head: true })
          .eq('negocio_id', negocioId),
        adminSupabase
          .from('cierres_caja')
          .select('*', { count: 'exact', head: true })
          .eq('negocio_id', negocioId),
      ]);

      return NextResponse.json({
        valid: true,
        version: backup.version,
        fecha_exportacion: backup.export_date,
        negocio_origen: backup.negocio.nombre,
        negocio_origen_id: backup.negocio.id || null,
        negocio_destino: negocioDestino.nombre,
        es_clonacion: Boolean(esClonacion),
        resumen: {
          categorias: backup.categorias?.length || 0,
          productos: backup.productos?.length || 0,
          ingredientes: backup.ingredientes?.length || 0,
          cadetes: backup.cadetes?.length || 0,
          pedidos: backup.pedidos?.length || 0,
          ventas: backup.ventas?.length || 0,
          cierres_caja: backup.cierres_caja?.length || 0,
        },
        estado_actual_destino: {
          categorias: catActuales || 0,
          productos: prodActuales || 0,
          ingredientes: ingActuales || 0,
          cadetes: cadActuales || 0,
          pedidos: pedActuales || 0,
          ventas: venActuales || 0,
          cierres_caja: cajaActuales || 0,
        },
      });
    }

    // MODO RESTAURACIÓN O CLONACIÓN EFECTIVA:
    // 1. Validar confirmación escribiendo el nombre del negocio destino
    if (
      confirmacion_nombre !== undefined &&
      confirmacion_nombre.trim() !== negocioDestino.nombre.trim()
    ) {
      return NextResponse.json(
        {
          error: `Para confirmar la restauración debés escribir exactamente el nombre del negocio ("${negocioDestino.nombre}").`,
        },
        { status: 400 }
      );
    }

    // 2. Validar contraseña del Súper Administrador
    const passCheck = await verifySuperAdminPassword(user.email || '', superadmin_password);
    if (!passCheck.valid) {
      return NextResponse.json({ error: passCheck.error }, { status: 403 });
    }

    // 3. GENERAR AUTOMÁTICAMENTE BACKUP DE SEGURIDAD DEL ESTADO ACTUAL ANTES DE RESTAURAR (Sección E)
    const backupSeguridadPrevio = await construirYGuardarBackupNegocio(
      adminSupabase,
      negocioId,
      {
        tipo: 'pre_restauracion',
        descripcion: `Backup automático previo a restaurar archivo de "${backup.negocio.nombre}" (v${backup.version})`,
        userId: user.id,
        userEmail: user.email,
        persistirEnTabla: true,
      }
    );

    // 4. Limpiar datos operativos actuales del negocio para que la restauración restablezca exactamente el estado del backup
    await adminSupabase.from('ventas').delete().eq('negocio_id', negocioId);
    await adminSupabase.from('pedido_items').delete().eq('negocio_id', negocioId);
    await adminSupabase.from('pedidos').delete().eq('negocio_id', negocioId);
    await adminSupabase.from('ingredientes').delete().eq('negocio_id', negocioId);
    await adminSupabase.from('productos').delete().eq('negocio_id', negocioId);
    await adminSupabase.from('categorias').delete().eq('negocio_id', negocioId);
    await adminSupabase.from('cadetes').delete().eq('negocio_id', negocioId);

    // 5. Restaurar configuración del negocio (preservando su id, nombre y slug en caso de clonación)
    const n = backup.negocio;
    const negocioUpdate: Record<string, unknown> = {
      color_primario: n.color_primario || '#F59E0B',
      color_secundario: n.color_secundario || '#18181B',
      telefono: n.telefono ?? null,
      whatsapp_numero: n.whatsapp_numero ?? null,
      horarios: n.horarios ?? null,
      mensaje_bienvenida: n.mensaje_bienvenida ?? null,
      mensaje_cierre: n.mensaje_cierre ?? null,
      updated_at: new Date().toISOString(),
    };

    if (n.logo_url !== undefined) negocioUpdate.logo_url = n.logo_url;
    if (n.banner_url !== undefined) negocioUpdate.banner_url = n.banner_url;
    if (n.slogan !== undefined) negocioUpdate.slogan = n.slogan;
    if (n.tipografia_id !== undefined) negocioUpdate.tipografia_id = n.tipografia_id;
    if (n.tema_catalogo !== undefined) negocioUpdate.tema_catalogo = n.tema_catalogo;
    if (n.estilo_bordes !== undefined) negocioUpdate.estilo_bordes = n.estilo_bordes;
    if (n.direccion_local !== undefined) negocioUpdate.direccion_local = n.direccion_local;
    if (n.abierto_manual !== undefined) negocioUpdate.abierto_manual = n.abierto_manual;
    if (n.modo_apertura !== undefined) negocioUpdate.modo_apertura = n.modo_apertura;
    if (n.horarios_semanales !== undefined)
      negocioUpdate.horarios_semanales = n.horarios_semanales;
    if (n.tiempo_preparacion_min !== undefined)
      negocioUpdate.tiempo_preparacion_min = n.tiempo_preparacion_min;
    if (n.momento_aviso_cadeteria !== undefined)
      negocioUpdate.momento_aviso_cadeteria = n.momento_aviso_cadeteria;
    if (n.minutos_antes_aviso !== undefined)
      negocioUpdate.minutos_antes_aviso = n.minutos_antes_aviso;
    if (n.avisar_cliente_en_camino !== undefined)
      negocioUpdate.avisar_cliente_en_camino = n.avisar_cliente_en_camino;
    if (n.plantillas_whatsapp !== undefined)
      negocioUpdate.plantillas_whatsapp = n.plantillas_whatsapp;

    await adminSupabase.from('negocios').update(negocioUpdate).eq('id', negocioId);

    // 6. Restaurar Categorías
    const catMap = new Map<string, string>();
    if (backup.categorias && Array.isArray(backup.categorias)) {
      for (const cat of backup.categorias) {
        const { data: newCat } = await adminSupabase
          .from('categorias')
          .insert({
            negocio_id: negocioId,
            nombre: cat.nombre,
            orden: cat.orden || 0,
          })
          .select('id')
          .single();

        if (newCat) catMap.set(cat.id, newCat.id);
      }
    }

    // 7. Restaurar Productos
    const prodMap = new Map<string, string>();
    if (backup.productos && Array.isArray(backup.productos)) {
      for (const prod of backup.productos) {
        const targetCatId = prod.categoria_id ? catMap.get(prod.categoria_id) || null : null;
        const { data: newProd } = await adminSupabase
          .from('productos')
          .insert({
            negocio_id: negocioId,
            categoria_id: targetCatId,
            nombre: prod.nombre,
            descripcion: prod.descripcion,
            precio_venta: prod.precio_venta,
            imagen_url: prod.imagen_url,
            receta: prod.receta,
            costo_total: prod.costo_total,
            visible_catalogo: prod.visible_catalogo !== false,
            orden: prod.orden || 0,
          })
          .select('id')
          .single();

        if (newProd) prodMap.set(prod.id, newProd.id);
      }
    }

    // 8. Restaurar Ingredientes
    if (backup.ingredientes && Array.isArray(backup.ingredientes)) {
      for (const ing of backup.ingredientes) {
        const targetProdId = prodMap.get(ing.producto_id);
        if (targetProdId) {
          await adminSupabase.from('ingredientes').insert({
            negocio_id: negocioId,
            producto_id: targetProdId,
            nombre: ing.nombre,
            cantidad: ing.cantidad,
            unidad: ing.unidad,
            costo_unitario: ing.costo_unitario,
          });
        }
      }
    }

    // 9. Restaurar Cadetes
    const cadeteMap = new Map<string, string>();
    if (backup.cadetes && Array.isArray(backup.cadetes)) {
      for (const cad of backup.cadetes) {
        const { data: newCad } = await adminSupabase
          .from('cadetes')
          .insert({
            negocio_id: negocioId,
            tipo: cad.tipo || 'externa',
            usuario_id: esClonacion ? null : cad.usuario_id || null,
            nombre: cad.nombre,
            telefono_whatsapp: cad.telefono_whatsapp || '',
            es_predeterminado: Boolean(cad.es_predeterminado),
            activo: cad.activo !== false,
          })
          .select('id')
          .single();

        if (newCad) cadeteMap.set(cad.id, newCad.id);
      }
    }

    // 10. Restaurar Pedidos, sus Ítems y Entregas con Ubicación (si no es clonación o si se restauran todos los datos)
    const pedidoMap = new Map<string, string>();
    if (backup.pedidos && Array.isArray(backup.pedidos)) {
      for (const ped of backup.pedidos) {
        const targetCadId = ped.cadete_id ? cadeteMap.get(ped.cadete_id) || null : null;
        const { data: newPed } = await adminSupabase
          .from('pedidos')
          .insert({
            negocio_id: negocioId,
            numero_pedido: ped.numero_pedido,
            origen: ped.origen || 'online',
            cliente_nombre: ped.cliente_nombre,
            cliente_telefono: ped.cliente_telefono,
            tipo_entrega: ped.tipo_entrega || 'retiro',
            direccion: ped.direccion || null,
            referencias_direccion: ped.referencias_direccion || null,
            observaciones: ped.observaciones || null,
            total: ped.total || 0,
            medio_pago: ped.medio_pago || null,
            estado_pago: ped.estado_pago || 'pendiente',
            monto_a_cobrar: ped.monto_a_cobrar ?? null,
            monto_cobrado_declarado: ped.monto_cobrado_declarado ?? null,
            estado: ped.estado || 'nuevo',
            cadete_id: targetCadId,
            aceptado_at: ped.aceptado_at || null,
            asignado_at: ped.asignado_at || null,
            retirado_at: ped.retirado_at || null,
            entregado_at: ped.entregado_at || null,
            entrega_lat: ped.entrega_lat ?? null,
            entrega_lng: ped.entrega_lng ?? null,
            entrega_precision_m: ped.entrega_precision_m ?? null,
            entregado_sin_ubicacion: Boolean(ped.entregado_sin_ubicacion),
            motivo_sin_ubicacion: ped.motivo_sin_ubicacion || null,
            created_at: ped.created_at || new Date().toISOString(),
          })
          .select('id')
          .single();

        if (newPed) {
          pedidoMap.set(ped.id, newPed.id);

          if (ped.items && Array.isArray(ped.items) && ped.items.length > 0) {
            const itemsInsert = ped.items.map(
              (it: {
                producto_id?: string | null;
                nombre_producto: string;
                precio_unitario: number;
                cantidad: number;
                subtotal: number;
                aclaraciones?: string | null;
              }) => ({
                pedido_id: newPed.id,
                negocio_id: negocioId,
                producto_id: it.producto_id ? prodMap.get(it.producto_id) || null : null,
                nombre_producto: it.nombre_producto,
                precio_unitario: it.precio_unitario,
                cantidad: it.cantidad,
                subtotal: it.subtotal,
                aclaraciones: it.aclaraciones || null,
              })
            );
            await adminSupabase.from('pedido_items').insert(itemsInsert);
          }
        }
      }
    }

    // 11. Restaurar Ventas
    if (backup.ventas && Array.isArray(backup.ventas)) {
      for (const v of backup.ventas) {
        const targetPedId = pedidoMap.get(v.pedido_id);
        if (targetPedId) {
          const targetCadId = v.cadete_id ? cadeteMap.get(v.cadete_id) || null : null;
          await adminSupabase.from('ventas').insert({
            negocio_id: negocioId,
            pedido_id: targetPedId,
            fecha_venta: v.fecha_venta || new Date().toISOString(),
            total: v.total || 0,
            costo_estimado: v.costo_estimado || 0,
            tiene_costos_cargados: Boolean(v.tiene_costos_cargados),
            medio_pago: v.medio_pago || null,
            origen: v.origen || 'online',
            tipo_entrega: v.tipo_entrega || 'retiro',
            cadete_id: targetCadId,
            tiempo_entrega_min: v.tiempo_entrega_min ?? null,
            anulada: Boolean(v.anulada),
            motivo_anulacion: v.motivo_anulacion || null,
            anulada_at: v.anulada_at || null,
          });
        }
      }
    }

    // 12. Restaurar Cierres de Caja (si no existen ya para esa fecha_cierre)
    if (backup.cierres_caja && Array.isArray(backup.cierres_caja)) {
      for (const cc of backup.cierres_caja) {
        const { data: existingCierre } = await adminSupabase
          .from('cierres_caja')
          .select('id')
          .eq('negocio_id', negocioId)
          .eq('fecha_cierre', cc.fecha_cierre)
          .maybeSingle();

        if (!existingCierre) {
          await adminSupabase.from('cierres_caja').insert({
            negocio_id: negocioId,
            cerrado_por_nombre: cc.cerrado_por_nombre || 'Backup Restaurado',
            fecha_referencia: cc.fecha_referencia,
            fecha_cierre: cc.fecha_cierre,
            total_vendido: cc.total_vendido || 0,
            total_efectivo_esperado: cc.total_efectivo_esperado || 0,
            total_transferencia: cc.total_transferencia || 0,
            total_mercadopago: cc.total_mercadopago || 0,
            efectivo_declarado_cadetes: cc.efectivo_declarado_cadetes || 0,
            efectivo_contado: cc.efectivo_contado || 0,
            diferencia_efectivo: cc.diferencia_efectivo || 0,
            cantidad_pedidos: cc.cantidad_pedidos || 0,
            cantidad_anulaciones: cc.cantidad_anulaciones || 0,
            total_anulaciones: cc.total_anulaciones || 0,
            observaciones: cc.observaciones || null,
            resumen_json: cc.resumen_json || {},
          });
        }
      }
    }

    await adminSupabase.from('auditoria_accesos').insert({
      usuario_id: user.id,
      email: user.email,
      evento: esClonacion ? 'superadmin_clone_backup_v2' : 'superadmin_restore_backup_v2',
      metadata: {
        negocio_id: negocioId,
        negocio_destino: negocioDestino.nombre,
        negocio_origen: backup.negocio.nombre,
        version: backup.version,
        backup_seguridad_previo_id: backupSeguridadPrevio.backupRecordId,
      },
    });

    return NextResponse.json({
      success: true,
      mensaje: esClonacion
        ? `Backup de "${backup.negocio.nombre}" clonado exitosamente en "${negocioDestino.nombre}". Se guardó un backup de seguridad del estado anterior.`
        : `Backup (v${backup.version}) restaurado exitosamente en "${negocioDestino.nombre}". Se generó automáticamente un backup de seguridad del estado anterior.`,
      backup_seguridad_previo_id: backupSeguridadPrevio.backupRecordId,
      backup_seguridad_previo_payload: backupSeguridadPrevio.backupPayload,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
