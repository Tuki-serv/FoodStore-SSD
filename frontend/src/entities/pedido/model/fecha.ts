const dos = (numero: number): string => String(numero).padStart(2, '0');

/** `19/11/2026` en hora local; vacío si la fecha no es válida. */
export function fechaLocal(iso: string): string {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return '';
  return `${dos(fecha.getDate())}/${dos(fecha.getMonth() + 1)}/${fecha.getFullYear()}`;
}

/** `12:40` en hora local; vacío si la fecha no es válida. */
export function horaLocal(iso: string): string {
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return '';
  return `${dos(fecha.getHours())}:${dos(fecha.getMinutes())}`;
}

/** `19/11 · 12:40`: la fecha corta y la hora, para las filas del listado. */
export function fechaHoraCorta(iso: string): string {
  return `${fechaLocal(iso).slice(0, 5)} · ${horaLocal(iso)}`;
}
