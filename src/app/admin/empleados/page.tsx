'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Plus,
  Shield,
  ShoppingBag,
  KeyRound,
  CheckCircle2,
  XCircle,
  Copy,
  Check,
  Search,
} from 'lucide-react';
import { Usuario } from '@/types/database';
import { formatDate } from '@/lib/utils';

export default function EmpleadosPage() {
  const [empleados, setEmpleados] = useState<Usuario[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Modales
  const [modalNuevo, setModalNuevo] = useState(false);
  const [modalResetPass, setModalResetPass] = useState<Usuario | null>(null);

  // Formulario nuevo
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'vendedor'>('vendedor');
  const [passwordMomentanea, setPasswordMomentanea] = useState('Staff@' + Math.floor(1000 + Math.random() * 9000));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Clave reseteada
  const [claveGenerada, setClaveGenerada] = useState<string | null>(null);
  const [copiado, setCopiado] = useState(false);

  const fetchEmpleados = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/empleados');
      if (res.ok) {
        const d = await res.json();
        setEmpleados(d.empleados || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEmpleados();
  }, [fetchEmpleados]);

  const handleCrearEmpleado = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch('/api/admin/empleados', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre,
          email,
          role,
          password_momentanea: passwordMomentanea,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al crear empleado');

      setModalNuevo(false);
      setNombre('');
      setEmail('');
      setRole('vendedor');
      setPasswordMomentanea('Staff@' + Math.floor(1000 + Math.random() * 9000));
      fetchEmpleados();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al crear');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActivo = async (emp: Usuario) => {
    try {
      await fetch('/api/admin/empleados', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empleado_id: emp.id,
          accion: 'toggle_activo',
          valor: !emp.activo,
        }),
      });
      fetchEmpleados();
    } catch (err) {
      console.error(err);
    }
  };

  const handleResetClave = async (empId: string) => {
    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/empleados', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          empleado_id: empId,
          accion: 'reset_password',
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setClaveGenerada(data.password_momentanea);
        fetchEmpleados();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setSubmitting(false);
    }
  };

  const filtrados = empleados.filter(
    (e) =>
      e.nombre.toLowerCase().includes(search.toLowerCase()) ||
      e.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-rose-500" />
            Equipo & Empleados
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Gestión de accesos, roles (Administrador y Vendedor) y restablecimiento de claves provisorias
          </p>
        </div>

        <button
          onClick={() => {
            setError(null);
            setModalNuevo(true);
          }}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-white bg-rose-600 hover:bg-rose-500 shadow-lg shadow-rose-600/20 cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Nuevo Integrante</span>
        </button>
      </div>

      {/* Buscador */}
      <div className="relative max-w-sm">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
        <input
          type="text"
          placeholder="Buscar empleado por nombre o mail..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-rose-500"
        />
      </div>

      {/* Tabla de Empleados */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-950/70 text-[11px] uppercase tracking-wider text-slate-400 border-b border-slate-800">
              <tr>
                <th className="px-5 py-3.5">Integrante</th>
                <th className="px-5 py-3.5">Rol de Acceso</th>
                <th className="px-5 py-3.5">Estado</th>
                <th className="px-5 py-3.5">Contraseña</th>
                <th className="px-5 py-3.5 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {filtrados.map((emp) => (
                <tr key={emp.id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="px-5 py-4">
                    <div className="font-semibold text-white">{emp.nombre}</div>
                    <div className="text-xs text-slate-400 font-mono">{emp.email}</div>
                  </td>

                  <td className="px-5 py-4">
                    {emp.role === 'admin' ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-950/80 text-rose-300 border border-rose-800/80">
                        <Shield className="w-3.5 h-3.5 text-rose-400" />
                        Administrador
                      </span>
                    ) : emp.role === 'cadete' ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-800/80">
                        <ShoppingBag className="w-3.5 h-3.5 text-emerald-400" />
                        Cadete (App Entregas)
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-950/80 text-blue-300 border border-blue-800/80">
                        <ShoppingBag className="w-3.5 h-3.5 text-blue-400" />
                        Vendedor
                      </span>
                    )}
                  </td>

                  <td className="px-5 py-4">
                    {emp.activo ? (
                      <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Activo
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-rose-400">
                        <XCircle className="w-3.5 h-3.5" />
                        Desactivado
                      </span>
                    )}
                  </td>

                  <td className="px-5 py-4 text-xs">
                    {emp.must_change_password ? (
                      <span className="text-amber-400 font-medium">Debe cambiarla al entrar</span>
                    ) : (
                      <span className="text-slate-400">Actualizada</span>
                    )}
                  </td>

                  <td className="px-5 py-4 text-right">
                    <div className="inline-flex items-center gap-2">
                      <button
                        onClick={() => {
                          setModalResetPass(emp);
                          setClaveGenerada(null);
                        }}
                        title="Resetear contraseña momentánea"
                        className="p-1.5 text-slate-400 hover:text-amber-400 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                      >
                        <KeyRound className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => toggleActivo(emp)}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium cursor-pointer transition-colors ${
                          emp.activo
                            ? 'text-rose-400 hover:bg-rose-950/50'
                            : 'text-emerald-400 hover:bg-emerald-950/50'
                        }`}
                      >
                        {emp.activo ? 'Desactivar' : 'Activar'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: NUEVO EMPLEADO */}
      {modalNuevo && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-white text-base">Nuevo Integrante del Equipo</h3>
              <button onClick={() => setModalNuevo(false)} className="text-slate-500 hover:text-white font-bold cursor-pointer">
                ✕
              </button>
            </div>

            {error && (
              <div className="mt-4 p-3 bg-rose-950/60 border border-rose-800 rounded-xl text-xs text-rose-300">
                {error}
              </div>
            )}

            <form onSubmit={handleCrearEmpleado} className="space-y-4 my-4">
              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Nombre Completo *</label>
                <input
                  type="text"
                  required
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  placeholder="ej: Carla Rossi"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Correo Electrónico (Login) *</label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="carla@minegocio.com"
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Rol de Acceso *</label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as 'admin' | 'vendedor')}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs text-white"
                >
                  <option value="vendedor">Vendedor (Ve y gestiona pedidos, sin acceso a costos)</option>
                  <option value="admin">Administrador (Acceso total a todo el negocio)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-300 mb-1">Contraseña Momentánea *</label>
                <input
                  type="text"
                  required
                  value={passwordMomentanea}
                  onChange={(e) => setPasswordMomentanea(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-amber-300"
                />
                <span className="text-[11px] text-slate-500 mt-1 block">
                  * Se le exigirá cambiarla en su primer inicio de sesión.
                </span>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalNuevo(false)}
                  className="px-4 py-2 text-xs text-slate-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-semibold disabled:opacity-50 cursor-pointer"
                >
                  {submitting ? 'Creando...' : 'Crear Integrante'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RESETEAR CLAVE EMPLEADO */}
      {modalResetPass && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-md w-full p-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h3 className="font-bold text-white text-base">Restablecer Contraseña</h3>
              <button onClick={() => setModalResetPass(null)} className="text-slate-500 hover:text-white font-bold cursor-pointer">
                ✕
              </button>
            </div>

            <div className="py-4 space-y-3">
              <p className="text-xs text-slate-400">
                Se generará una contraseña provisional para <strong className="text-white">{modalResetPass.nombre}</strong>.
              </p>

              {claveGenerada ? (
                <div className="p-4 bg-amber-950/40 border border-amber-800/80 rounded-2xl text-center space-y-2">
                  <span className="text-xs text-amber-300 font-semibold block">Nueva Clave Momentánea:</span>
                  <div className="flex items-center justify-center gap-2">
                    <span className="font-mono text-base font-bold text-white bg-black/50 px-3 py-1.5 rounded-xl border border-slate-700 select-all">
                      {claveGenerada}
                    </span>
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(claveGenerada);
                        setCopiado(true);
                        setTimeout(() => setCopiado(false), 2000);
                      }}
                      className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white transition-colors cursor-pointer"
                    >
                      {copiado ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  disabled={submitting}
                  onClick={() => handleResetClave(modalResetPass.id)}
                  className="w-full py-2.5 rounded-xl text-xs font-semibold text-slate-950 bg-amber-400 hover:bg-amber-300 cursor-pointer"
                >
                  {submitting ? 'Generando...' : 'Generar Clave Provisoria'}
                </button>
              )}
            </div>

            <div className="pt-2 text-right">
              <button onClick={() => setModalResetPass(null)} className="px-4 py-2 text-xs text-slate-400 hover:text-white">
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
