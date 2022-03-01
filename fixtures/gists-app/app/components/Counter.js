import { useState } from "react";

import styles from "./Counter.module.css";

export default function Counter() {
  let [count, setCount] = useState(0);
  return (
    <button
      data-test-id="counter-button"
      onClick={() => setCount(count + 1)}
      className={styles.button}
    >
      {`Clicked ${count}`}
    </button>
  );
}
