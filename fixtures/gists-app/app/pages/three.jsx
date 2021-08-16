import { useState } from "react";

export default function Page() {
  let [message, setMessage] = useState("This is page three");
  return (
    <p>
      {message}{" "}
      <button
        onClick={() => setMessage("This is page three with a new message")}
      >
        Change Message
      </button>
    </p>
  );
}
