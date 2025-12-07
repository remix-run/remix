/**
 * Base user type for authentication
 *
 * Includes commonly needed fields for auth flows (emails, display, etc.)
 */
export interface AuthUser {
  id: string
  email: string
  name: string
  image?: string
  emailVerified: boolean
  createdAt: Date
  updatedAt: Date
}
