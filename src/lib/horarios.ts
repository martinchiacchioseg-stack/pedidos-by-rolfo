import { DiaSemanaKey, HorariosSemanales, Negocio } from '@/types/database';

export const DIAS_SEMANA_ORDEN: { key: DiaSemanaKey; label: string; short: string; jsDay: number }[] = [
  { key: 'lunes', label: 'Lunes', short: 'Lun', jsDay: 1 },
  { key: 'martes', label: 'Martes', short: 'Mar', jsDay: 2 },
  { key: 'miercoles', label: 'Miércoles', short: 'Mié', jsDay: 3 },
  { key: 'jueves', label: 'Jueves', short: 'Jue', jsDay: 4 },
  { key: 'viernes', label: 'Viernes', short: 'Vie', jsDay: 5 },
  { key: 'sabado', label: 'Sábado', short: 'Sáb', jsDay: 6 },
  { key: 'domingo', label: 'Domingo', short: 'Dom', jsDay: 0 },
];

export const HORARIOS_SEMANALES_DEFAULT: HorariosSemanales = {
  lunes: {
    activo: true,
    franjas: [
      { apertura: '11:30', cierre: '15:00' },
      { apertura: '19:30', cierre: '23:59' },
    ],
  },
  martes: {
    activo: true,
    franjas: [
      { apertura: '11:30', cierre: '15:00' },
      { apertura: '19:30', cierre: '23:59' },
    ],
  },
  miercoles: {
    activo: true,
    franjas: [
      { apertura: '11:30', cierre: '15:00' },
      { apertura: '19:30', cierre: '23:59' },
    ],
  },
  jueves: {
    activo: true,
    franjas: [
      { apertura: '11:30', cierre: '15:00' },
      { apertura: '19:30', cierre: '23:59' },
    ],
  },
  viernes: {
    activo: true,
    franjas: [
      { apertura: '11:30', cierre: '15:00' },
      { apertura: '19:30', cierre: '01:00' },
    ],
  },
  sabado: {
    activo: true,
    franjas: [
      { apertura: '12:00', cierre: '15:30' },
      { apertura: '19:30', cierre: '01:30' },
    ],
  },
  domingo: {
    activo: true,
    franjas: [{ apertura: '19:30', cierre: '00:00' }],
  },
};

function timeToMinutes(hhmm: string): number {
  const [h, m] = (hhmm || '00:00').split(':').map((n) => parseInt(n, 10) || 0);
  return h * 60 + m;
}

export function getArgentinaTimeParts(date: Date = new Date()): {
  diaKey: DiaSemanaKey;
  diaAnteriorKey: DiaSemanaKey;
  minutosDelDia: number;
  horaActualStr: string;
} {
  // Obtener partes en zona horaria America/Argentina/Buenos_Aires
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Argentina/Buenos_Aires',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const weekday = parts.find((p) => p.type === 'weekday')?.value || 'Mon';
  const hour = parseInt(parts.find((p) => p.type === 'hour')?.value || '0', 10) % 24;
  const minute = parseInt(parts.find((p) => p.type === 'minute')?.value || '0', 10);

  const mapWeekday: Record<string, DiaSemanaKey> = {
    Mon: 'lunes',
    Tue: 'martes',
    Wed: 'miercoles',
    Thu: 'jueves',
    Fri: 'viernes',
    Sat: 'sabado',
    Sun: 'domingo',
  };

  const ordenKeys: DiaSemanaKey[] = [
    'lunes',
    'martes',
    'miercoles',
    'jueves',
    'viernes',
    'sabado',
    'domingo',
  ];

  const diaKey = mapWeekday[weekday] || 'lunes';
  const idx = ordenKeys.indexOf(diaKey);
  const diaAnteriorKey = ordenKeys[(idx + 6) % 7];

  const horaActualStr = `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  return {
    diaKey,
    diaAnteriorKey,
    minutosDelDia: hour * 60 + minute,
    horaActualStr,
  };
}

export interface ResultadoEstadoApertura {
  abierto: boolean;
  motivo: 'manual_abierto' | 'manual_cerrado' | 'horario_abierto' | 'fuera_de_horario';
  proximoHorarioTexto: string;
  franjaActualTexto: string | null;
}

export function calcularEstadoApertura(
  negocio: Partial<Negocio>,
  now: Date = new Date()
): ResultadoEstadoApertura {
  const modo = negocio.modo_apertura || 'manual';
  const abiertoManual = negocio.abierto_manual !== undefined ? negocio.abierto_manual : true;
  const horarios: HorariosSemanales =
    negocio.horarios_semanales && Object.keys(negocio.horarios_semanales).length > 0
      ? negocio.horarios_semanales
      : HORARIOS_SEMANALES_DEFAULT;

  const { diaKey, diaAnteriorKey, minutosDelDia } = getArgentinaTimeParts(now);

  // Calcular próximo horario de apertura desde ahora
  const proximoHorarioTexto = obtenerProximoHorarioApertura(horarios, diaKey, minutosDelDia);

  // Si el modo es manual, manda exclusivamente el interruptor
  if (modo === 'manual') {
    return {
      abierto: abiertoManual,
      motivo: abiertoManual ? 'manual_abierto' : 'manual_cerrado',
      proximoHorarioTexto,
      franjaActualTexto: null,
    };
  }

  // Modo automático por horarios, con el interruptor como excepción manual de cierre
  if (!abiertoManual) {
    return {
      abierto: false,
      motivo: 'manual_cerrado',
      proximoHorarioTexto,
      franjaActualTexto: null,
    };
  }

  // 1. Verificar si estamos dentro de una franja nocturna iniciada ayer que cruza medianoche
  const configAyer = horarios[diaAnteriorKey];
  if (configAyer?.activo && Array.isArray(configAyer.franjas)) {
    for (const franja of configAyer.franjas) {
      if (!franja.apertura || !franja.cierre) continue;
      const minAp = timeToMinutes(franja.apertura);
      const minCi = timeToMinutes(franja.cierre);
      // Si cierre <= apertura (ej. 19:30 a 01:30 o 00:00) y minCi > 0
      if (minCi < minAp && minCi > 0 && minutosDelDia < minCi) {
        return {
          abierto: true,
          motivo: 'horario_abierto',
          proximoHorarioTexto: `Cierra a las ${franja.cierre} hs`,
          franjaActualTexto: `${franja.apertura} a ${franja.cierre} hs`,
        };
      }
    }
  }

  // 2. Verificar franjas del día actual
  const configHoy = horarios[diaKey];
  if (configHoy?.activo && Array.isArray(configHoy.franjas)) {
    for (const franja of configHoy.franjas) {
      if (!franja.apertura || !franja.cierre) continue;
      const minAp = timeToMinutes(franja.apertura);
      const minCi = timeToMinutes(franja.cierre);

      // Si cierra a las 00:00 o cruza medianoche
      if (minCi <= minAp) {
        if (minutosDelDia >= minAp) {
          return {
            abierto: true,
            motivo: 'horario_abierto',
            proximoHorarioTexto: `Cierra a las ${franja.cierre} hs`,
            franjaActualTexto: `${franja.apertura} a ${franja.cierre} hs`,
          };
        }
      } else {
        if (minutosDelDia >= minAp && minutosDelDia < minCi) {
          return {
            abierto: true,
            motivo: 'horario_abierto',
            proximoHorarioTexto: `Cierra a las ${franja.cierre} hs`,
            franjaActualTexto: `${franja.apertura} a ${franja.cierre} hs`,
          };
        }
      }
    }
  }

  return {
    abierto: false,
    motivo: 'fuera_de_horario',
    proximoHorarioTexto,
    franjaActualTexto: null,
  };
}

function obtenerProximoHorarioApertura(
  horarios: HorariosSemanales,
  diaHoyKey: DiaSemanaKey,
  minutosActuales: number
): string {
  const ordenKeys = DIAS_SEMANA_ORDEN.map((d) => d.key);
  const startIdx = ordenKeys.indexOf(diaHoyKey);

  // Revisar hoy y los próximos 7 días
  for (let offset = 0; offset < 7; offset++) {
    const key = ordenKeys[(startIdx + offset) % 7];
    const diaConfig = horarios[key];
    if (!diaConfig || !diaConfig.activo || !Array.isArray(diaConfig.franjas)) continue;

    const franjasOrdenadas = [...diaConfig.franjas]
      .filter((f) => f.apertura && f.cierre)
      .sort((a, b) => timeToMinutes(a.apertura) - timeToMinutes(b.apertura));

    for (const franja of franjasOrdenadas) {
      const minAp = timeToMinutes(franja.apertura);
      if (offset === 0) {
        if (minAp > minutosActuales) {
          return `Abre hoy a las ${franja.apertura} hs`;
        }
      } else if (offset === 1) {
        return `Abre mañana a las ${franja.apertura} hs`;
      } else {
        const labelDia = DIAS_SEMANA_ORDEN.find((d) => d.key === key)?.label || key;
        return `Abre el ${labelDia.toLowerCase()} a las ${franja.apertura} hs`;
      }
    }
  }

  return 'Consultá nuestros próximos horarios de atención';
}
