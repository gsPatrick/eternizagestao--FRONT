import styles from "./Skeleton.module.css";

/**
 * Placeholder com shimmer, alinhado aos tokens da marca.
 *
 * @param {'line'|'block'|'card'|'row'|'circle'} [variant='line']
 * @param {string|number} [width]   ex.: '60%' ou 220
 * @param {string|number} [height]  sobrescreve a altura padrão da variante
 * @param {number} [count=1]        repete o bloco N vezes (listas/linhas)
 * @param {string} [className]
 */
export default function Skeleton({
  variant = "line",
  width,
  height,
  count = 1,
  className = "",
  ...rest
}) {
  const style = {};
  if (width !== undefined) style.width = typeof width === "number" ? `${width}px` : width;
  if (height !== undefined) style.height = typeof height === "number" ? `${height}px` : height;

  const items = Array.from({ length: Math.max(1, count) });

  return (
    <>
      {items.map((_, i) => (
        <span
          key={i}
          aria-hidden="true"
          className={`${styles.skeleton} ${styles[variant] || ""} ${className}`.trim()}
          style={style}
          {...rest}
        />
      ))}
    </>
  );
}
