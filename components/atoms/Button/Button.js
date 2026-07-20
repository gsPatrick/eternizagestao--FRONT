import styles from "./Button.module.css";
import Spinner from "@/components/atoms/Spinner/Spinner";

export default function Button({
  children,
  variant = "primary",
  size = "md",
  loading = false,
  disabled = false,
  full = false,
  iconLeft = null,
  iconRight = null,
  type = "button",
  onClick,
  ...rest
}) {
  const classes = [
    styles.button,
    styles[variant],
    styles[size],
    full ? styles.full : "",
    loading ? styles.loading : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <button
      type={type}
      className={classes}
      disabled={disabled || loading}
      onClick={onClick}
      {...rest}
    >
      {loading && (
        <Spinner size={size === "sm" ? 13 : 15} tone={variant === "primary" ? "light" : "navy"} />
      )}
      {!loading && iconLeft && <span className={styles.icon}>{iconLeft}</span>}
      <span className={styles.label}>{children}</span>
      {!loading && iconRight && <span className={styles.icon}>{iconRight}</span>}
    </button>
  );
}
