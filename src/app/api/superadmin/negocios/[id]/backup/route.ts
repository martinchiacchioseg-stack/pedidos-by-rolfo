import { NextRequest, NextResponse } from 'next/server';
import { verifySuperAdmin } from '@/lib/auth-server';

// Versión del esquema de backup
const BACKUP_SCHEMA_VERSION = '1.0.0';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifySuperAdmin();
  if (!auth.authorized) return auth.response;

  const { adminSupabase } = auth;
  const { id: negocioId } = await params;

  try {
    // 1. Obtener datos del negocio
    const { data: negocio, error: negError } = await adminSupabase
      .from('negocios')
      .select('*')
      .eq('id', negocioId)
      .single();

    if (negError || !negocio) {
      return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 });
    }

    // 2. Obtener categorías
    const { data: categorias } = await adminSupabase
      .from('categorias')
      .select('*')
      .eq('negocio_id', negocioId)
      .order('orden');

    // 3. Obtener productos
    const { data: productos } = await adminSupabase
      .from('productos')
      .select('*')
      .eq('negocio_id', negocioId)
      .order('orden');

    // 4. Obtener ingredientes
    const { data: ingredientes } = await adminSupabase
      .from('ingredientes')
      .select('*')
      .eq('negocio_id', negocioId);

    // 5. Obtener empleados (sin contraseñas)
    const { data: usuarios } = await adminSupabase
      .from('usuarios')
      .select('email, nombre, role, activo')
      .eq('negocio_id', negocioId);

    // 6. Obtener pedidos y sus items
    const { data: pedidos } = await adminSupabase
      .from('pedidos')
      .select('*, items:pedido_items(*)')
      .eq('negocio_id', negocioId)
      .order('created_at', { ascending: false });

    const backupPayload = {
      app: 'Pedidos by ROLΦ',
      version: BACKUP_SCHEMA_VERSION,
      export_date: new Date().toISOString(),
      negocio: {
        id: negocio.id,
        nombre: negocio.nombre,
        slug: negocio.slug,
        logo_url: negocio.logo_url,
        color_primario: negocio.color_primario,
        color_secundario: negocio.color_secundario,
        telefono: negocio.telefono,
        whatsapp_numero: negocio.whatsapp_numero,
        horarios: negocio.horarios,
        mensaje_bienvenida: negocio.mensaje_bienvenida,
        mensaje_cierre: negocio.mensaje_cierre,
      },
      estadisticas: {
        categorias_count: categorias?.length || 0,
        productos_count: productos?.length || 0,
        ingredientes_count: ingredientes?.length || 0,
        usuarios_count: usuarios?.length || 0,
        pedidos_count: pedidos?.length || 0,
      },
      categorias: categorias || [],
      productos: productos || [],
      ingredientes: ingredientes || [],
      usuarios: usuarios || [],
      pedidos: pedidos || [],
    };

    // Auditoría
    await adminSupabase.from('auditoria_accesos').insert({
      usuario_id: auth.user.id,
      email: auth.user.email,
      evento: 'superadmin_export_backup',
      metadata: { negocio_id: negocioId, items_count: backupPayload.estadisticas },
    });

    return NextResponse.json(backupPayload, {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="backup-${negocio.slug}-${new Date().toISOString().slice(0, 10)}.json"`,
      },
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// RESTAURAR BACKUP
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await verifySuperAdmin();
  if (!auth.authorized) return auth.response;

  const { adminSupabase } = auth;
  const { id: negocioId } = await params;

  try {
    const body = await req.json();
    const { backup, modo } = body; // modo: 'preview' | 'restore'

    if (!backup || !backup.version || !backup.negocio) {
      return NextResponse.json(
        { error: 'El archivo provisto no tiene un formato válido de backup de Pedidos by ROLΦ.' },
        { status: 400 }
      );
    }

    // Modo Previsualización (devuelve resumen de lo que se va a restaurar)
    if (modo === 'preview') {
      return NextResponse.json({
        valid: true,
        version: backup.version,
        fecha_exportacion: backup.export_date,
        negocio_origen: backup.negocio.nombre,
        resumen: {
          categorias: backup.categorias?.length || 0,
          productos: backup.productos?.length || 0,
          ingredientes: backup.ingredientes?.length || 0,
          pedidos: backup.pedidos?.length || 0,
        },
      });
    }

    // Modo Restauración Efectiva:
    // 1. Restaurar configuración de negocio
    await adminSupabase
      .from('negocios')
      .update({
        color_primario: backup.negocio.color_primario || '#E11D48',
        color_secundario: backup.negocio.color_secundario || '#1E293B',
        telefono: backup.negocio.telefono,
        whatsapp_numero: backup.negocio.whatsapp_numero,
        horarios: backup.negocio.horarios,
        mensaje_bienvenida: backup.negocio.mensaje_bienvenida,
        mensaje_cierre: backup.negocio.mensaje_cierre,
        updated_at: new Date().toISOString(),
      })
      .eq('id', negocioId);

    // 2. Mapear categorías
    const catMap = new Map<string, string>(); // oldId -> newId
    if (backup.categorias && Array.isArray(backup.categorias)) {
      for (const cat of backup.categorias) {
        const { data: existingCat } = await adminSupabase
          .from('categorias')
          .select('id')
          .eq('negocio_id', negocioId)
          .eq('nombre', cat.nombre)
          .maybeSingle();

        if (existingCat) {
          catMap.set(cat.id, existingCat.id);
        } else {
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
    }

    // 3. Mapear y restaurar productos
    const prodMap = new Map<string, string>(); // oldProdId -> newProdId
    if (backup.productos && Array.isArray(backup.productos)) {
      for (const prod of backup.productos) {
        const targetCatId = prod.categoria_id ? catMap.get(prod.categoria_id) : null;

        const { data: existingProd } = await adminSupabase
          .from('productos')
          .select('id')
          .eq('negocio_id', negocioId)
          .eq('nombre', prod.nombre)
          .maybeSingle();

        if (existingProd) {
          await adminSupabase
            .from('productos')
            .update({
              descripcion: prod.descripcion,
              precio_venta: prod.precio_venta,
              imagen_url: prod.imagen_url,
              receta: prod.receta,
              costo_total: prod.costo_total,
              visible_catalogo: prod.visible_catalogo,
              categoria_id: targetCatId,
            })
            .eq('id', existingProd.id);
          prodMap.set(prod.id, existingProd.id);
        } else {
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
              visible_catalogo: prod.visible_catalogo,
              orden: prod.orden || 0,
            })
            .select('id')
            .single();

          if (newProd) prodMap.set(prod.id, newProd.id);
        }
      }
    }

    // 4. Restaurar ingredientes
    if (backup.ingredientes && Array.isArray(backup.ingredientes)) {
      for (const ing of backup.ingredientes) {
        const targetProdId = prodMap.get(ing.producto_id);
        if (targetProdId) {
          const { data: existingIng } = await adminSupabase
            .from('ingredientes')
            .select('id')
            .eq('producto_id', targetProdId)
            .eq('nombre', ing.nombre)
            .maybeSingle();

          if (!existingIng) {
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
    }

    // Auditoría
    await adminSupabase.from('auditoria_accesos').insert({
      usuario_id: auth.user.id,
      email: auth.user.email,
      evento: 'superadmin_restore_backup',
      metadata: { negocio_id: negocioId, version: backup.version },
    });

    return NextResponse.json({
      success: true,
      mensaje: 'Backup restaurado exitosamente en el negocio.',
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
