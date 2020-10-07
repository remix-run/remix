import React from "react";

export function meta() {
  return {
    title: "Error"
  };
}

export default function FiveHundred() {
  return (
    <div data-test-id="errors/500">
      <h1>500</h1>
    </div>
  );
}
