import type { ReactNode } from "react";

import styles from "../../client/ClaimExperience.module.css";

export default function ClaimLayout({ children }: { children: ReactNode }) {
  return <div className={styles.scope}>{children}</div>;
}
