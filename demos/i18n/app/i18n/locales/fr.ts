import type { Translation } from './en.ts'

export default {
  common: {
    title: 'Démo i18n dans Remix',
    brand: 'Remix i18n',
  },
  hero: {
    tagline: 'Internationalisation isolée par requête',
    heading: 'Internationalisez votre application Remix avec i18next',
    description:
      'Utilisez i18next directement avec des instances de traduction par requête, des préférences de langue explicites et l’API standard Intl.',
    welcome_user: 'Bon retour, {{name}} !',
  },
  switcher: {
    label: 'Choisir la langue',
    button: 'Changer',
    clear_preference: 'Effacer la préférence enregistrée',
    quick_switch: 'Changement rapide',
  },
  detection: {
    title: 'Ordre de détection de la langue',
    description: 'Cette requête a résolu sa langue selon l’ordre de priorité suivant :',
    step_path: '1. Chemin d’URL localisé (/:locale)',
    step_cookie: '2. Cookie de préférence (locale=...)',
    step_header: '3. Préférence linguistique du navigateur (Accept-Language)',
    active_source: 'Source active de détection',
    active_badge: 'Actif',
    source_path: 'Chemin d’URL localisé (/:locale)',
    source_cookie: 'Cookie de préférence (locale=...)',
    source_header: 'Préférence linguistique du navigateur (Accept-Language)',
    source_fallback: 'Langue de repli par défaut',
  },
  pluralization: {
    title: 'Pluralisation et décomptes',
    description: 'i18next gère les règles de pluriel selon la langue active :',
    tasks_zero: 'Vous n’avez aucune tâche en attente',
    tasks_one: 'Vous avez 1 tâche en attente',
    tasks_other: 'Vous avez {{count}} tâches en attente',
    cart_zero: 'Votre panier est vide',
    cart_one: 'Vous avez 1 article dans votre panier',
    cart_other: 'Vous avez {{count}} articles dans votre panier',
  },
  formatting: {
    title: 'Dates et nombres localisés',
    description:
      'Les traductions fournissent les textes ; les API standard JavaScript Intl formatent les valeurs pour {{language}}.',
    date_label: 'Date (Intl.DateTimeFormat)',
    number_label: 'Nombre (Intl.NumberFormat)',
    currency_label: 'Valeur en USD (Intl.NumberFormat)',
    relative_time_label: 'Temps relatif (Intl.RelativeTimeFormat)',
  },
  footer: {
    note: 'Remix v3 • Conçu avec les standards web et i18next',
  },
} satisfies Translation
