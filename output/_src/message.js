import { createHotContext } from '../_hmr/client.js';

import.meta.hot = createHotContext(import.meta.url);
let message = "it works!";

if (import.meta.hot) {
  import.meta.hot.accept();
}

export default message;
