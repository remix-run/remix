import { createDomReconciler } from '@remix-run/dom/reconciler'

createDomReconciler(document)
  .createRoot(document.body)
  .render(<b>Hello world</b>)
