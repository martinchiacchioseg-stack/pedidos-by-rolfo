import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabaseUrl =
    process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://kwhyztqjoweegfzomyon.supabase.co';
  const supabaseKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_rJ84YXDuauyms-RpkwplPw_gHI98inJ';

  if (!supabaseUrl || !supabaseKey) {
    return supabaseResponse;
  }

  const supabase = createServerClient(supabaseUrl, supabaseKey, {
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
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // 1. Rutas de SuperAdmin
  if (pathname.startsWith('/superadmin') && pathname !== '/superadmin/login') {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = '/superadmin/login';
      return NextResponse.redirect(url);
    }

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

  // 2. Rutas del panel de negocio (/admin)
  if (pathname.startsWith('/admin')) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('redirect', pathname);
      return NextResponse.redirect(url);
    }

    const { data: profile } = await supabase
      .from('usuarios')
      .select('role, must_change_password, activo, negocio_id')
      .eq('id', user.id)
      .single();

    if (!profile || !profile.activo) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }

    if (profile.must_change_password) {
      const url = request.nextUrl.clone();
      url.pathname = '/cambiar-clave';
      return NextResponse.redirect(url);
    }

    // Si es cadete, redirigir exclusivamente a su vista /cadete
    if (profile.role === 'cadete') {
      const url = request.nextUrl.clone();
      url.pathname = '/cadete';
      return NextResponse.redirect(url);
    }

    if (profile.role !== 'admin' && profile.role !== 'vendedor') {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }

    // Rutas exclusivas de administrador (bloqueadas para vendedor)
    const adminOnlyPaths = [
      '/admin/reportes',
      '/admin/caja',
      '/admin/cadeteria',
      '/admin/empleados',
      '/admin/configuracion',
    ];
    if (
      profile.role === 'vendedor' &&
      adminOnlyPaths.some((p) => pathname.startsWith(p))
    ) {
      const url = request.nextUrl.clone();
      url.pathname = '/admin';
      return NextResponse.redirect(url);
    }
  }

  // 3. Rutas exclusivas de la App del Cadete (/cadete)
  if (pathname.startsWith('/cadete')) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('redirect', pathname);
      return NextResponse.redirect(url);
    }

    const { data: profile } = await supabase
      .from('usuarios')
      .select('role, must_change_password, activo')
      .eq('id', user.id)
      .single();

    if (!profile || !profile.activo) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }

    if (profile.must_change_password) {
      const url = request.nextUrl.clone();
      url.pathname = '/cambiar-clave';
      return NextResponse.redirect(url);
    }

    if (profile.role !== 'cadete' && profile.role !== 'admin' && profile.role !== 'superadmin') {
      const url = request.nextUrl.clone();
      url.pathname = '/admin';
      return NextResponse.redirect(url);
    }
  }

  // 4. Pantalla de cambio obligatorio de contraseña (/cambiar-clave)
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
      if (profile?.role === 'superadmin') url.pathname = '/superadmin';
      else if (profile?.role === 'cadete') url.pathname = '/cadete';
      else url.pathname = '/admin';
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
