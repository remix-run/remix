import * as styles from '../../ui/styles.ts'

export function LoginFooter() {
  return ({ signupHref }: { signupHref: string }) => (
    <p mix={styles.footerText}>
      Don't have an account?{' '}
      <a href={signupHref} mix={styles.helperLink}>
        Sign up
      </a>
    </p>
  )
}
