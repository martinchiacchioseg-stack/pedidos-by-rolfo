'use client';

import { useState, useEffect, useCallback, useId } from 'react';
import {
  Layers,
  Plus,
  Edit,
  Trash2,
  Eye,
  EyeOff,
  Image as ImageIcon,
  DollarSign,
  TrendingUp,
  ChefHat,
  Search,
  Check,
  AlertCircle,
  X,
  Upload,
} from 'lucide-react';
import { Producto, Categoria, Ingrediente } from '@/types/database';
import { formatCurrency } from '@/lib/utils';

export default function ProductosPage() {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState<string>('todas');

  // Modal Producto (Crear / Editar)
  const [modalAbierto, setModalAbierto] = useState(false);
  const [productoEnEdicion, setProductoEnEdicion] = useState<Producto | null>(null);

  // Formulario de Producto
  const [nombre, setNombre] = useState('');
  const [categoriaId, setCategoriaId] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [precioVenta, setPrecioVenta] = useState<number | string>('');
  const [imagenUrl, setImagenUrl] = useState('');
  const [receta, setReceta] = useState('');
  const [visibleCatalogo, setVisibleCatalogo] = useState(true);
  const [ingredientes, setIngredientes] = useState<
    { id?: string; nombre: string; cantidad: number; unidad: string; costo_unitario: number | null }[]
  >([]);

  // Modal Categorías
  const [modalCategorias, setModalCategorias] = useState(false);
  const [nuevaCatNombre, setNuevaCatNombre] = useState('');

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const fileInputId = useId();

  // Cargar datos
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [resProd, resCat] = await Promise.all([
        fetch('/api/admin/productos'),
        fetch('/api/admin/categorias'),
      ]);

      if (resProd.ok) {
        const d = await resProd.json();
        setProductos(d.productos || []);
      }
      if (resCat.ok) {
        const d = await resCat.json();
        setCategorias(d.categorias || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Manejar compresión de imagen en el cliente usando Canvas
  const handleImagenSeleccionada = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 800;
        const scaleSize = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scaleSize;

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          // Calidad 0.75 para compresión rápida
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.75);
          setImagenUrl(compressedDataUrl);
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const abrirModalCrear = () => {
    setProductoEnEdicion(null);
    setNombre('');
    setCategoriaId(categorias[0]?.id || '');
    setDescripcion('');
    setPrecioVenta('');
    setImagenUrl('');
    setReceta('');
    setVisibleCatalogo(true);
    setIngredientes([]);
    setFormError(null);
    setModalAbierto(true);
  };

  const abrirModalEditar = (prod: Producto) => {
    setProductoEnEdicion(prod);
    setNombre(prod.nombre);
    setCategoriaId(prod.categoria_id || '');
    setDescripcion(prod.descripcion || '');
    setPrecioVenta(prod.precio_venta);
    setImagenUrl(prod.imagen_url || '');
    setReceta(prod.receta || '');
    setVisibleCatalogo(prod.visible_catalogo);
    setIngredientes(
      prod.ingredientes?.map((i) => ({
        id: i.id,
        nombre: i.nombre,
        cantidad: i.cantidad,
        unidad: i.unidad,
        costo_unitario: i.costo_unitario,
      })) || []
    );
    setFormError(null);
    setModalAbierto(true);
  };

  // Agregar ingrediente al formulario
  const agregarIngrediente = () => {
    setIngredientes([
      ...ingredientes,
      { nombre: '', cantidad: 1, unidad: 'unidades', costo_unitario: null },
    ]);
  };

  const quitarIngrediente = (index: number) => {
    setIngredientes(ingredientes.filter((_, i) => i !== index));
  };

  // Cálculo de costo total y margen
  const costoTotalCalculado = ingredientes.reduce((acc, ing) => {
    const cant = ing.cantidad || 0;
    const costo = ing.costo_unitario || 0;
    return acc + cant * costo;
  }, 0);

  const numPrecioVenta = parseFloat(precioVenta.toString()) || 0;
  const margenGanancia = numPrecioVenta - costoTotalCalculado;
  const porcentajeMargen =
    numPrecioVenta > 0 && costoTotalCalculado > 0
      ? ((margenGanancia / numPrecioVenta) * 100).toFixed(1)
      : null;

  // Guardar Producto
  const handleGuardarProducto = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSaving(true);

    try {
      const payload = {
        nombre,
        categoria_id: categoriaId || null,
        descripcion,
        precio_venta: numPrecioVenta,
        imagen_url: imagenUrl || null,
        receta: receta || null,
        visible_catalogo: visibleCatalogo,
        ingredientes,
      };

      const url = productoEnEdicion
        ? `/api/admin/productos/${productoEnEdicion.id}`
        : '/api/admin/productos';
      const method = productoEnEdicion ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al guardar producto');

      setModalAbierto(false);
      fetchData();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Error al guardar');
    } finally {
      setSaving(false);
    }
  };

  // Eliminar producto
  const handleEliminarProducto = async (id: string) => {
    if (!confirm('¿Estás seguro de que querés eliminar este producto?')) return;
    try {
      const res = await fetch(`/api/admin/productos/${id}`, { method: 'DELETE' });
      if (res.ok) fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  // Toggle visibilidad rápida
  const toggleVisibilidad = async (prod: Producto) => {
    try {
      await fetch(`/api/admin/productos/${prod.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ visible_catalogo: !prod.visible_catalogo }),
      });
      fetchData();
    } catch (err) {
      console.error(err);
    }
  };

  // Crear categoría rápida
  const handleCrearCategoria = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevaCatNombre.trim()) return;

    try {
      const res = await fetch('/api/admin/categorias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: nuevaCatNombre.trim() }),
      });
      if (res.ok) {
        setNuevaCatNombre('');
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const productosFiltrados = productos.filter((p) => {
    const matchQ = p.nombre.toLowerCase().includes(search.toLowerCase());
    const matchCat =
      categoriaSeleccionada === 'todas' || p.categoria_id === categoriaSeleccionada;
    return matchQ && matchCat;
  });

  return (
    <div className="space-y-6">
      {/* Encabezado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Layers className="w-6 h-6 text-rose-500" />
            Gestión de Productos & Recetas
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Catálogo del negocio, costos de ingredientes, margen de ganancia y visibilidad pública
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setModalCategorias(true)}
            className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-medium text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            Categorías ({categorias.length})
          </button>
          <button
            onClick={abrirModalCrear}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 shadow-lg shadow-rose-600/20 transition-all cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nuevo Producto</span>
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        {/* Selector de categorías */}
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0 text-xs">
          <button
            onClick={() => setCategoriaSeleccionada('todas')}
            className={`px-3 py-1.5 rounded-xl font-medium transition-colors cursor-pointer whitespace-nowrap ${
              categoriaSeleccionada === 'todas'
                ? 'bg-rose-600 text-white'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
          >
            Todas ({productos.length})
          </button>
          {categorias.map((c) => (
            <button
              key={c.id}
              onClick={() => setCategoriaSeleccionada(c.id)}
              className={`px-3 py-1.5 rounded-xl font-medium transition-colors cursor-pointer whitespace-nowrap ${
                categoriaSeleccionada === c.id
                  ? 'bg-rose-600 text-white'
                  : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
              }`}
            >
              {c.nombre}
            </button>
          ))}
        </div>

        {/* Buscador */}
        <div className="relative sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Buscar producto..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
          />
        </div>
      </div>

      {/* Grid de Productos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {productosFiltrados.map((prod) => {
          const costo = prod.costo_total || 0;
          const margen = prod.precio_venta - costo;
          const pct = prod.precio_venta > 0 && costo > 0 ? ((margen / prod.precio_venta) * 100).toFixed(0) : null;

          return (
            <div
              key={prod.id}
              className={`bg-slate-900 border rounded-3xl overflow-hidden flex flex-col justify-between transition-all ${
                prod.visible_catalogo ? 'border-slate-800' : 'border-slate-800/40 opacity-70'
              }`}
            >
              <div>
                {/* Imagen del producto */}
                <div className="relative h-44 w-full bg-slate-950 overflow-hidden">
                  {prod.imagen_url ? (
                    <img
                      src={prod.imagen_url}
                      alt={prod.nombre}
                      className="w-full h-full object-cover transition-transform hover:scale-105 duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center text-slate-600">
                      <ImageIcon className="w-8 h-8 mb-1" />
                      <span className="text-[11px]">Sin foto</span>
                    </div>
                  )}

                  {/* Badge de visibilidad sobre imagen */}
                  <div className="absolute top-3 right-3 flex items-center gap-1.5">
                    <button
                      onClick={() => toggleVisibilidad(prod)}
                      title={prod.visible_catalogo ? 'Visible en el menú público' : 'Oculto del menú público'}
                      className={`p-1.5 rounded-xl backdrop-blur-md text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors ${
                        prod.visible_catalogo
                          ? 'bg-emerald-950/80 text-emerald-300 border border-emerald-700/50'
                          : 'bg-slate-900/80 text-slate-400 border border-slate-700/50'
                      }`}
                    >
                      {prod.visible_catalogo ? (
                        <>
                          <Eye className="w-3.5 h-3.5" />
                          <span>Visible</span>
                        </>
                      ) : (
                        <>
                          <EyeOff className="w-3.5 h-3.5" />
                          <span>Oculto</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Categoría pill */}
                  {prod.categoria && (
                    <div className="absolute bottom-3 left-3">
                      <span className="bg-slate-900/90 backdrop-blur-md px-2.5 py-1 rounded-lg text-[10px] font-medium text-slate-300 border border-slate-700/60">
                        {prod.categoria.nombre}
                      </span>
                    </div>
                  )}
                </div>

                {/* Contenido */}
                <div className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-bold text-base text-white">{prod.nombre}</h3>
                    <span className="font-extrabold text-base text-rose-400 font-mono">
                      {formatCurrency(prod.precio_venta)}
                    </span>
                  </div>

                  {prod.descripcion && (
                    <p className="text-xs text-slate-400 line-clamp-2">{prod.descripcion}</p>
                  )}

                  {/* Fila de Costo y Margen (solo si hay costos) */}
                  {costo > 0 && (
                    <div className="p-3 bg-slate-950/80 rounded-2xl border border-slate-800/80 flex items-center justify-between text-xs">
                      <div>
                        <span className="text-[10px] text-slate-500 uppercase block">Costo Ingredientes</span>
                        <span className="font-mono text-slate-300">{formatCurrency(costo)}</span>
                      </div>
                      <div className="text-right">
                        <span className="text-[10px] text-slate-500 uppercase block">Margen ({pct}%)</span>
                        <span className="font-mono font-bold text-emerald-400">+{formatCurrency(margen)}</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Botones de acción al pie de la tarjeta */}
              <div className="px-5 py-3 border-t border-slate-800/60 bg-slate-950/40 flex items-center justify-between">
                <div className="text-[11px] text-slate-500">
                  {prod.ingredientes?.length || 0} ingrediente(s)
                </div>

                <div className="flex items-center gap-1">
                  <button
                    onClick={() => abrirModalEditar(prod)}
                    title="Editar producto"
                    className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                  >
                    <Edit className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => handleEliminarProducto(prod.id)}
                    title="Eliminar producto"
                    className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* ============================================================================== */}
      {/* MODAL: CREAR / EDITAR PRODUCTO */}
      {/* ============================================================================== */}
      {modalAbierto && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl my-8">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <h3 className="font-bold text-white text-lg">
                {productoEnEdicion ? 'Editar Producto' : 'Nuevo Producto'}
              </h3>
              <button onClick={() => setModalAbierto(false)} className="text-slate-500 hover:text-white font-bold cursor-pointer">
                ✕
              </button>
            </div>

            {formError && (
              <div className="mt-4 p-3 rounded-xl bg-rose-950/60 border border-rose-800 text-xs text-rose-300">
                {formError}
              </div>
            )}

            <form onSubmit={handleGuardarProducto} className="space-y-4 mt-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Nombre Comercial *</label>
                  <input
                    type="text"
                    required
                    value={nombre}
                    onChange={(e) => setNombre(e.target.value)}
                    placeholder="ej: Doble Cheese Burger"
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:ring-1 focus:ring-rose-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Categoría</label>
                  <select
                    value={categoriaId}
                    onChange={(e) => setCategoriaId(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white focus:outline-none focus:ring-1 focus:ring-rose-500"
                  >
                    <option value="">(Sin categoría)</option>
                    {categorias.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Precio de Venta ($ ARS) *</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-mono text-sm">$</span>
                    <input
                      type="number"
                      required
                      min={0}
                      step={100}
                      value={precioVenta}
                      onChange={(e) => setPrecioVenta(e.target.value)}
                      placeholder="8500"
                      className="w-full pl-8 pr-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-sm text-white font-mono focus:outline-none focus:ring-1 focus:ring-rose-500"
                    />
                  </div>
                </div>

                {/* Subida y Previsualización de Foto con compresión */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">Fotografía del Producto</label>
                  <div className="flex items-center gap-3">
                    {imagenUrl ? (
                      <img
                        src={imagenUrl}
                        alt="Preview"
                        className="w-11 h-11 rounded-xl object-cover border border-slate-700 flex-shrink-0"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-500 flex-shrink-0">
                        <ImageIcon className="w-5 h-5" />
                      </div>
                    )}
                    <label htmlFor={fileInputId} className="px-3 py-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs text-slate-300 cursor-pointer flex items-center gap-1.5">
                      <Upload className="w-3.5 h-3.5" />
                      <span>Subir foto (comprime auto)</span>
                    </label>
                    <input
                      id={fileInputId}
                      type="file"
                      accept="image/*"
                      onChange={handleImagenSeleccionada}
                      className="hidden"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Descripción Corta</label>
                <textarea
                  rows={2}
                  value={descripcion}
                  onChange={(e) => setDescripcion(e.target.value)}
                  placeholder="Detalle de ingredientes, acompañamiento, etc."
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-rose-500"
                />
              </div>

              {/* Receta */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Receta y Pasos de Preparación (Uso Interno)
                </label>
                <textarea
                  rows={2}
                  value={receta}
                  onChange={(e) => setReceta(e.target.value)}
                  placeholder="1. Tostar pan con manteca. 2. Sellar medallones 2 minutos..."
                  className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-rose-500 font-sans"
                />
              </div>

              {/* Desglose de Ingredientes y Costos */}
              <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-xs font-semibold text-white">Ingredientes & Costo de Elaboración</span>
                    <p className="text-[11px] text-slate-500">Cargá el costo de cada ingrediente para calcular el margen comercial.</p>
                  </div>
                  <button
                    type="button"
                    onClick={agregarIngrediente}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-slate-200 cursor-pointer"
                  >
                    + Agregar Ingrediente
                  </button>
                </div>

                {ingredientes.map((ing, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="Ingrediente (ej: Carne)"
                      value={ing.nombre}
                      onChange={(e) => {
                        const copy = [...ingredientes];
                        copy[idx].nombre = e.target.value;
                        setIngredientes(copy);
                      }}
                      className="flex-1 px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white"
                    />
                    <input
                      type="number"
                      placeholder="Cant."
                      value={ing.cantidad}
                      onChange={(e) => {
                        const copy = [...ingredientes];
                        copy[idx].cantidad = parseFloat(e.target.value) || 0;
                        setIngredientes(copy);
                      }}
                      className="w-16 px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white text-center font-mono"
                    />
                    <input
                      type="text"
                      placeholder="Unidad (gr, un)"
                      value={ing.unidad}
                      onChange={(e) => {
                        const copy = [...ingredientes];
                        copy[idx].unidad = e.target.value;
                        setIngredientes(copy);
                      }}
                      className="w-20 px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white"
                    />
                    <input
                      type="number"
                      placeholder="Costo $"
                      value={ing.costo_unitario ?? ''}
                      onChange={(e) => {
                        const copy = [...ingredientes];
                        copy[idx].costo_unitario = e.target.value === '' ? null : parseFloat(e.target.value);
                        setIngredientes(copy);
                      }}
                      className="w-24 px-2.5 py-1.5 bg-slate-900 border border-slate-800 rounded-lg text-xs text-white text-right font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => quitarIngrediente(idx)}
                      className="p-1.5 text-slate-500 hover:text-rose-400 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}

                {/* Resumen de costos calculado automáticamente */}
                {costoTotalCalculado > 0 && (
                  <div className="pt-2 border-t border-slate-800 flex justify-between text-xs">
                    <span className="text-slate-400">
                      Costo Total de Elaboración: <strong className="text-white font-mono">{formatCurrency(costoTotalCalculado)}</strong>
                    </span>
                    <span className="text-emerald-400 font-semibold font-mono">
                      Margen: {formatCurrency(margenGanancia)} ({porcentajeMargen}%)
                    </span>
                  </div>
                )}
              </div>

              {/* Interruptor Visible en el Menú */}
              <div className="flex items-center justify-between p-3.5 bg-slate-950 rounded-2xl border border-slate-800">
                <div>
                  <span className="text-xs font-semibold text-white block">Visible en el Catálogo Público</span>
                  <span className="text-[11px] text-slate-500">
                    Si está desactivado, el cliente no lo verá en el menú digital.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setVisibleCatalogo(!visibleCatalogo)}
                  className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
                    visibleCatalogo ? 'bg-rose-600 justify-end' : 'bg-slate-800 justify-start'
                  }`}
                >
                  <div className="bg-white w-4 h-4 rounded-full shadow-md" />
                </button>
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setModalAbierto(false)}
                  className="px-4 py-2.5 text-xs text-slate-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 disabled:opacity-50 cursor-pointer"
                >
                  {saving ? 'Guardando...' : 'Guardar Producto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ============================================================================== */}
      {/* MODAL: CATEGORÍAS */}
      {/* ============================================================================== */}
      {modalCategorias && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-white text-base">Categorías del Menú</h3>
              <button onClick={() => setModalCategorias(false)} className="text-slate-500 hover:text-white font-bold cursor-pointer">
                ✕
              </button>
            </div>

            <form onSubmit={handleCrearCategoria} className="flex gap-2 my-4">
              <input
                type="text"
                placeholder="Nueva categoría (ej: Promociones)"
                value={nuevaCatNombre}
                onChange={(e) => setNuevaCatNombre(e.target.value)}
                className="flex-1 px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-semibold rounded-xl text-xs cursor-pointer"
              >
                Agregar
              </button>
            </form>

            <div className="space-y-2 max-h-60 overflow-y-auto">
              {categorias.map((c) => (
                <div key={c.id} className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between text-xs">
                  <span className="font-medium text-white">{c.nombre}</span>
                  <button
                    onClick={async () => {
                      if (confirm(`¿Eliminar categoría "${c.nombre}"?`)) {
                        await fetch(`/api/admin/categorias?id=${c.id}`, { method: 'DELETE' });
                        fetchData();
                      }
                    }}
                    className="text-slate-500 hover:text-rose-400 cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            <div className="pt-4 text-right">
              <button
                onClick={() => setModalCategorias(false)}
                className="px-4 py-2 text-xs text-slate-400 hover:text-white"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
