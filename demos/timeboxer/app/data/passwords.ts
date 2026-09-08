import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const scrypt = promisify(scryptCallback)
const keyLength = 64

export async function hashPassword(password: string): Promise<string> {
  let salt = randomBytes(16).toString('hex')
  let derivedKey = (await scrypt(password, salt, keyLength)) as Buffer

  return `scrypt:${keyLength}:${salt}:${derivedKey.toString('hex')}`
}

export async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  let [algorithm, keyLengthValue, salt, expectedValue] = storedHash.split(':')
  let length = Number.parseInt(keyLengthValue ?? '', 10)

  if (algorithm !== 'scrypt' || !salt || !expectedValue || !Number.isInteger(length)) {
    return false
  }

  let expected = Buffer.from(expectedValue, 'hex')
  let actual = (await scrypt(password, salt, length)) as Buffer

  return expected.length === actual.length && timingSafeEqual(expected, actual)
}
