import { html } from '@remix-run/fetch-router'
import type { RouteHandlers } from '@remix-run/fetch-router'

import { routes } from '../routes.ts'
import { USER_KEY } from './middleware/auth.ts'
import type { User } from './models/users.ts'
import { layout } from './views/layout.ts'

export default {
  home({ storage }) {
    let user: User | null = null
    try {
      user = storage.get(USER_KEY)
    } catch {
      // USER_KEY not set (user not authenticated)
    }

    let content = `
    <div class="card">
      <h1>Welcome to the Bookstore</h1>
      <p style="margin: 1rem 0;">
        Discover your next favorite book from our curated collection of fiction, non-fiction, and more.
      </p>
      <p>
        <a href="${routes.books.index.href()}" class="btn">Browse Books</a>
      </p>
    </div>

    <h2 style="margin: 2rem 0 1rem;">Featured Books</h2>
    <div class="grid">
      <div class="book-card">
        <img src="https://via.placeholder.com/280x300?text=The+Midnight+Library" alt="The Midnight Library">
        <div class="book-card-body">
          <h3>The Midnight Library</h3>
          <p class="author">by Matt Haig</p>
          <p class="price">$16.99</p>
          <a href="${routes.books.show.href({ slug: 'the-midnight-library' })}" class="btn">View Details</a>
        </div>
      </div>
      <div class="book-card">
        <img src="https://via.placeholder.com/280x300?text=Project+Hail+Mary" alt="Project Hail Mary">
        <div class="book-card-body">
          <h3>Project Hail Mary</h3>
          <p class="author">by Andy Weir</p>
          <p class="price">$28.99</p>
          <a href="${routes.books.show.href({ slug: 'project-hail-mary' })}" class="btn">View Details</a>
        </div>
      </div>
      <div class="book-card">
        <img src="https://via.placeholder.com/280x300?text=Atomic+Habits" alt="Atomic Habits">
        <div class="book-card-body">
          <h3>Atomic Habits</h3>
          <p class="author">by James Clear</p>
          <p class="price">$27.00</p>
          <a href="${routes.books.show.href({ slug: 'atomic-habits' })}" class="btn">View Details</a>
        </div>
      </div>
    </div>
  `

    return html(layout(content, user))
  },

  about({ storage }) {
    let user: User | null = null
    try {
      user = storage.get(USER_KEY)
    } catch {
      // USER_KEY not set (user not authenticated)
    }

    let content = `
    <div class="card">
      <h1>About Our Bookstore</h1>
      <p style="margin: 1rem 0;">
        Welcome to our online bookstore, a demo application built to showcase the capabilities of
        <strong>fetch-router</strong> - a powerful, type-safe routing library for web applications.
      </p>
      
      <h2 style="margin: 1.5rem 0 0.5rem;">What This Demo Shows</h2>
      <ul style="margin-left: 2rem; line-height: 2;">
        <li><strong>Resource Routes:</strong> Full RESTful CRUD operations</li>
        <li><strong>Nested Routes:</strong> Deep route hierarchies with type safety</li>
        <li><strong>Custom Parameters:</strong> Flexible parameter naming (slug, orderId, etc.)</li>
        <li><strong>HTTP Methods:</strong> GET, POST, PUT, DELETE properly used</li>
        <li><strong>Middleware:</strong> Authentication and authorization</li>
        <li><strong>Type Safety:</strong> End-to-end type checking for routes and handlers</li>
      </ul>

      <h2 style="margin: 1.5rem 0 0.5rem;">Try It Out</h2>
      <p style="margin: 1rem 0;">
        Explore the site to see all these features in action. You can browse books, create an account,
        add items to your cart, and even access the admin panel (login as admin@bookstore.com / admin123).
      </p>

      <p style="margin-top: 2rem;">
        <a href="${routes.books.index.href()}" class="btn">Explore Books</a>
        <a href="${routes.auth.register.href()}" class="btn btn-secondary" style="margin-left: 1rem;">Create Account</a>
      </p>
    </div>
  `

    return html(layout(content, user))
  },

  contact({ storage }) {
    let user: User | null = null
    try {
      user = storage.get(USER_KEY)
    } catch {
      // USER_KEY not set (user not authenticated)
    }

    let content = `
    <div class="card">
      <h1>Contact Us</h1>
      <p style="margin: 1rem 0;">Have a question or feedback? We'd love to hear from you!</p>
      
      <form method="POST" action="${routes.contactSubmit.href()}">
        <div class="form-group">
          <label for="name">Name</label>
          <input type="text" id="name" name="name" required>
        </div>
        
        <div class="form-group">
          <label for="email">Email</label>
          <input type="email" id="email" name="email" required>
        </div>
        
        <div class="form-group">
          <label for="message">Message</label>
          <textarea id="message" name="message" required></textarea>
        </div>
        
        <button type="submit" class="btn">Send Message</button>
      </form>
    </div>
  `

    return html(layout(content, user))
  },

  async contactSubmit({ storage }) {
    let user: User | null = null
    try {
      user = storage.get(USER_KEY)
    } catch {
      // USER_KEY not set (user not authenticated)
    }

    // In a real app, you would process the form and send an email
    // For demo purposes, just show a success message

    let content = `
    <div class="alert alert-success">
      Thank you for your message! We'll get back to you soon.
    </div>
    <div class="card">
      <p>
        <a href="${routes.home.href()}" class="btn">Return Home</a>
      </p>
    </div>
  `

    return html(layout(content, user))
  },
} satisfies Pick<RouteHandlers<typeof routes>, 'home' | 'about' | 'contact' | 'contactSubmit'>
