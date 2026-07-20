"use client";

import { useEffect, useState } from "react";
import styles from "./PanelShell.module.css";
import Sidebar from "@/components/organisms/Sidebar/Sidebar";
import PanelHeader from "@/components/organisms/PanelHeader/PanelHeader";
import MobileTabBar from "@/components/organisms/MobileTabBar/MobileTabBar";

const STORAGE_KEY = "eterniza:sidebar-collapsed";

export default function PanelShell({ children }) {
  const [collapsed, setCollapsed] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved !== null) setCollapsed(saved === "1");
    setHydrated(true);
  }, []);

  function toggle() {
    setCollapsed((value) => {
      localStorage.setItem(STORAGE_KEY, value ? "0" : "1");
      return !value;
    });
  }

  return (
    <div className={`${styles.shell} ${hydrated ? "" : styles.noTransition}`}>
      <Sidebar collapsed={collapsed} onToggle={toggle} />
      <div className={styles.main}>
        <PanelHeader />
        <div className={styles.content}>{children}</div>
      </div>
      <MobileTabBar />
    </div>
  );
}
