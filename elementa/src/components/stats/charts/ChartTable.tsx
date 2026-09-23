export interface ChartTableProps {
  caption: string;
  headers: readonly [string, string];
  rows: ReadonlyArray<readonly [string, string]>;
}

/**
 * Tabla visualmente oculta con los datos de un gráfico (equivalente accesible).
 * El `sr-only` va en un envoltorio: una `<table>` no se encoge a 1 px y ensancharía la página.
 * Su contenedor debe ser `relative`.
 */
export function ChartTable({ caption, headers, rows }: ChartTableProps) {
  return (
    <div className="sr-only">
      <table>
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">{headers[0]}</th>
            <th scope="col">{headers[1]}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, value], i) => (
            <tr key={`${label}-${i}`}>
              <th scope="row">{label}</th>
              <td>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
