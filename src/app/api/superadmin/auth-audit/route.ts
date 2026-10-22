import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';

const loginAttemptsMap = new Map<string, { count: number; lockUntil: number }>();

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for')?.split(',')[0] || '127.0.0.1';
    const userAgent = req.headers.get('user-agent') || 'unknown';
    const body = await req.json();
    const { accion, email, usuario_id } = body;

    const key = `${ip}:${(email || '').toLowerCase()}`;
    const now = Date.now();
    const current = loginAttemptsMap.get(key) || { count: 0, lockUntil: 0 };

    if (accion === 'check_lock') {
      if (current.lockUntil > now) {
        const segundos = Math.ceil((current.lockUntil - now) / 1000);
        return NextResponse.json(
          {
            locked: true,
            segundos_restantes: segundos,
            error: `Demasiados intentos fallidos. Acceso bloqueado temporalmente por ${segundos} segundos.`,
          },
          { status: 429 }
        );
      }
      return NextResponse.json({ locked: false });
    }

    const adminSupabase = createAdminClient();

    if (accion === 'failed') {
      const nextCount = current.count + 1;
      const lockUntil = nextCount >= 5 ? now + 90 * 1000 : 0; // 90s de bloqueo
      loginAttemptsMap.set(key, { count: nextCount, lockUntil });

      await adminSupabase.from('auditoria_accesos').insert({
        email: email || 'desconocido',
        ip_address: ip,
        user_agent: userAgent,
        evento: 'superadmin_login_failed',
        metadata: {
          intentos_acumulados: nextCount,
          bloqueado: nextCount >= 5,
        },
      });

      return NextResponse.json({
        locked: nextCount >= 5,
        intentos: nextCount,
        segundos_restantes: nextCount >= 5 ? 90 : 0,
      });
    }

    if (accion === 'success') {
      loginAttemptsMap.delete(key);

      await adminSupabase.from('auditoria_accesos').insert({
        usuario_id: usuario_id || null,
        email: email || null,
        ip_address: ip,
        user_agent: userAgent,
        evento: 'superadmin_login_success',
        metadata: { timestamp: new Date().toISOString() },
      });

      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ ok: true });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Error interno';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
