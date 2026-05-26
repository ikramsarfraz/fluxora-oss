"use client";

import { useEffect, useState } from "react";

import styles from "./legal-doc-shell.module.css";

export type LegalTocItem = { id: string; label: string };

export function LegalTocScrollspy({ items }: { items: LegalTocItem[] }) {
  const [activeId, setActiveId] = useState<string>(items[0]?.id ?? "");

  useEffect(() => {
    if (items.length === 0) return;
    const sections = items
      .map((item) => document.getElementById(item.id))
      .filter((el): el is HTMLElement => el !== null);
    if (sections.length === 0) return;

    function update() {
      const y = window.scrollY + 140;
      let idx = 0;
      sections.forEach((s, i) => {
        if (s.offsetTop <= y) idx = i;
      });
      setActiveId(sections[idx]?.id ?? "");
    }

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, [items]);

  return (
    <ol className={styles.tocList}>
      {items.map((item) => {
        const isActive = item.id === activeId;
        return (
          <li key={item.id} className={styles.tocItem}>
            <a
              href={`#${item.id}`}
              className={styles.tocLink}
              aria-current={isActive ? "true" : undefined}
            >
              <span>{item.label}</span>
            </a>
          </li>
        );
      })}
    </ol>
  );
}
