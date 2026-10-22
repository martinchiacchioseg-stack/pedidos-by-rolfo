import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Cargar variables de entorno desde .env.local o .env
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const superadminEmail = process.env.SUPERADMIN_EMAIL || 'martinchiacchio.seg@gmail.com';
const superadminPassword = process.env.SUPERADMIN_PASSWORD || 'Chiacchio@1938';

if (!supabaseUrl || !serviceRoleKey) {
  console.error('❌ Error: Variables NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY son obligatorias.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function runSeed() {
  console.log('🚀 Iniciando Seed completo del Sistema "Pedidos by ROLΦ"...');

  // 1. PLANES DE SUSCRIPCIÓN
  console.log('📦 Configurando planes de suscripción...');
  const planesData = [
    {
      nombre: 'Plan Mensual',
      duracion_dias: 30,
      precio: 15000,
      descripcion: 'Acceso completo al menú digital, pedidos ilimitados por WhatsApp y panel de control por 30 días.',
      activo: true,
    },
    {
      nombre: 'Plan Trimestral',
      duracion_dias: 90,
      precio: 40000,
      descripcion: 'Acceso trimestral con 10% de descuento. Soporte prioritario y backup automatizado.',
      activo: true,
    },
    {
      nombre: 'Plan Anual',
      duracion_dias: 365,
      precio: 120000,
      descripcion: 'Acceso anual con 33% de descuento. Máximo rendimiento y actualización continua.',
      activo: true,
    },
  ];

  for (const plan of planesData) {
    const { data: existingPlan } = await supabase
      .from('planes')
      .select('id')
      .eq('nombre', plan.nombre)
      .maybeSingle();

    if (!existingPlan) {
      await supabase.from('planes').insert(plan);
      console.log(`  ✓ Plan creado: ${plan.nombre}`);
    } else {
      console.log(`  - Plan ya existe: ${plan.nombre}`);
    }
  }

  // 2. CREAR O VERIFICAR SÚPER ADMINISTRADOR (OCULTO)
  console.log(`🛡️ Creando o verificando Súper Administrador (${superadminEmail})...`);
  const { data: userList } = await supabase.auth.admin.listUsers();
  const existingUser = userList?.users?.find((u) => u.email === superadminEmail);

  let superadminId = existingUser?.id;

  if (!existingUser) {
    const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
      email: superadminEmail,
      password: superadminPassword,
      email_confirm: true,
      user_metadata: { role: 'superadmin', nombre: 'Súper Administrador' },
    });

    if (createError) {
      console.error('❌ Error creando superadmin en Auth:', createError.message);
    } else if (newUser?.user) {
      superadminId = newUser.user.id;
      console.log('  ✓ Usuario SuperAdmin creado en Supabase Auth.');
    }
  } else {
    await supabase.auth.admin.updateUserById(existingUser.id, {
      password: superadminPassword,
      email_confirm: true,
    });
    console.log('  ✓ Contraseña de SuperAdmin actualizada.');
  }

  if (superadminId) {
    await supabase.from('usuarios').upsert({
      id: superadminId,
      email: superadminEmail,
      nombre: 'Súper Administrador',
      role: 'superadmin',
      must_change_password: false,
      activo: true,
      negocio_id: null,
      updated_at: new Date().toISOString(),
    });
    console.log('  ✓ Perfil de SuperAdmin confirmado en tabla `usuarios`.');
  }

  // 3. NEGOCIO DEMO: "ROLΦ Pizzas & Burgers"
  console.log('🍕🍔 Creando negocio demo: "ROLΦ Pizzas & Burgers"...');
  const vencimiento30Dias = new Date();
  vencimiento30Dias.setDate(vencimiento30Dias.getDate() + 45);

  const { data: planMensual } = await supabase
    .from('planes')
    .select('id')
    .eq('nombre', 'Plan Mensual')
    .single();

  const negocioData = {
    nombre: 'ROLΦ Pizzas & Burgers',
    slug: 'rolfo-pizzas-burgers',
    logo_url: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=400&auto=format&fit=crop&q=80',
    banner_url: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=1200&auto=format&fit=crop&q=80',
    slogan: 'Masa madre al horno de barro & Smash Burgers artesanales',
    color_primario: '#F59E0B', // Ámbar cálido gastronómico
    color_secundario: '#09090B', // Carbón profundo
    tipografia_id: 'bold',
    telefono: '11 5555-1234',
    whatsapp_numero: '5491155551234', // Número de WhatsApp de prueba
    direccion_local: 'Av. Santa Fe 3200, Palermo, CABA',
    abierto_manual: true,
    modo_apertura: 'manual',
    tiempo_preparacion_min: 30,
    momento_aviso_cadeteria: 'minutos_antes',
    minutos_antes_aviso: 10,
    avisar_cliente_en_camino: true,
    horarios: {
      dias: 'Martes a Domingo',
      apertura: '19:30',
      cierre: '00:30',
    },
    mensaje_bienvenida: '¡Bienvenido a ROLΦ Pizzas & Burgers! Masa madre a la piedra, hamburguesas smash y cerveza artesanal bien fría. Hacé tu pedido y te lo enviamos volando.',
    mensaje_cierre: '¡Gracias por elegirnos! Tu pedido ya está en preparación.',
    plan_id: planMensual?.id || null,
    fecha_vencimiento: vencimiento30Dias.toISOString(),
    activo: true,
  };

  let negocioId: string;
  const { data: existingNegocio } = await supabase
    .from('negocios')
    .select('id')
    .eq('slug', negocioData.slug)
    .maybeSingle();

  if (!existingNegocio) {
    const { data: nuevoNegocio, error: negError } = await supabase
      .from('negocios')
      .insert(negocioData)
      .select('id')
      .single();

    if (negError) throw new Error(negError.message);
    negocioId = nuevoNegocio.id;
    console.log(`  ✓ Negocio creado con ID: ${negocioId}`);
  } else {
    negocioId = existingNegocio.id;
    // Asegurar datos actualizados
    await supabase.from('negocios').update(negocioData).eq('id', negocioId);
    console.log(`  ✓ Negocio existente actualizado: ${negocioId}`);
  }

  // 4. USUARIO ADMINISTRADOR DEL NEGOCIO
  const adminDemoEmail = 'admin@rolfopizzas.com';
  const adminDemoPass = 'Pizzas@2026';
  console.log(`👤 Creando Administrador del negocio (${adminDemoEmail})...`);

  const existingAdmin = userList?.users?.find((u) => u.email === adminDemoEmail);
  let adminId = existingAdmin?.id;

  if (!existingAdmin) {
    const { data: newAdminUser } = await supabase.auth.admin.createUser({
      email: adminDemoEmail,
      password: adminDemoPass,
      email_confirm: true,
      user_metadata: { role: 'admin', nombre: 'Admin Pizzas & Burgers' },
    });
    if (newAdminUser?.user) adminId = newAdminUser.user.id;
  }

  if (adminId) {
    await supabase.from('usuarios').upsert({
      id: adminId,
      email: adminDemoEmail,
      nombre: 'Administrador Demo',
      role: 'admin',
      negocio_id: negocioId,
      must_change_password: true,
      activo: true,
      updated_at: new Date().toISOString(),
    });
    console.log('  ✓ Administrador vinculado con must_change_password = true');
  }

  // 5. CATEGORIAS DE PRODUCTOS
  console.log('📑 Creando categorías de Pizzas, Hamburguesas, Acompañamientos y Bebidas...');
  const categorias = [
    { nombre: 'Pizzas Artesanales a la Piedra', orden: 1 },
    { nombre: 'Hamburguesas Gourmet', orden: 2 },
    { nombre: 'Papas & Acompañamientos', orden: 3 },
    { nombre: 'Bebidas & Cervezas', orden: 4 },
  ];

  const catMap = new Map<string, string>();
  for (const cat of categorias) {
    let catId: string;
    const { data: existingCat } = await supabase
      .from('categorias')
      .select('id')
      .eq('negocio_id', negocioId)
      .eq('nombre', cat.nombre)
      .maybeSingle();

    if (!existingCat) {
      const { data: newCat } = await supabase
        .from('categorias')
        .insert({
          negocio_id: negocioId,
          nombre: cat.nombre,
          orden: cat.orden,
        })
        .select('id')
        .single();
      catId = newCat!.id;
    } else {
      catId = existingCat.id;
    }
    catMap.set(cat.nombre, catId);
  }

  // 6. PRODUCTOS CON FOTOS REALES, RECETAS E INGREDIENTES
  console.log('🍕🍔 Cargando catálogo completo con fotografías reales en alta resolución...');
  const productos = [
    // PIZZAS
    {
      categoria: 'Pizzas Artesanales a la Piedra',
      nombre: 'Muzzarella Clásica ROLΦ',
      descripcion: 'Masa madre leudada 48 hs a la piedra, salsa de tomates perita seleccionados, 400g de muzzarella fundida, aceitunas negras griegas y orégano fresco.',
      precio_venta: 9500,
      imagen_url: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=600&auto=format&fit=crop&q=80',
      receta: '1. Estirar bollo de masa madre a 35cm.\n2. Esparcir salsa de tomate casera con oliva.\n3. Hornear a 350°C por 3 minutos.\n4. Colocar 400g de muzzarella en cubos y dorar hasta gratinar.',
      visible_catalogo: true,
      orden: 1,
      ingredientes: [
        { nombre: 'Bollo Masa Madre (320g)', cantidad: 1, unidad: 'unidades', costo_unitario: 800 },
        { nombre: 'Salsa de Tomates San Marzano', cantidad: 120, unidad: 'gr', costo_unitario: 450 },
        { nombre: 'Queso Muzzarella Especial', cantidad: 400, unidad: 'gr', costo_unitario: 2200 },
        { nombre: 'Aceitunas Negras y Orégano', cantidad: 40, unidad: 'gr', costo_unitario: 350 },
      ],
    },
    {
      categoria: 'Pizzas Artesanales a la Piedra',
      nombre: 'Pizza Napolitana Especial',
      descripcion: 'Nuestra muzzarella a la piedra cubierta con rodajas finas de tomates frescos madurados al sol, ajo confitado, albahaca morada y toque de oliva extra virgen.',
      precio_venta: 10800,
      imagen_url: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=600&auto=format&fit=crop&q=80',
      receta: 'Colocar rodajas de tomate sobre la muzzarella derretida, esparcir emulsión de ajo y hojas de albahaca fresca antes de servir.',
      visible_catalogo: true,
      orden: 2,
      ingredientes: [
        { nombre: 'Bollo Masa Madre', cantidad: 1, unidad: 'unidades', costo_unitario: 800 },
        { nombre: 'Muzzarella', cantidad: 350, unidad: 'gr', costo_unitario: 1950 },
        { nombre: 'Tomates Frescos Seleccionados', cantidad: 200, unidad: 'gr', costo_unitario: 500 },
        { nombre: 'Ajo Confitado y Albahaca', cantidad: 30, unidad: 'gr', costo_unitario: 300 },
      ],
    },
    {
      categoria: 'Pizzas Artesanales a la Piedra',
      nombre: 'Fugazzeta Rellena Suprema',
      descripcion: 'Doble masa a la piedra rellena con 500g de muzzarella hilada, cubierta con abundante cebolla dorada al orégano y queso parmesano gratinado.',
      precio_venta: 12500,
      imagen_url: 'https://images.unsplash.com/photo-1593560708920-61dd98c46a4e?w=600&auto=format&fit=crop&q=80',
      receta: '1. Colocar masa base y rellenar con muzzarella y toque de jamón.\n2. Tapar con segunda masa fina.\n3. Cubrir con cebolla cortada en pluma marinada en oliva y parmesano.\n4. Cocinar a fuego fuerte 7 minutos.',
      visible_catalogo: true,
      orden: 3,
      ingredientes: [
        { nombre: 'Doble Masa Madre', cantidad: 2, unidad: 'unidades', costo_unitario: 1400 },
        { nombre: 'Muzzarella Relleno', cantidad: 500, unidad: 'gr', costo_unitario: 2750 },
        { nombre: 'Cebolla Pluma Marinada', cantidad: 300, unidad: 'gr', costo_unitario: 600 },
        { nombre: 'Queso Parmesano Gratinado', cantidad: 50, unidad: 'gr', costo_unitario: 650 },
      ],
    },
    {
      categoria: 'Pizzas Artesanales a la Piedra',
      nombre: 'Pizza Calabresa & Pimientos',
      descripcion: 'Muzzarella fundida, rodajas crocantes de longaniza calabresa casera, pimientos morrones asados a la leña y ají molido.',
      precio_venta: 11500,
      imagen_url: 'https://images.unsplash.com/photo-1534308983496-4fabb1a015ee?w=600&auto=format&fit=crop&q=80',
      receta: 'Disponer longaniza fina y pimientos asados en tiras, hornear hasta que la longaniza suelte sus aceites aromáticos.',
      visible_catalogo: true,
      orden: 4,
      ingredientes: [
        { nombre: 'Bollo Masa Madre', cantidad: 1, unidad: 'unidades', costo_unitario: 800 },
        { nombre: 'Muzzarella', cantidad: 350, unidad: 'gr', costo_unitario: 1950 },
        { nombre: 'Longaniza Calabresa Artesanal', cantidad: 120, unidad: 'gr', costo_unitario: 1200 },
        { nombre: 'Morrones Asados al Fuego', cantidad: 80, unidad: 'gr', costo_unitario: 450 },
      ],
    },

    // HAMBURGUESAS
    {
      categoria: 'Hamburguesas Gourmet',
      nombre: 'Doble Cheese ROLΦ',
      descripcion: 'Doble medallón de 120g de blend especial (roast beef + tapa de asado), cuádruple queso cheddar fundido, cebolla crispy y salsa secreta en pan brioche.',
      precio_venta: 8900,
      imagen_url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&auto=format&fit=crop&q=80',
      receta: '1. Tostar pan brioche con manteca.\n2. Sellar medallones 2 minutos a 240°C.\n3. Salpimentar y colocar doble cheddar por medallón.\n4. Armar con cebolla crispy y salsa base.',
      visible_catalogo: true,
      orden: 5,
      ingredientes: [
        { nombre: 'Pan Brioche Artesanal', cantidad: 1, unidad: 'unidades', costo_unitario: 450 },
        { nombre: 'Blend Vacuno Premium (240g)', cantidad: 240, unidad: 'gr', costo_unitario: 1800 },
        { nombre: 'Cheddar Milkaut (4 fetas)', cantidad: 80, unidad: 'gr', costo_unitario: 650 },
        { nombre: 'Salsa Secreta ROLΦ', cantidad: 30, unidad: 'ml', costo_unitario: 200 },
        { nombre: 'Cebolla Crispy', cantidad: 20, unidad: 'gr', costo_unitario: 150 },
      ],
    },
    {
      categoria: 'Hamburguesas Gourmet',
      nombre: 'Bacon Monster XL',
      descripcion: 'Doble carne smashed caramelizada, panceta ahumada crujiente en tiras abundantes, provolone fundido y salsa barbacoa casera al bourbon.',
      precio_venta: 9900,
      imagen_url: 'https://images.unsplash.com/photo-1594212699903-ec8a3eca50f5?w=600&auto=format&fit=crop&q=80',
      receta: 'Smashear medallones finos contra la plancha muy caliente, tostar panceta hasta crocante absoluto y fundir con provolone.',
      visible_catalogo: true,
      orden: 6,
      ingredientes: [
        { nombre: 'Pan de Papa Suave', cantidad: 1, unidad: 'unidades', costo_unitario: 500 },
        { nombre: 'Carne Smash (2 x 110g)', cantidad: 220, unidad: 'gr', costo_unitario: 1650 },
        { nombre: 'Panceta Ahumada Gruesa', cantidad: 70, unidad: 'gr', costo_unitario: 950 },
        { nombre: 'Queso Provolone Estacionado', cantidad: 60, unidad: 'gr', costo_unitario: 650 },
        { nombre: 'Barbacoa Bourbon Casera', cantidad: 35, unidad: 'ml', costo_unitario: 250 },
      ],
    },
    {
      categoria: 'Hamburguesas Gourmet',
      nombre: 'Crispy Chicken Master',
      descripcion: 'Suprema de pollo marinada y empanada en copos crocantes, lechuga capuchina fresca, tomate y mayonesa suave de hierbas en pan de sésamo.',
      precio_venta: 8500,
      imagen_url: 'https://images.unsplash.com/photo-1625813506062-0aeb1d7a094b?w=600&auto=format&fit=crop&q=80',
      receta: 'Marinar pollo en pimentón y suero, freír a 175°C durante 6 minutos hasta dorado perfecto.',
      visible_catalogo: true,
      orden: 7,
      ingredientes: [
        { nombre: 'Pan de Sésamo', cantidad: 1, unidad: 'unidades', costo_unitario: 420 },
        { nombre: 'Pechuga Marinada (180g)', cantidad: 180, unidad: 'gr', costo_unitario: 1100 },
        { nombre: 'Rebozado Crocante Especial', cantidad: 50, unidad: 'gr', costo_unitario: 250 },
        { nombre: 'Lechuga y Tomate', cantidad: 50, unidad: 'gr', costo_unitario: 200 },
        { nombre: 'Mayonesa de Hierbas', cantidad: 30, unidad: 'ml', costo_unitario: 180 },
      ],
    },

    // ACOMPAÑAMIENTOS
    {
      categoria: 'Papas & Acompañamientos',
      nombre: 'Papas Cheddar & Bacon Bits',
      descripcion: 'Porción abundante de papas rústicas recién fritas, bañadas en salsa cheddar caliente artesanal y lluvia de panceta crocante.',
      precio_venta: 5800,
      imagen_url: 'https://images.unsplash.com/photo-1585109649139-366815a0d713?w=600&auto=format&fit=crop&q=80',
      receta: 'Doble cocción de papas y salseado inmediato con cheddar tibio a 75°C.',
      visible_catalogo: true,
      orden: 8,
      ingredientes: [
        { nombre: 'Papas Seleccionadas', cantidad: 350, unidad: 'gr', costo_unitario: 650 },
        { nombre: 'Crema Cheddar Artesanal', cantidad: 120, unidad: 'gr', costo_unitario: 850 },
        { nombre: 'Bacon Bits Crocantes', cantidad: 40, unidad: 'gr', costo_unitario: 600 },
      ],
    },
    {
      categoria: 'Papas & Acompañamientos',
      nombre: 'Aros de Cebolla Crocantes',
      descripcion: 'Aros gruesos de cebolla dulce rebozados en panko crujiente con dip de salsa tártara casera.',
      precio_venta: 4800,
      imagen_url: 'https://images.unsplash.com/photo-1639024471285-0afc38317765?w=600&auto=format&fit=crop&q=80',
      receta: 'Freír por 3 minutos a 180°C y escurrir en rejilla antes de empaquetar.',
      visible_catalogo: true,
      orden: 9,
      ingredientes: [
        { nombre: 'Aros de Cebolla Morada', cantidad: 250, unidad: 'gr', costo_unitario: 600 },
        { nombre: 'Dip Salsa Tártara', cantidad: 50, unidad: 'ml', costo_unitario: 300 },
      ],
    },

    // BEBIDAS
    {
      categoria: 'Bebidas & Cervezas',
      nombre: 'Cerveza Artesanal IPA 473ml',
      descripcion: 'Lata helada de cerveza IPA americana con lúpulos cítricos y amargor refrescante.',
      precio_venta: 3900,
      imagen_url: 'https://images.unsplash.com/photo-1608270586620-248524c67de9?w=600&auto=format&fit=crop&q=80',
      receta: null,
      visible_catalogo: true,
      orden: 10,
      ingredientes: [
        { nombre: 'Lata IPA 473ml Cervecería Local', cantidad: 1, unidad: 'unidades', costo_unitario: 1800 },
      ],
    },
    {
      categoria: 'Bebidas & Cervezas',
      nombre: 'Gaseosa Línea Coca-Cola 500ml',
      descripcion: 'Botella individual fría (Coca-Cola Clásica, Zero o Sprite según elección).',
      precio_venta: 2400,
      imagen_url: 'https://images.unsplash.com/photo-1622483767028-3f66f32aef97?w=600&auto=format&fit=crop&q=80',
      receta: null,
      visible_catalogo: true,
      orden: 11,
      ingredientes: [
        { nombre: 'Botella Coca-Cola 500ml', cantidad: 1, unidad: 'unidades', costo_unitario: 950 },
      ],
    },
  ];

  for (const prod of productos) {
    const catId = catMap.get(prod.categoria) || null;
    const costoTotal = prod.ingredientes.reduce((acc, ing) => acc + (ing.costo_unitario || 0), 0);

    const { data: existingProd } = await supabase
      .from('productos')
      .select('id')
      .eq('negocio_id', negocioId)
      .eq('nombre', prod.nombre)
      .maybeSingle();

    let prodId: string;
    if (!existingProd) {
      const { data: newProd, error: pErr } = await supabase
        .from('productos')
        .insert({
          negocio_id: negocioId,
          categoria_id: catId,
          nombre: prod.nombre,
          descripcion: prod.descripcion,
          precio_venta: prod.precio_venta,
          imagen_url: prod.imagen_url,
          receta: prod.receta,
          costo_total: costoTotal,
          visible_catalogo: prod.visible_catalogo,
          orden: prod.orden,
        })
        .select('id')
        .single();

      if (pErr) {
        console.error(`Error al insertar ${prod.nombre}:`, pErr.message);
        continue;
      }
      prodId = newProd!.id;
      console.log(`  ✓ Producto creado: ${prod.nombre} ($${prod.precio_venta})`);
    } else {
      prodId = existingProd.id;
      // Actualizar foto y datos
      await supabase
        .from('productos')
        .update({
          imagen_url: prod.imagen_url,
          descripcion: prod.descripcion,
          precio_venta: prod.precio_venta,
          costo_total: costoTotal,
          receta: prod.receta,
          categoria_id: catId,
        })
        .eq('id', prodId);
    }

    // Ingredientes
    for (const ing of prod.ingredientes) {
      const { data: existingIng } = await supabase
        .from('ingredientes')
        .select('id')
        .eq('producto_id', prodId)
        .eq('nombre', ing.nombre)
        .maybeSingle();

      if (!existingIng) {
        await supabase.from('ingredientes').insert({
          negocio_id: negocioId,
          producto_id: prodId,
          nombre: ing.nombre,
          cantidad: ing.cantidad,
          unidad: ing.unidad,
          costo_unitario: ing.costo_unitario,
        });
      }
    }
  }

  // 7. VENDEDOR Y CADETE PROPIO + EMPRESA DE CADETERÍA EXTERNA
  console.log('🛵 Creando Vendedor, Cadete Propio (App + GPS) y Empresa de Cadetería Externa...');
  const vendedorEmail = 'vendedor@rolfopizzas.com';
  const vendedorPass = 'Vendedor@2026';
  const existingVendedor = userList?.users?.find((u) => u.email === vendedorEmail);
  let vendedorId = existingVendedor?.id;
  if (!existingVendedor) {
    const { data: vUser } = await supabase.auth.admin.createUser({
      email: vendedorEmail,
      password: vendedorPass,
      email_confirm: true,
      user_metadata: { role: 'vendedor', nombre: 'Mostrador / Vendedor' },
    });
    if (vUser?.user) vendedorId = vUser.user.id;
  }
  if (vendedorId) {
    await supabase.from('usuarios').upsert({
      id: vendedorId,
      email: vendedorEmail,
      nombre: 'Sofía (Vendedora Mostrador)',
      role: 'vendedor',
      negocio_id: negocioId,
      must_change_password: true,
      activo: true,
    });
  }

  const cadeteEmail = 'cadete@rolfopizzas.com';
  const cadetePass = 'Cadete@2026';
  const existingCadeteUser = userList?.users?.find((u) => u.email === cadeteEmail);
  let cadeteUserId = existingCadeteUser?.id;
  if (!existingCadeteUser) {
    const { data: cUser } = await supabase.auth.admin.createUser({
      email: cadeteEmail,
      password: cadetePass,
      email_confirm: true,
      user_metadata: { role: 'cadete', nombre: 'Lucas Gómez (Cadete)' },
    });
    if (cUser?.user) cadeteUserId = cUser.user.id;
  }
  if (cadeteUserId) {
    await supabase.from('usuarios').upsert({
      id: cadeteUserId,
      email: cadeteEmail,
      nombre: 'Lucas Gómez (Cadete)',
      telefono: '5491144556677',
      role: 'cadete',
      negocio_id: negocioId,
      must_change_password: true,
      activo: true,
    });

    const { data: existingCadPropio } = await supabase
      .from('cadetes')
      .select('id')
      .eq('negocio_id', negocioId)
      .eq('usuario_id', cadeteUserId)
      .maybeSingle();

    if (!existingCadPropio) {
      await supabase.from('cadetes').insert({
        negocio_id: negocioId,
        tipo: 'propio',
        usuario_id: cadeteUserId,
        nombre: 'Lucas Gómez (Moto Propia)',
        telefono_whatsapp: '5491144556677',
        es_predeterminado: true,
        activo: true,
      });
    }
  }

  const { data: existingCadExterna } = await supabase
    .from('cadetes')
    .select('id')
    .eq('negocio_id', negocioId)
    .eq('tipo', 'externa')
    .maybeSingle();

  if (!existingCadExterna) {
    await supabase.from('cadetes').insert({
      negocio_id: negocioId,
      tipo: 'externa',
      usuario_id: null,
      nombre: 'MotoExpress Palermo (Externa)',
      telefono_whatsapp: '5491133445566',
      es_predeterminado: false,
      activo: true,
    });
  }

  console.log('🎉 Seed v2 de Pizzas & Hamburguesas completado con éxito.');
  console.log('----------------------------------------------------');
  console.log('📌 NEGOCIO LISTO PARA PROBAR:');
  console.log('   Nombre:      ROLΦ Pizzas & Burgers');
  console.log('   Catálogo:    /n/rolfo-pizzas-burgers');
  console.log('   WhatsApp:    5491155551234 (Editable en /admin/configuracion)');
  console.log('📌 LOGIN ADMINISTRADOR DEL NEGOCIO:');
  console.log(`   Email:       ${adminDemoEmail}`);
  console.log(`   Contraseña:  ${adminDemoPass} (obligado a cambiarla en primer login)`);
  console.log('📌 LOGIN VENDEDOR:');
  console.log(`   Email:       ${vendedorEmail}`);
  console.log(`   Contraseña:  ${vendedorPass}`);
  console.log('📌 LOGIN CADETE (VISTA EXCLUSIVA /cadete CON GPS):');
  console.log(`   Email:       ${cadeteEmail}`);
  console.log(`   Contraseña:  ${cadetePass}`);
  console.log('📌 LOGIN SÚPER ADMINISTRADOR (OCULTO):');
  console.log(`   Email:       ${superadminEmail}`);
  console.log(`   Contraseña:  ${superadminPassword}`);
  console.log('----------------------------------------------------');
}

runSeed().catch((err) => {
  console.error('❌ Error fatal en Seed:', err);
  process.exit(1);
});
