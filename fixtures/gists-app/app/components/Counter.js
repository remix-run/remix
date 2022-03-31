import { useState } from "react";

import Button from "./Button";
import styles from "./Counter.module.css";

export default function Counter() {
  let [count, setCount] = useState(0);
  return (
    <Button
      data-test-id="counter-button"
      onClick={() => setCount(count + 1)}
      className={styles.button}
    >
      <span className={styles.inner}>{`Clicked ${count}`}</span>
    </Button>
  );
}
