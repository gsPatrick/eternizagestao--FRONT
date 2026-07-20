"use client";

import { useState } from "react";
import styles from "./Tabs.module.css";

export default function Tabs({ items = [], defaultIndex = 0, onChange }) {
  const [active, setActive] = useState(defaultIndex);

  function select(index) {
    setActive(index);
    if (onChange) onChange(index);
  }

  return (
    <div>
      <div className={styles.list} role="tablist">
        {items.map((item, index) => (
          <button
            key={item.label}
            role="tab"
            aria-selected={active === index}
            className={`${styles.tab} ${active === index ? styles.active : ""}`}
            onClick={() => select(index)}
          >
            {item.label}
            {item.count !== undefined && <span className={styles.count}>{item.count}</span>}
          </button>
        ))}
      </div>
      {items[active]?.content && <div className={styles.panel}>{items[active].content}</div>}
    </div>
  );
}
