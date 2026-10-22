'use client';

import { useState, useEffect, useCallback, useId } from 'react';
import {
  Settings,
  Phone,
  MessageSquare,
  Clock,
  Palette,
  Image as ImageIcon,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Save,
  Upload,
} from 'lucide-react';
import { Negocio, HorariosNegocio } from '@/types/database';
import { limpiarNumeroWhatsApp, validarNumeroWhatsApp } from '@/lib/utils';

export default function ConfiguracionPage() {
  const [negocio, setNegocio] = useState<Negocio | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Campos de formulario
  const [nombre, setNombre] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [colorPrimario, setColorPrimario] = useState('#E11D48');
  const [colorSecundario, setColorSecundario] = useState('#1E293B');
  const [telefono, setTelefono] = useState('');
  const [whatsappNumero, setWhatsappNumero] = useState('');
  const [diasHorario, setDiasHorario] = useState('Lunes a Domingo');
  const [horaApertura, setHoraApertura] = useState('19:00');
  const [horaCierre, setHoraCierre] = useState('00:00');
  const [mensajeBienvenida, setMensajeBienvenida] = useState('');
  const [mensajeCierre, setMensajeCierre] = useState('');

  const fileInputId = useId();

  const fetchConfig = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/configuracion');
      if (res.ok) {
        const data = await res.json();
        const neg: Negocio = data.negocio;
        setNegocio(neg);
        setNombre(neg.nombre || '');
        setLogoUrl(neg.logo_url || '');
        setColorPrimario(neg.color_primario || '#E11D48');
        setColorSecundario(neg.color_secundario || '#1E293B');
        setTelefono(neg.telefono || '');
        setWhatsappNumero(neg.whatsapp_numero || '');
        if (neg.horarios) {
          setDiasHorario(neg.horarios.dias || 'Lunes a Domingo');
          setHoraApertura(neg.horarios.apertura || '19:00');
          setHoraCierre(neg.horarios.cierre || '00:00');
        }
        setMensajeBienvenida(neg.mensaje_bienvenida || '');
        setMensajeCierre(neg.mensaje_cierre || '');
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

  // Manejar compresión rápida de logo
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

  // Botón "Probar número"
  const handleProbarNumero = () => {
    setError(null);
    const clean = limpiarNumeroWhatsApp(whatsappNumero);
    if (!validarNumeroWhatsApp(clean)) {
      setError('Por favor ingresá un número internacional válido antes de probar (ej: 5491112345678).');
      return;
    }

    const testUrl = `https://wa.me/${clean}?text=${encodeURIComponent(
      `¡Hola desde el panel de Pedidos by ROLΦ! Este es un chat de prueba para verificar que recibas pedidos correctamente.`
    )}`;
    window.open(testUrl, '_blank');
  };

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMensajeExito(null);

    // Validar WhatsApp si fue completado
    if (whatsappNumero.trim()) {
      const clean = limpiarNumeroWhatsApp(whatsappNumero);
      if (!validarNumeroWhatsApp(clean)) {
        setError('El número de WhatsApp ingresado no tiene formato internacional válido (ej: 5491112345678 sin espacios ni guiones).');
        return;
      }
    }

    setSaving(true);
    try {
      const payload = {
        nombre,
        logo_url: logoUrl || null,
        color_primario: colorPrimario,
        color_secundario: colorSecundario,
        telefono,
        whatsapp_numero: whatsappNumero ? limpiarNumeroWhatsApp(whatsappNumero) : null,
        horarios: {
          dias: diasHorario,
          apertura: horaApertura,
          cierre: horaCierre,
        },
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

      setMensajeExito('¡Configuración actualizada exitosamente!');
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
      <div className="text-slate-400 py-12 text-center text-xs">
        Cargando configuración del negocio...
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <Settings className="w-6 h-6 text-rose-500" />
          Configuración del Negocio
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Ajustá la identidad visual, el número de WhatsApp receptor de pedidos y los horarios de atención
        </p>
      </div>

      {mensajeExito && (
        <div className="p-4 rounded-2xl bg-emerald-950/60 border border-emerald-800 text-xs text-emerald-300 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{mensajeExito}</span>
        </div>
      )}

      {error && (
        <div className="p-4 rounded-2xl bg-rose-950/60 border border-rose-800 text-xs text-rose-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleGuardar} className="space-y-6">
        {/* SECCIÓN 1: RECEPCIÓN DE PEDIDOS POR WHATSAPP (DESTACADA) */}
        <div className="p-6 bg-slate-900 border-2 border-emerald-800/80 rounded-3xl shadow-xl space-y-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-emerald-600/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center">
              <Phone className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Número de WhatsApp para Pedidos</h2>
              <p className="text-xs text-slate-400">
                Los clientes enviarán sus carritos de compra directamente a este número con el pedido redactado.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-300 mb-1">
                Número en Formato Internacional (E.164) *
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  placeholder="ej: 5491155551234 (Argentina: 54 + 9 + código de área + número)"
                  value={whatsappNumero}
                  onChange={(e) => setWhatsappNumero(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-950 border border-slate-700 rounded-xl text-sm font-mono text-emerald-300 placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <span className="text-[11px] text-slate-500 mt-1 block">
                * Para Argentina, anteponé el <strong>549</strong> seguido del código de área sin el 15.
              </span>
            </div>

            <div className="flex flex-col justify-end">
              <button
                type="button"
                onClick={handleProbarNumero}
                className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-lg shadow-emerald-600/20"
              >
                <span>Probar Chat en WhatsApp</span>
                <ExternalLink className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* SECCIÓN 2: IDENTIDAD VISUAL Y DATOS COMERCIALES */}
        <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl space-y-5">
          <div className="flex items-center gap-2 text-sm font-bold text-white border-b border-slate-800 pb-3">
            <Palette className="w-4 h-4 text-rose-500" />
            <span>Identidad Visual & Marca</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Nombre Comercial del Negocio</label>
              <input
                type="text"
                required
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1">Teléfono Alternativo / Fijo</label>
              <input
                type="text"
                value={telefono}
                onChange={(e) => setTelefono(e.target.value)}
                placeholder="011 4444-5555"
                className="w-full px-3.5 py-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
              />
            </div>
          </div>

          {/* Logo del negocio */}
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-2">Logo Comercial</label>
            <div className="flex items-center gap-4">
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt="Logo Negocio"
                  className="w-16 h-16 rounded-2xl object-cover border border-slate-700 shadow-md"
                />
              ) : (
                <div className="w-16 h-16 rounded-2xl bg-slate-950 border border-slate-800 flex items-center justify-center text-slate-600">
                  <ImageIcon className="w-6 h-6" />
                </div>
              )}

              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-3">
                  <label htmlFor={fileInputId} className="px-3.5 py-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded-xl text-xs font-medium text-slate-300 cursor-pointer inline-flex items-center gap-2">
                    <Upload className="w-3.5 h-3.5" />
                    <span>Seleccionar Logo</span>
                  </label>
                  <input
                    id={fileInputId}
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                  />
                  {logoUrl && (
                    <button
                      type="button"
                      onClick={() => setLogoUrl('')}
                      className="text-xs text-rose-400 hover:underline cursor-pointer"
                    >
                      Remover
                    </button>
                  )}
                </div>
                <input
                  type="url"
                  placeholder="O ingresá URL externa del logo..."
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-300"
                />
              </div>
            </div>
          </div>

          {/* Colores */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-white block">Color Primario (Botones / Resaltados)</span>
                <span className="text-[11px] font-mono text-slate-500">{colorPrimario}</span>
              </div>
              <input
                type="color"
                value={colorPrimario}
                onChange={(e) => setColorPrimario(e.target.value)}
                className="w-9 h-9 rounded-xl border border-slate-700 bg-transparent cursor-pointer"
              />
            </div>

            <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 flex items-center justify-between">
              <div>
                <span className="text-xs font-semibold text-white block">Color Secundario (Encabezados / Barras)</span>
                <span className="text-[11px] font-mono text-slate-500">{colorSecundario}</span>
              </div>
              <input
                type="color"
                value={colorSecundario}
                onChange={(e) => setColorSecundario(e.target.value)}
                className="w-9 h-9 rounded-xl border border-slate-700 bg-transparent cursor-pointer"
              />
            </div>
          </div>
        </div>

        {/* SECCIÓN 3: HORARIOS Y MENSAJES */}
        <div className="p-6 bg-slate-900 border border-slate-800 rounded-3xl space-y-4">
          <div className="flex items-center gap-2 text-sm font-bold text-white border-b border-slate-800 pb-3">
            <Clock className="w-4 h-4 text-amber-500" />
            <span>Horarios de Atención & Mensajería</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Días de Atención</label>
              <input
                type="text"
                value={diasHorario}
                onChange={(e) => setDiasHorario(e.target.value)}
                placeholder="Martes a Domingos"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Hora de Apertura</label>
              <input
                type="time"
                value={horaApertura}
                onChange={(e) => setHoraApertura(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Hora de Cierre</label>
              <input
                type="time"
                value={horaCierre}
                onChange={(e) => setHoraCierre(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Mensaje de Bienvenida (Catálogo)</label>
              <textarea
                rows={2}
                value={mensajeBienvenida}
                onChange={(e) => setMensajeBienvenida(e.target.value)}
                placeholder="¡Bienvenido a nuestro menú digital!"
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1">Mensaje de Cierre (Al Enviar)</label>
              <textarea
                rows={2}
                value={mensajeCierre}
                onChange={(e) => setMensajeCierre(e.target.value)}
                placeholder="¡Gracias por elegirnos! Preparando tu orden..."
                className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
              />
            </div>
          </div>
        </div>

        {/* Botón de Guardar */}
        <div className="flex justify-end pt-2">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-semibold text-sm shadow-xl shadow-rose-600/20 disabled:opacity-50 transition-all cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Guardando...' : 'Guardar Toda la Configuración'}</span>
          </button>
        </div>
      </form>
    </div>
  );
}
