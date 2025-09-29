import { createHandlers, html } from '@remix-run/fetch-router'

import { routes } from '../routes.ts'
import { adminMiddleware } from './middleware/admin.ts'

export const adminHandlers = createHandlers(routes.admin, [adminMiddleware], {
  dashboard() {
    return html(renderAdminDashboard())
  },
  books() {
    return html(renderBookManagement())
  },
  users() {
    return html(renderUserManagement())
  },
  orders() {
    return html(renderOrderManagement())
  },
})

function renderAdminDashboard() {
  return `
    <html>
      <head><title>Admin Dashboard - Bookstore</title></head>
      <body>
        <h1>🛠️ Admin Dashboard</h1>
        <nav>
          <a href="/admin/books">Manage Books</a> |
          <a href="/admin/users">Manage Users</a> |
          <a href="/admin/orders">Manage Orders</a>
        </nav>
        <div>
          <h2>📊 Quick Stats</h2>
          <p>📚 Total Books: 1,247</p>
          <p>👥 Total Users: 892</p>
          <p>📦 Pending Orders: 23</p>
          <p>💰 Revenue Today: $1,234.56</p>
        </div>
      </body>
    </html>
  `
}

function renderBookManagement() {
  return `
    <html>
      <head><title>Book Management - Admin</title></head>
      <body>
        <h1>📚 Book Management</h1>
        <p><a href="/blog/new">Add New Book</a></p>
        <table>
          <tr><th>ISBN</th><th>Title</th><th>Author</th><th>Price</th><th>Actions</th></tr>
          <tr><td>978-0-123456-78-9</td><td>The Great Novel</td><td>Author One</td><td>$19.99</td><td><a href="/books/978-0-123456-78-9">Edit</a></td></tr>
          <tr><td>978-0-987654-32-1</td><td>Programming Guide</td><td>Author Two</td><td>$29.99</td><td><a href="/books/978-0-987654-32-1">Edit</a></td></tr>
        </table>
      </body>
    </html>
  `
}

function renderUserManagement() {
  return `
    <html>
      <head><title>User Management - Admin</title></head>
      <body>
        <h1>👥 User Management</h1>
        <table>
          <tr><th>ID</th><th>Name</th><th>Email</th><th>Orders</th><th>Actions</th></tr>
          <tr><td>1</td><td>John Doe</td><td>john@example.com</td><td>3</td><td><a href="/users/1">View</a></td></tr>
          <tr><td>2</td><td>Jane Smith</td><td>jane@example.com</td><td>7</td><td><a href="/users/2">View</a></td></tr>
        </table>
      </body>
    </html>
  `
}

function renderOrderManagement() {
  return `
    <html>
      <head><title>Order Management - Admin</title></head>
      <body>
        <h1>📦 Order Management</h1>
        <table>
          <tr><th>Order ID</th><th>Customer</th><th>Total</th><th>Status</th><th>Actions</th></tr>
          <tr><td>12345</td><td>John Doe</td><td>$49.98</td><td>Delivered</td><td><a href="/orders/12345">View</a></td></tr>
          <tr><td>12346</td><td>Jane Smith</td><td>$24.99</td><td>Shipped</td><td><a href="/orders/12346">View</a></td></tr>
        </table>
      </body>
    </html>
  `
}
