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
    label: 'Seleccionar idioma',
    button: 'Cambiar',
    clear_preference: 'Borrar preferencia guardada',
    quick_switch: 'Cambio rápido',
  },
  detection: {
    title: 'Orden de detección de idioma',
    description: 'Esta petición resolvió su idioma utilizando el siguiente orden de prioridad:',
    step_path: '1. Ruta de URL localizada (/:locale)',
    step_cookie: '2. Cookie de preferencia (locale=...)',
    step_header: '3. Preferencia de idioma del navegador (Accept-Language)',
    active_source: 'Origen activo de detección',
    active_badge: 'Activo',
    source_path: 'Ruta de URL localizada (/:locale)',
    source_cookie: 'Cookie de preferencia (locale=...)',
    source_header: 'Preferencia de idioma del navegador (Accept-Language)',
    source_fallback: 'Idioma de respaldo predeterminado',
  },
  pluralization: {
    title: 'Pluralización y conteos',
    description: 'i18next gestiona las reglas de plural según el idioma activo:',
    tasks_zero: 'No tienes tareas pendientes',
    tasks_one: 'Tienes 1 tarea pendiente',
    tasks_other: 'Tienes {{count}} tareas pendientes',
    cart_zero: 'Tu carrito está vacío',
    cart_one: 'Tienes 1 artículo en tu carrito',
    cart_other: 'Tienes {{count}} artículos en tu carrito',
  },
  formatting: {
    title: 'Fechas y números localizados',
    description:
      'Las traducciones proporcionan los textos; las API estándar de JavaScript Intl formatean los valores para {{language}}.',
    date_label: 'Fecha (Intl.DateTimeFormat)',
    number_label: 'Número (Intl.NumberFormat)',
    currency_label: 'Valor en USD (Intl.NumberFormat)',
    relative_time_label: 'Tiempo relativo (Intl.RelativeTimeFormat)',
  },
  footer: {
    note: 'Remix v3 • Desarrollado con estándares web e i18next',
  },
} satisfies Translation
