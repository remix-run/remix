import type { Translation } from './en.ts'

// Unicode LTR isolates keep code examples readable inside right-to-left sentences.
export default {
  common: {
    title: 'مثال التدويل في Remix',
    brand: 'Remix i18n',
  },
  hero: {
    tagline: 'تدويل مستقل لكل طلب',
    heading: 'اجعل تطبيق Remix متعدد اللغات باستخدام i18next',
    description:
      'استخدم i18next مباشرة مع نسخة ترجمة مستقلة لكل طلب، وتفضيلات لغة صريحة، وواجهة Intl القياسية.',
    welcome_user: 'مرحبًا بعودتك، {{name}}!',
  },
  switcher: {
    label: 'اللغة المفضلة',
    button: 'حفظ التفضيل',
    clear_preference: 'مسح التفضيل المحفوظ',
    quick_switch: 'عرض هذه الصفحة باللغة',
  },
  detection: {
    title: 'ترتيب اكتشاف اللغة',
    description: 'حُددت لغة هذا الطلب وفق ترتيب الأولوية التالي:',
    step_path: '1. اللغة في مسار الرابط (\u2066/:locale\u2069)',
    step_cookie: '2. ملف تعريف ارتباط التفضيل (\u2066locale=...\u2069)',
    step_browser: '3. لغة المتصفح المفضلة (\u2066Accept-Language\u2069)، ثم الإنجليزية',
    active_source: 'مصدر اللغة الحالي',
    active_badge: 'نشط',
    source_path: 'اللغة في مسار الرابط (\u2066/:locale\u2069)',
    source_cookie: 'ملف تعريف ارتباط التفضيل (\u2066locale=...\u2069)',
    source_browser: 'لغة المتصفح المفضلة أو الإنجليزية الافتراضية',
  },
  pluralization: {
    title: 'صيغ الجمع والأعداد',
    description: 'يختار i18next صيغة الجمع وفق قواعد اللغة الحالية:',
    tasks_zero: 'ليس لديك مهام معلقة',
    tasks_one: 'لديك مهمة واحدة معلقة',
    tasks_two: 'لديك مهمتان معلقتان',
    tasks_few: 'لديك {{count}} مهام معلقة',
    tasks_many: 'لديك {{count}} مهمة معلقة',
    tasks_other: 'لديك {{count}} مهمة معلقة',
    cart_zero: 'سلة التسوق فارغة',
    cart_one: 'لديك منتج واحد في سلة التسوق',
    cart_two: 'لديك منتجان في سلة التسوق',
    cart_few: 'لديك {{count}} منتجات في سلة التسوق',
    cart_many: 'لديك {{count}} منتجًا في سلة التسوق',
    cart_other: 'لديك {{count}} منتج في سلة التسوق',
    cart_demo: {
      title: 'سلة تسوق تفاعلية',
      quantity_label: 'كمية سلة التسوق',
      decrease: 'إزالة منتج واحد',
      increase: 'إضافة منتج واحد',
      summary_label: 'ملخص سلة التسوق',
    },
  },
  formatting: {
    title: 'تنسيق التواريخ والأرقام حسب اللغة',
    description: 'توفر الترجمات النصوص، وتنسق واجهات Intl القياسية القيم للغة {{language}}.',
    date_label: 'التاريخ (\u2066Intl.DateTimeFormat\u2069)',
    number_label: 'الرقم (\u2066Intl.NumberFormat\u2069)',
    currency_label: 'القيمة بالدولار الأمريكي (\u2066Intl.NumberFormat\u2069)',
    relative_time_label: 'الوقت النسبي (\u2066Intl.RelativeTimeFormat\u2069)',
    preview_description:
      'يتلقى هذا المكون في المتصفح تسميات مترجمة ولغة، وليس دالة ترجمة. وينسق القيم المحلية من دون طلب إلى الخادم.',
    preview_button: 'زيادة القيمة',
    preview_value: 'القيمة المنسقة في المتصفح',
  },
  footer: {
    note: 'Remix v3 • مبني بمعايير الويب وi18next',
  },
} satisfies Translation<'zero' | 'one' | 'two' | 'few' | 'many' | 'other'>
