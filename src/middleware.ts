import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return supabaseResponse;
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Rutas de SuperAdmin
  if (pathname.startsWith('/superadmin') && pathname !== '/superadmin/login') {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = '/superadmin/login';
      return NextResponse.redirect(url);
    }

    // Verificar rol superadmin
    const { data: profile } = await supabase
      .from('usuarios')
      .select('role, activo')
      .eq('id', user.id)
      .single();

    if (!profile || profile.role !== 'superadmin' || !profile.activo) {
      const url = request.nextUrl.clone();
      url.pathname = '/superadmin/login';
      return NextResponse.redirect(url);
    }
  }

  // Rutas del panel de negocio
  if (pathname.startsWith('/admin')) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('redirect', pathname);
      return NextResponse.redirect(url);
    }

    // Consultar perfil
    const { data: profile } = await supabase
      .from('usuarios')
      .select('role, must_change_password, activo, negocio_id')
      .eq('id', user.id)
      .single();

    if (!profile || !profile.activo || (profile.role !== 'admin' && profile.role !== 'vendedor')) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }

    // Forzar cambio de contraseña si must_change_password está activo
    if (profile.must_change_password) {
      const url = request.nextUrl.clone();
      url.pathname = '/cambiar-clave';
      return NextResponse.redirect(url);
    }
  }

  // Si está en /cambiar-clave pero no necesita cambiar contraseña o no está logueado
  if (pathname === '/cambiar-clave') {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }

    const { data: profile } = await supabase
      .from('usuarios')
      .select('must_change_password, role')
      .eq('id', user.id)
      .single();

    if (!profile?.must_change_password) {
      const url = request.nextUrl.clone();
      url.pathname = profile?.role === 'superadmin' ? '/superadmin' : '/admin';
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
