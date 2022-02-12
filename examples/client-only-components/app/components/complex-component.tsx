import { useEffect, useState } from "react";

export function ComplexComponent() {
  const [count, setCount] = useState(() => {
    const stored = localStorage.getItem("count");
    if (!stored) return 0;
    return JSON.parse(stored);
  });

  useEffect(
    function sync() {
      localStorage.setItem("count", JSON.stringify(count));
    },
    [count]
  );

  return (
    <>
      <button onClick={() => setCount(c => c - 1)}>-</button>
      <span>{count}</span>
      <button onClick={() => setCount(c => c + 1)}>+</button>
    </>
  );
}
