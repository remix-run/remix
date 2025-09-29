import type { RequestContext } from '@remix-run/fetch-router'

import { routes } from '../routes.ts'
import { html } from './utils/response.ts'

export function homeHandler() {
  return html(renderHomePage())
}

export function aboutHandler() {
  return html(renderAboutPage())
}

export function pricingHandler() {
  return html(renderPricingPage())
}

export const contactHandlers = {
  get() {
    return html(renderContactForm())
  },
  async post({ request }: RequestContext) {
    let formData = await request.formData()
    let name = formData.get('name')
    let email = formData.get('email')

    return new Response(`Thank you ${name}! We'll respond to ${email} soon.`)
  },
}

// Simple HTML rendering functions
function renderHomePage() {
  return `
    <html>
      <head><title>📚 Bookstore</title></head>
      <body>
        <h1>Welcome to Our Bookstore</h1>
        <p>Discover amazing books and authors!</p>
        <nav>
          <a href="${routes.books.catalog.href()}">Browse Books</a> |
          <a href="${routes.blog.index.href()}">Blog</a> |
          <a href="${routes.about.href()}">About</a> |
          <a href="${routes.contact.href()}">Contact</a> |
          <a href="${routes.auth.login.href()}">Login</a> |
          <a href="${routes.auth.signup.href()}">Sign Up</a>
        </nav>
      </body>
    </html>
  `
}

function renderAboutPage() {
  return `
    <html>
      <head><title>About - Bookstore</title></head>
      <body>
        <h1>About Our Bookstore</h1>
        <p>We've been selling quality books since 1995.</p>
        <p>Our mission is to connect readers with great stories.</p>
      </body>
    </html>
  `
}

function renderContactForm() {
  return `
    <html>
      <head><title>Contact - Bookstore</title></head>
      <body>
        <h1>Contact Us</h1>
        <form method="POST">
          <p><label>Name: <input name="name" required></label></p>
          <p><label>Email: <input name="email" type="email" required></label></p>
          <p><label>Message: <textarea name="message" required></textarea></label></p>
          <p><button type="submit">Send Message</button></p>
        </form>
      </body>
    </html>
  `
}

function renderPricingPage() {
  return `
    <html>
      <head><title>Pricing - Bookstore</title></head>
      <body>
        <h1>Pricing</h1>
        <p>📖 Paperbacks: $12.99</p>
        <p>📚 Hardcovers: $24.99</p>
        <p>📱 E-books: $9.99</p>
        <p>🎧 Audiobooks: $14.99</p>
      </body>
    </html>
  `
}
