import { createHotContext } from '../_hmr/client.js';
import { r as react } from '../_npm/react-947fc8fa.js';
import '../_npm/object-assign-a619a3a7.js';
import '../_npm/scheduler-47dbe5cb.js';
import '../_npm/scheduler/tracing-aff48f54.js';
import { r as reactDom } from '../_npm/react-dom-cbf3bc02.js';
import message from './message.js';

import.meta.hot = createHotContext(import.meta.url);
console.log(react, react.useState);
console.log(reactDom);
console.log(message);

if (import.meta.hot) {
  import.meta.hot.accept();
}
