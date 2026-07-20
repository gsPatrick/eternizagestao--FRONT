import styles from "./DataTable.module.css";

export default function DataTable({ columns = [], rows = [], caption, footer }) {
  return (
    <div className={styles.shell}>
      <div className={styles.scroll}>
        <table className={styles.table}>
          {caption && <caption className={styles.caption}>{caption}</caption>}
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.key} className={col.align === "right" ? styles.right : ""}>
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.id ?? index}>
                {columns.map((col) => (
                  <td key={col.key} className={col.align === "right" ? styles.right : ""}>
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
