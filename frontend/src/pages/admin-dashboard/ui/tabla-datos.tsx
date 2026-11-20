import type { ReactNode } from 'react';

export interface TablaDatosProps {
  /** Título del bloque: es el título accesible de la tabla. */
  titulo: string;
  /** Texto de cada columna; la primera identifica la fila y las demás se alinean a la derecha. */
  columnas: readonly string[];
  /** Una fila por dato: una celda por columna. */
  filas: readonly (readonly ReactNode[])[];
  /** `false` la deja fuera de la vista pero disponible para lectores de pantalla (el gráfico es lo que se ve). */
  visible: boolean;
}

/** Tabla de datos equivalente a un gráfico: es la alternativa accesible y lo que muestra «Ver como tabla». */
export function TablaDatos({ titulo, columnas, filas, visible }: TablaDatosProps) {
  const propsRegion = visible ? { role: 'region', tabIndex: 0, 'aria-label': `Tabla: ${titulo}` } : {};
  return (
    <div className={visible ? 'dtabla-wrap' : 'sr-only'} {...propsRegion}>
      <table className="dtabla">
        <caption className="sr-only">{titulo}</caption>
        <thead>
          <tr>
            {columnas.map((columna, indice) => (
              <th key={columna} scope="col" className={indice === 0 ? undefined : 'r'}>
                {columna}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((fila, indiceFila) => (
            <tr key={indiceFila}>
              {fila.map((celda, indice) =>
                indice === 0 ? (
                  <th key={indice} scope="row">
                    {celda}
                  </th>
                ) : (
                  <td key={indice} className="r">
                    {celda}
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
