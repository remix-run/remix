import { useState } from "react";

export default function Counter() {
  let [count, setCount] = useState(0);
  return (
    <button data-test-id="counter-button" onClick={() => setCount(count + 1)}>
      {`Clicked ${count}`}
    </button>
  );
}
