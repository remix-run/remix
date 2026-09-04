import type { Translation } from './en.ts'

export default {
  common: {
    title: 'Remix i18n デモ',
    brand: 'Remix i18n',
  },
  hero: {
    tagline: 'リクエスト単位で安全な国際化',
    heading: 'i18next で Remix アプリを多言語対応',
    description:
      'リクエスト単位の翻訳インスタンス、明示的な言語設定、標準 Intl API を使って i18next を直接統合します。',
    welcome_user: 'お帰りなさい、{{name}} さん！',
  },
  switcher: {
    label: '言語を選択',
    button: '変更',
    clear_preference: '保存した設定をクリア',
    quick_switch: 'クイック切り替え',
  },
  detection: {
    title: '言語検出の優先順位',
    description: 'このリクエストは以下の優先順位で言語を特定しました：',
    step_path: '1. ローカライズされた URL パス (/:locale)',
    step_cookie: '2. ユーザー設定クッキー (locale=...)',
    step_header: '3. ブラウザーの言語設定 (Accept-Language)',
    active_source: '検出元',
    active_badge: '使用中',
    source_path: 'ローカライズされた URL パス (/:locale)',
    source_cookie: 'ユーザー設定クッキー (locale=...)',
    source_header: 'ブラウザーの言語設定 (Accept-Language)',
    source_fallback: 'デフォルトのフォールバック言語',
  },
  pluralization: {
    title: '複数形とカウント',
    description: 'i18next がアクティブな言語ルールに基づいて複数形を処理します：',
    tasks_zero: '保留中のタスクはありません',
    tasks_one: '1 件の保留中タスクがあります',
    tasks_other: '{{count}} 件の保留中タスクがあります',
    cart_zero: 'カートは空です',
    cart_one: 'カートに 1 個の商品があります',
    cart_other: 'カートに {{count}} 個の商品があります',
  },
  formatting: {
    title: 'ロケールに応じた日付と数値',
    description:
      'テキストは翻訳リソースが担当し、値は標準 JavaScript Intl API が {{language}} に合わせて整形します。',
    date_label: '日時 (Intl.DateTimeFormat)',
    number_label: '数値 (Intl.NumberFormat)',
    currency_label: 'USD の値 (Intl.NumberFormat)',
    relative_time_label: '相対時間 (Intl.RelativeTimeFormat)',
  },
  footer: {
    note: 'Remix v3 • Web 標準と i18next で構築',
  },
} satisfies Translation
