import React from "react";

export function meta() {
  return {
    title: "Ain't nothing here"
  };
}

export default function FourOhFour() {
  return (
    <div data-test-id="errors/404">
      <h1>404</h1>
    </div>
  );
}
