import { Authenticator } from 'remix-auth'
import { EmailLinkStrategy } from 'remix-auth-email-link'
import type { User } from '~/models/User';
import { getUser } from '~/models/User'
import { mySessionStorage } from '~/services/session.server'

export const authenticator = new Authenticator<User>(mySessionStorage)

export const EMAIL_LINK = 'email-link'

authenticator.use(
  new EmailLinkStrategy<User>(
    {
      callbackURL: '/magic',
      secret: 'my-super-secret-token', // This should be an env variable
      validateSessionMagicLink: true,
      sendEmail: async ({
        emailAddress,
        magicLink,
      }: {
        emailAddress: string
        magicLink: string
        user?: User | null
        domainUrl: string
      }) => {
        // You should send a mail here.
        console.log(`sending a mail to email: ${emailAddress}`)
        console.log("magicLink", magicLink)              
      },
    },
    ({ email }) => {
      return getUser({email})
    }
  ),
  EMAIL_LINK
)
