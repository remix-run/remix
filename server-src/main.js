import React, { useState } from "react";
import ReactDOM from "react-dom";

import message from "./message.js";

console.log(React, useState);
console.log(ReactDOM);

// console.log(message);

if (import.meta.hot) {
  import.meta.hot.accept();
}
