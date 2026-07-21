import styles from "./DataTable.module.css";

/**
 * Classes da célula. `nowrap` existe para códigos curtos (quadra, lote, gaveta,
 * matrícula): quebrados no meio viram "B-" / "R1-" / "L3" em três linhas e o
 * operador não consegue ler o código de uma vez.
 */
function cellClass(col, css) {
  return [col.align === "right" ? css.right : "", col.nowrap ? css.nowrap : ""]
    .filter(Boolean)
    .join(" ");
}

export default function DataTable({ columns = [], rows = [], caption, footer }) {
  return (
    <div className={styles.shell}>
      <div className={styles.scroll}>
        <table className={styles.table}>
          {caption && <caption className={styles.caption}>{caption}</caption>}
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cellClass(col, styles)}
                  style={col.minWidth ? { minWidth: col.minWidth } : undefined}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.id ?? index}>
                {columns.map((col) => (
                  <td key={col.key} className={cellClass(col, styles)}>
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {footer && <div className={styles.footer}>{footer}</div>}
    </div>
  );
}
