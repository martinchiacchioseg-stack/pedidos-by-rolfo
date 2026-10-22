'use client';

import { useState, useEffect, useCallback, useId } from 'react';
import {
  Settings,
  Phone,
  Clock,
  Palette,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Save,
  Upload,
  Plus,
  Trash2,
  Type,
  MessageSquare,
  MapPin,
  Info,
} from 'lucide-react';
import {
  Negocio,
  HorariosSemanales,
  DiaSemanaKey,
  ModoApertura,
  TipografiaId,
  PlantillasWhatsApp,
} from '@/types/database';
import { limpiarNumeroWhatsApp, validarNumeroWhatsApp } from '@/lib/utils';
import { DIAS_SEMANA_ORDEN, HORARIOS_SEMANALES_DEFAULT } from '@/lib/horarios';
import { COMBINACIONES_TIPOGRAFICAS } from '@/lib/fonts';
import { PLANTILLAS_WHATSAPP_DEFAULT } from '@/lib/whatsapp';

export default function ConfiguracionPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Identidad y Marca
  const [nombre, setNombre] = useState('');
  const [slogan, setSlogan] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [colorPrimario, setColorPrimario] = useState('#E11D48');
  const [colorSecundario, setColorSecundario] = useState('#0F172A');
  const [tipografiaId, setTipografiaId] = useState<TipografiaId>('modern');
  const [temaCatalogo, setTemaCatalogo] = useState<'oscuro' | 'claro'>('oscuro');
  const [estiloBordes, setEstiloBordes] = useState<'suave' | 'recto' | 'redondeado'>('suave');

  // Contacto y Local
  const [telefono, setTelefono] = useState('');
  const [whatsappNumero, setWhatsappNumero] = useState('');
  const [direccionLocal, setDireccionLocal] = useState('');
  const [tiempoPreparacionMin, setTiempoPreparacionMin] = useState(30);

  // Apertura y Horarios Semanales (Doble franja)
  const [abiertoManual, setAbiertoManual] = useState(true);
  const [modoApertura, setModoApertura] = useState<ModoApertura>('manual');
  const [horariosSemanales, setHorariosSemanales] = useState<HorariosSemanales>(
    HORARIOS_SEMANALES_DEFAULT
  );

  // Mensajes y Plantillas WhatsApp
  const [mensajeBienvenida, setMensajeBienvenida] = useState('');
  const [mensajeCierre, setMensajeCierre] = useState('');
  const [avisarClienteEnCamino, setAvisarClienteEnCamino] = useState(true);
  const [plantillas, setPlantillas] = useState<PlantillasWhatsApp>(PLANTILLAS_WHATSAPP_DEFAULT);

  const fileInputId = useId();

  const fetchConfig = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/configuracion');
      if (res.ok) {
        const data = await res.json();
        const neg: Negocio = data.negocio;
        setNombre(neg.nombre || '');
        setSlogan(neg.slogan || '');
        setLogoUrl(neg.logo_url || '');
        setColorPrimario(neg.color_primario || '#E11D48');
        setColorSecundario(neg.color_secundario || '#0F172A');
        setTipografiaId(neg.tipografia_id || 'modern');
        setTemaCatalogo(neg.tema_catalogo || 'oscuro');
        setEstiloBordes(neg.estilo_bordes || 'suave');
        setTelefono(neg.telefono || '');
        setWhatsappNumero(neg.whatsapp_numero || '');
        setDireccionLocal(neg.direccion_local || '');
        setTiempoPreparacionMin(neg.tiempo_preparacion_min ?? 30);
        setAbiertoManual(neg.abierto_manual !== undefined ? neg.abierto_manual : true);
        setModoApertura(neg.modo_apertura || 'manual');
        if (neg.horarios_semanales && Object.keys(neg.horarios_semanales).length > 0) {
          setHorariosSemanales(neg.horarios_semanales);
        }
        setMensajeBienvenida(neg.mensaje_bienvenida || '');
        setMensajeCierre(neg.mensaje_cierre || '');
        setAvisarClienteEnCamino(
          neg.avisar_cliente_en_camino !== undefined ? neg.avisar_cliente_en_camino : true
        );
        if (neg.plantillas_whatsapp) {
          setPlantillas({
            ...PLANTILLAS_WHATSAPP_DEFAULT,
            ...neg.plantillas_whatsapp,
          });
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchConfig();
  }, [fetchConfig]);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 400;
        const scale = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          setLogoUrl(canvas.toDataURL('image/png', 0.85));
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleProbarNumero = () => {
    setError(null);
    const clean = limpiarNumeroWhatsApp(whatsappNumero);
    if (!validarNumeroWhatsApp(clean)) {
      setError(
        'Por favor ingresá un número internacional válido antes de probar (ej: 5491112345678).'
      );
      return;
    }

    const testUrl = `https://wa.me/${clean}?text=${encodeURIComponent(
      `Hola desde el panel de Pedidos by ROLΦ (${nombre}). Este es un mensaje de prueba para verificar la recepción de pedidos.`
    )}`;
    window.open(testUrl, '_blank', 'noopener,noreferrer');
  };

  const toggleDiaActivo = (dia: DiaSemanaKey) => {
    setHorariosSemanales((prev) => ({
      ...prev,
      [dia]: {
        ...prev[dia],
        activo: !prev[dia].activo,
      },
    }));
  };

  const actualizarFranja = (
    dia: DiaSemanaKey,
    index: number,
    campo: 'apertura' | 'cierre',
    valor: string
  ) => {
    setHorariosSemanales((prev) => {
      const franjas = [...(prev[dia]?.franjas || [])];
      if (franjas[index]) {
        franjas[index] = { ...franjas[index], [campo]: valor };
      }
      return {
        ...prev,
        [dia]: { ...prev[dia], franjas },
      };
    });
  };

  const agregarSegundaFranja = (dia: DiaSemanaKey) => {
    setHorariosSemanales((prev) => {
      const franjas = [...(prev[dia]?.franjas || [])];
      if (franjas.length < 2) {
        franjas.push({ apertura: '19:30', cierre: '23:59' });
      }
      return {
        ...prev,
        [dia]: { ...prev[dia], franjas },
      };
    });
  };

  const quitarFranja = (dia: DiaSemanaKey, index: number) => {
    setHorariosSemanales((prev) => {
      const franjas = (prev[dia]?.franjas || []).filter((_, i) => i !== index);
      return {
        ...prev,
        [dia]: { ...prev[dia], franjas },
      };
    });
  };

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMensajeExito(null);

    if (whatsappNumero.trim()) {
      const clean = limpiarNumeroWhatsApp(whatsappNumero);
      if (!validarNumeroWhatsApp(clean)) {
        setError(
          'El número de WhatsApp ingresado no tiene formato internacional válido (ej: 5491112345678).'
        );
        return;
      }
    }

    setSaving(true);
    try {
      const payload = {
        nombre,
        slogan: slogan || null,
        logo_url: logoUrl || null,
        color_primario: colorPrimario,
        color_secundario: colorSecundario,
        tipografia_id: tipografiaId,
        tema_catalogo: temaCatalogo,
        estilo_bordes: estiloBordes,
        telefono,
        whatsapp_numero: whatsappNumero ? limpiarNumeroWhatsApp(whatsappNumero) : null,
        direccion_local: direccionLocal,
        tiempo_preparacion_min: tiempoPreparacionMin,
        abierto_manual: abiertoManual,
        modo_apertura: modoApertura,
        horarios_semanales: horariosSemanales,
        avisar_cliente_en_camino: avisarClienteEnCamino,
        plantillas_whatsapp: plantillas,
        mensaje_bienvenida: mensajeBienvenida,
        mensaje_cierre: mensajeCierre,
      };

      const res = await fetch('/api/admin/configuracion', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al guardar configuración');

      setMensajeExito('Configuración, horarios e identidad de marca guardados exitosamente.');
      fetchConfig();
      setTimeout(() => setMensajeExito(null), 4000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error inesperado');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="text-slate-400 py-16 text-center text-xs">
        Cargando configuración del negocio...
      </div>
    );
  }

  return (
    <div className="max-w-5xl space-y-8 pb-12">
      <div>
        <h1 className="font-heading text-2xl font-bold text-white flex items-center gap-2.5">
          <Settings className="w-6 h-6 text-rose-500" />
          Configuración, Horarios e Identidad de Marca
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Personalizá el diseño de tu carta digital, tus franjas horarias de atención, el número receptor de WhatsApp y las plantillas de aviso al cliente.
        </p>
      </div>

      {mensajeExito && (
        <div className="p-4 rounded-2xl bg-emerald-500/12 border border-emerald-500/25 text-xs text-emerald-200 flex items-center gap-2.5">
          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>{mensajeExito}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/12 border border-rose-500/25 text-xs text-rose-200 flex items-center gap-2.5">
          <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleGuardar} className="space-y-7">
        {/* 1. WHATSAPP Y DIRECCIÓN DEL LOCAL */}
        <div className="p-6 bg-[#11151f] border border-emerald-500/30 rounded-3xl shadow-xl space-y-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center justify-center">
              <Phone className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-heading text-base font-bold text-white">
                Recepción de Pedidos por WhatsApp & Datos del Local
              </h2>
              <p className="text-xs text-slate-400">
                Número donde llegan los pedidos de tus clientes y dirección física de retiro.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Número de WhatsApp en Formato Internacional (E.164) *
              </label>
              <input
                type="text"
                required
                placeholder="Ej: 5491155551234 (Argentina: 54 + 9 + código área + número)"
                value={whatsappNumero}
                onChange={(e) => setWhatsappNumero(e.target.value)}
                className="w-full px-4 py-2.5 bg-[#090b10] border border-white/15 rounded-xl text-sm font-mono text-emerald-300 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
              />
            </div>

            <div className="flex flex-col justify-end">
              <button
                type="button"
                onClick={handleProbarNumero}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-600/20"
              >
                <span>Probar número</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-white/[0.06]">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Dirección del Local (usada para retiro de clientes y cadetes)
              </label>
              <div className="relative">
                <MapPin className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={direccionLocal}
                  onChange={(e) => setDireccionLocal(e.target.value)}
                  placeholder="Ej: Av. Corrientes 1234, CABA"
                  className="w-full pl-10 pr-4 py-2.5 bg-[#090b10] border border-white/10 rounded-xl text-xs text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Tiempo Estimado de Preparación (min)
              </label>
              <input
                type="number"
                min={5}
                max={180}
                value={tiempoPreparacionMin}
                onChange={(e) => setTiempoPreparacionMin(parseInt(e.target.value, 10) || 30)}
                className="w-full px-3.5 py-2.5 bg-[#090b10] border border-white/10 rounded-xl text-xs font-mono text-white"
              />
            </div>
          </div>
        </div>

        {/* 2. APERTURA Y HORARIOS POR DÍA DE LA SEMANA (Sección A) */}
        <div className="p-6 bg-[#11151f] border border-white/[0.08] rounded-3xl space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/[0.07] pb-4">
            <div className="flex items-center gap-2.5">
              <Clock className="w-5 h-5 text-amber-400" />
              <div>
                <h2 className="font-heading text-base font-bold text-white">
                  Modo de Apertura y Horarios por Día (Hasta 2 Franjas Diarias)
                </h2>
                <p className="text-xs text-slate-400">
                  Zona horaria configurada: America/Argentina/Buenos_Aires
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 bg-[#090b10] p-1 rounded-xl border border-white/10 text-xs">
              <button
                type="button"
                onClick={() => setModoApertura('manual')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                  modoApertura === 'manual'
                    ? 'bg-rose-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Modo Manual
              </button>
              <button
                type="button"
                onClick={() => setModoApertura('automatico')}
                className={`px-3 py-1.5 rounded-lg font-semibold transition-all cursor-pointer ${
                  modoApertura === 'automatico'
                    ? 'bg-rose-600 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Automático por Horarios
              </button>
            </div>
          </div>

          <p className="text-xs text-slate-400">
            {modoApertura === 'manual'
              ? 'En Modo Manual, el catálogo estará abierto o cerrado únicamente según el interruptor rápido del encabezado.'
              : 'En Modo Automático, el catálogo se abrirá y cerrará solo según las franjas horarias de cada día (y podés usar el interruptor del encabezado para cerrar por excepción).'}
          </p>

          <div className="space-y-2.5">
            {DIAS_SEMANA_ORDEN.map((dia) => {
              const configDia = horariosSemanales[dia.key] || { activo: false, franjas: [] };
              return (
                <div
                  key={dia.key}
                  className="p-3.5 rounded-2xl bg-[#090b10] border border-white/[0.06] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-[140px]">
                    <button
                      type="button"
                      onClick={() => toggleDiaActivo(dia.key)}
                      className={`w-10 h-5 flex items-center rounded-full p-0.5 cursor-pointer transition-colors ${
                        configDia.activo ? 'bg-emerald-600 justify-end' : 'bg-slate-800 justify-start'
                      }`}
                    >
                      <div className="bg-white w-4 h-4 rounded-full shadow" />
                    </button>
                    <span className="text-xs font-semibold text-white">{dia.label}</span>
                  </div>

                  {configDia.activo ? (
                    <div className="flex flex-wrap items-center gap-3 flex-1 justify-end">
                      {configDia.franjas.map((franja, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-1.5 bg-[#11151f] px-3 py-1.5 rounded-xl border border-white/10 text-xs"
                        >
                          <span className="text-[10px] text-slate-400 mr-1">
                            T{idx + 1}:
                          </span>
                          <input
                            type="time"
                            value={franja.apertura}
                            onChange={(e) =>
                              actualizarFranja(dia.key, idx, 'apertura', e.target.value)
                            }
                            className="bg-transparent text-white font-mono focus:outline-none"
                          />
                          <span className="text-slate-500">a</span>
                          <input
                            type="time"
                            value={franja.cierre}
                            onChange={(e) =>
                              actualizarFranja(dia.key, idx, 'cierre', e.target.value)
                            }
                            className="bg-transparent text-white font-mono focus:outline-none"
                          />
                          {configDia.franjas.length > 1 && (
                            <button
                              type="button"
                              onClick={() => quitarFranja(dia.key, idx)}
                              className="text-slate-500 hover:text-rose-400 ml-1 cursor-pointer"
                              title="Quitar segunda franja"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      ))}

                      {configDia.franjas.length < 2 && (
                        <button
                          type="button"
                          onClick={() => agregarSegundaFranja(dia.key)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-[11px] font-medium text-slate-300 border border-white/10 cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                          <span>2da franja</span>
                        </button>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-slate-500 italic">Cerrado todo el día</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* 3. IDENTIDAD VISUAL Y PERSONALIZACIÓN DE MARCA (Sección I) */}
        <div className="p-6 bg-[#11151f] border border-white/[0.08] rounded-3xl space-y-5">
          <div className="flex items-center gap-2.5 border-b border-white/[0.07] pb-4">
            <Palette className="w-5 h-5 text-rose-500" />
            <div>
              <h2 className="font-heading text-base font-bold text-white">
                Identidad de Marca y Sistema Tipográfico
              </h2>
              <p className="text-xs text-slate-400">
                Diseñá una carta digital con personalidad propia para tu rubro gastronómico.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Nombre Comercial *
              </label>
              <input
                type="text"
                required
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#090b10] border border-white/10 rounded-xl text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Slogan o Bajada de Marca
              </label>
              <input
                type="text"
                value={slogan}
                onChange={(e) => setSlogan(e.target.value)}
                placeholder="Ej: Pizzas de masa madre & Smash Burgers"
                className="w-full px-3.5 py-2.5 bg-[#090b10] border border-white/10 rounded-xl text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Teléfono de Contacto Visible
              </label>
              <input
                type="text"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                placeholder="011 4444-5555"
                className="w-full px-3.5 py-2.5 bg-[#090b10] border border-white/10 rounded-xl text-xs text-white"
              />
            </div>
          </div>

          {/* Selector de Pares Tipográficos Curados */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
              <Type className="w-3.5 h-3.5 text-rose-400" />
              <span>Combinación Tipográfica de Marca</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {COMBINACIONES_TIPOGRAFICAS.map((combo) => {
                const seleccionado = tipografiaId === combo.id;
                return (
                  <button
                    key={combo.id}
                    type="button"
                    onClick={() => setTipografiaId(combo.id)}
                    className={`p-4 rounded-2xl border text-left transition-all cursor-pointer ${
                      seleccionado
                        ? 'bg-rose-500/12 border-rose-500 text-white'
                        : 'bg-[#090b10] border-white/10 text-slate-300 hover:border-white/20'
                    }`}
                  >
                    <div
                      style={{ fontFamily: combo.headingFamily }}
                      className="text-sm font-bold text-white"
                    >
                      {combo.nombre}
                    </div>
                    <p className="text-[11px] text-slate-400 mt-1">{combo.descripcion}</p>
                    <span className="inline-block mt-2 text-[10px] text-rose-400 font-medium">
                      {combo.ejemploRubro}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Logo, Colores y Tema */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="p-4 bg-[#090b10] rounded-2xl border border-white/10 flex items-center gap-4">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt="Logo"
                  className="w-14 h-14 rounded-2xl object-cover border border-white/15 shrink-0"
                />
              ) : (
                <div className="w-14 h-14 rounded-2xl bg-[#11151f] border border-white/10 flex items-center justify-center text-slate-500 shrink-0">
                  <ImageIcon className="w-6 h-6" />
                </div>
              )}
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                  <label
                    htmlFor={fileInputId}
                    className="px-3 py-1.5 bg-[#11151f] hover:bg-[#171c29] border border-white/10 rounded-xl text-xs font-medium text-slate-200 cursor-pointer inline-flex items-center gap-1.5"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Subir Logo</span>
                  </label>
                  <input
                    id={fileInputId}
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                </div>
                <input
                  type="url"
                  placeholder="O pegar URL del logo..."
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  className="w-full px-2.5 py-1 bg-[#11151f] border border-white/10 rounded-lg text-[11px] text-slate-300"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3.5 bg-[#090b10] rounded-2xl border border-white/10 flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-white block">Color Primario</span>
                  <span className="text-[11px] font-mono text-slate-400">{colorPrimario}</span>
                </div>
                <input
                  type="color"
                  value={colorPrimario}
                  onChange={(e) => setColorPrimario(e.target.value)}
                  className="w-9 h-9 rounded-xl border border-white/15 bg-transparent cursor-pointer"
                />
              </div>

              <div className="p-3.5 bg-[#090b10] rounded-2xl border border-white/10 flex items-center justify-between">
                <div>
                  <span className="text-xs font-semibold text-white block">Secundario</span>
                  <span className="text-[11px] font-mono text-slate-400">{colorSecundario}</span>
                </div>
                <input
                  type="color"
                  value={colorSecundario}
                  onChange={(e) => setColorSecundario(e.target.value)}
                  className="w-9 h-9 rounded-xl border border-white/15 bg-transparent cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Tema del Catálogo</label>
                <select
                  value={temaCatalogo}
                  onChange={(e) => setTemaCatalogo(e.target.value as 'oscuro' | 'claro')}
                  className="w-full px-3 py-2 bg-[#090b10] border border-white/10 rounded-xl text-xs text-white"
                >
                  <option value="oscuro">Oscuro Gourmet</option>
                  <option value="claro">Claro Luminoso</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] text-slate-400 mb-1">Estilo de Tarjetas</label>
                <select
                  value={estiloBordes}
                  onChange={(e) =>
                    setEstiloBordes(e.target.value as 'suave' | 'recto' | 'redondeado')
                  }
                  className="w-full px-3 py-2 bg-[#090b10] border border-white/10 rounded-xl text-xs text-white"
                >
                  <option value="suave">Bordes Suaves</option>
                  <option value="redondeado">Extra Redondeado</option>
                  <option value="recto">Editorial Minimal</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* 4. PLANTILLAS DE AVISOS AL CLIENTE POR WHATSAPP (Sección G) */}
        <div className="p-6 bg-[#11151f] border border-white/[0.08] rounded-3xl space-y-5">
          <div className="flex items-center justify-between border-b border-white/[0.07] pb-4">
            <div className="flex items-center gap-2.5">
              <MessageSquare className="w-5 h-5 text-emerald-400" />
              <div>
                <h2 className="font-heading text-base font-bold text-white">
                  Avisos al Cliente por WhatsApp y Mensajes del Catálogo
                </h2>
                <p className="text-xs text-slate-400">
                  Variables disponibles: {'{nombre}'}, {'{numero_pedido}'}, {'{total}'},{' '}
                  {'{hora_estimada}'}, {'{negocio}'}, {'{direccion}'}
                </p>
              </div>
            </div>
          </div>

          <div className="p-3.5 rounded-2xl bg-sky-500/10 border border-sky-500/20 text-xs text-sky-200 flex items-center gap-2.5">
            <Info className="w-4 h-4 text-sky-400 shrink-0" />
            <span>
              Importante: Al usar los botones de aviso, se abrirá WhatsApp con el texto armado y editable; el envío final lo realiza la persona del local tocando &quot;Enviar&quot; dentro de WhatsApp.
            </span>
          </div>

          <div className="flex items-center justify-between p-3.5 bg-[#090b10] rounded-2xl border border-white/10">
            <div>
              <span className="text-xs font-semibold text-white block">
                Ofrecer avisar al cliente cuando el pedido sale &quot;En camino&quot;
              </span>
              <span className="text-[11px] text-slate-400">
                Para envíos a domicilio, sugiere enviar el WhatsApp de seguimiento al despachar.
              </span>
            </div>
            <button
              type="button"
              onClick={() => setAvisarClienteEnCamino(!avisarClienteEnCamino)}
              className={`w-12 h-6 flex items-center rounded-full p-1 cursor-pointer transition-colors ${
                avisarClienteEnCamino ? 'bg-emerald-600 justify-end' : 'bg-slate-800 justify-start'
              }`}
            >
              <div className="bg-white w-4 h-4 rounded-full shadow" />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Plantilla: &quot;Pedido listo&quot; (Retiro en local)
              </label>
              <textarea
                rows={3}
                value={plantillas.cliente_listo}
                onChange={(e) => setPlantillas({ ...plantillas, cliente_listo: e.target.value })}
                className="w-full px-3.5 py-2.5 bg-[#090b10] border border-white/10 rounded-xl text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Plantilla: &quot;Tu pedido está en camino&quot; (Envíos)
              </label>
              <textarea
                rows={3}
                value={plantillas.cliente_en_camino}
                onChange={(e) =>
                  setPlantillas({ ...plantillas, cliente_en_camino: e.target.value })
                }
                className="w-full px-3.5 py-2.5 bg-[#090b10] border border-white/10 rounded-xl text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Mensaje de Bienvenida en Catálogo
              </label>
              <textarea
                rows={2}
                value={mensajeBienvenida}
                onChange={(e) => setMensajeBienvenida(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#090b10] border border-white/10 rounded-xl text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Mensaje de Confirmación al Enviar Pedido
              </label>
              <textarea
                rows={2}
                value={mensajeCierre}
                onChange={(e) => setMensajeCierre(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-[#090b10] border border-white/10 rounded-xl text-xs text-white"
              />
            </div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-sm shadow-xl shadow-rose-600/20 disabled:opacity-50 transition-all cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Guardando cambios...' : 'Guardar Configuración Completa'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
