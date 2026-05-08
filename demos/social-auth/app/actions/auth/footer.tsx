import * as styles from '../../ui/styles.ts'

export function Footer() {
  return ({ prefix, href, label }: { prefix: string; href: string; label: string }) => (
    <p mix={styles.footerText}>
      {prefix}{' '}
      <a href={href} mix={styles.helperLink}>
        {label}
      </a>
    </p>
  )
}
