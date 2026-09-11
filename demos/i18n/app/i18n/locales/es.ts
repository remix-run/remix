import type { Translation } from './en.ts'

export default {
  common: {
    title: 'Demostración de i18n en Remix',
    brand: 'Remix i18n',
  },
  hero: {
    tagline: 'Internacionalización aislada por petición',
    heading: 'Internacionaliza tu aplicación Remix con i18next',
    description:
      'Usa i18next directamente con instancias de traducción por petición, preferencias de idioma explícitas y la API estándar Intl.',
    welcome_user: '¡Bienvenido de nuevo, {{name}}!',
  },
  switcher: {
    label: 'Idioma preferido',
    button: 'Guardar preferencia',
    clear_preference: 'Borrar preferencia guardada',
    quick_switch: 'Ver esta página en',
  },
  detection: {
    title: 'Orden de detección de idioma',
    description: 'Esta petición resolvió su idioma utilizando el siguiente orden de prioridad:',
    step_path: '1. Ruta de URL localizada (/:locale)',
    step_cookie: '2. Cookie de preferencia (locale=...)',
    step_browser: '3. Preferencia de idioma del navegador (Accept-Language), luego inglés',
    active_source: 'Origen activo de detección',
    active_badge: 'Activo',
    source_path: 'Ruta de URL localizada (/:locale)',
    source_cookie: 'Cookie de preferencia (locale=...)',
    source_browser: 'Preferencia del navegador o inglés predeterminado',
  },
  pluralization: {
    title: 'Pluralización y conteos',
    description: 'i18next gestiona las reglas de plural según el idioma activo:',
    tasks_zero: 'No tienes tareas pendientes',
    tasks_one: 'Tienes 1 tarea pendiente',
    tasks_many: 'Tienes {{count}} tareas pendientes',
    tasks_other: 'Tienes {{count}} tareas pendientes',
    cart_zero: 'Tu carrito está vacío',
    cart_one: 'Tienes 1 artículo en tu carrito',
    cart_many: 'Tienes {{count}} artículos en tu carrito',
    cart_other: 'Tienes {{count}} artículos en tu carrito',
    cart_demo: {
      title: 'Carrito interactivo',
      quantity_label: 'Cantidad del carrito',
      decrease: 'Quitar un artículo',
      increase: 'Añadir un artículo',
      summary_label: 'Resumen del carrito',
    },
  },
  formatting: {
    title: 'Fechas y números localizados',
    description:
      'Las traducciones proporcionan los textos; las API estándar de JavaScript Intl formatean los valores para {{language}}.',
    date_label: 'Fecha (Intl.DateTimeFormat)',
    number_label: 'Número (Intl.NumberFormat)',
    currency_label: 'Valor en USD (Intl.NumberFormat)',
    relative_time_label: 'Tiempo relativo (Intl.RelativeTimeFormat)',
    preview_description:
      'Este componente del navegador recibe etiquetas traducidas y un idioma, no un traductor. Formatea valores locales sin solicitar datos al servidor.',
    preview_button: 'Aumentar el valor',
    preview_value: 'Valor formateado en el navegador',
  },
  footer: {
    note: 'Remix v3 • Desarrollado con estándares web e i18next',
  },
} satisfies Translation<'one' | 'many' | 'other'>
