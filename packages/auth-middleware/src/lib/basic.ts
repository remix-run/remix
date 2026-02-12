import type { AuthMethod, Profile, RestoredContext } from './auth-client.ts'

const TYPE = 'basic'

type BasicProfile = Profile<typeof TYPE> & {
  username: string
}

type BasicContext = RestoredContext<typeof TYPE>

export function basicAuthMethod({
  users,
}: {
  users: Record<string, string>
}): AuthMethod<
  typeof TYPE,
  BasicProfile,
  unknown,
  { username: string; password: string },
  BasicContext
> {
  return {
    type: TYPE,
    profile(userId) {
      return {
        type: TYPE,
        username: userId.slice(6),
      }
    },
    async restore(userId, request) {
      let credentials = parseCredentials(request.headers.get('Authorization'))

      if (
        credentials &&
        users[credentials.username] &&
        users[credentials.username] === credentials.password
      ) {
        return {
          type: TYPE,
          userId: `basic:` + credentials.username,
        }
      }

      if (userId?.startsWith('basic:') && users[userId.slice(6)]) {
        return {
          type: TYPE,
          userId,
        }
      }

      return {
        type: TYPE,
      }
    },
    authorize() {
      throw new Error('authorize() is not supported for basic auth')
    },
    callback({ username, password }) {
      if (users[username] && users[username] === password) {
        return {
          type: TYPE,
          id: 'basic:' + username,
        }
      }
      return null
    },
  }
}

const CREDENTIALS_REGEXP = /^ *(?:[Bb][Aa][Ss][Ii][Cc]) +([A-Za-z0-9._~+/-]+=*) *$/
const USER_PASS_REGEXP = /^([^:]*):(.*)$/

function parseCredentials(str: string | null | undefined) {
  if (typeof str !== 'string') {
    return null
  }

  // parse header
  let match = CREDENTIALS_REGEXP.exec(str)

  if (!match) {
    return null
  }

  // decode user pass
  let userPass = USER_PASS_REGEXP.exec(atob(match[1]))

  if (!userPass) {
    return null
  }

  // return credentials object
  return { username: userPass[1], password: userPass[2] }
}
