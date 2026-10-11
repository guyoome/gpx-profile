import type { ReactNode } from "react";
import styles from "./Card.module.css";

let cardSeq = 0;

type Props = {
  /** Section title, rendered as an H2 in the condensed heading font. */
  title: string;
  /** Optional small icon shown to the left of the title. */
  icon?: ReactNode;
  /** Panel-level actions, shown on the right of the header (stay visible). */
  actions?: ReactNode;
  /** Optional single line of helper text under the title. */
  helper?: ReactNode;
  /** Stable id prefix for aria wiring; auto-generated when omitted. */
  idBase?: string;
  children: ReactNode;
};

/**
 * Reusable editor panel. Shares the card design tokens so Preview, Style,
 * Markers — and any future panel — read as one family (FR-1, FR-3, FR-7).
 */
export default function Card({ title, icon, actions, helper, idBase, children }: Props) {
  const base = idBase ?? `card-${++cardSeq}`;
  const titleId = `${base}-title`;

  return (
    <section className={styles.card} aria-labelledby={titleId}>
      <div className={styles.header}>
        <div className={styles.titleWrap}>
          <h2 id={titleId} className={styles.title}>
            {icon && (
              <span className={styles.icon} aria-hidden="true">
                {icon}
              </span>
            )}
            {title}
          </h2>
          {helper && <p className={styles.helper}>{helper}</p>}
        </div>
        {actions && <div className={styles.actions}>{actions}</div>}
      </div>
      <div className={styles.body}>{children}</div>
    </section>
  );
}
