import { createHandlers, html } from '@remix-run/fetch-router'

import { routes } from '../routes.ts'
import { authMiddleware } from './middleware/auth.ts'
import { adminMiddleware } from './middleware/admin.ts'

export const usersHandlers = createHandlers(routes.users, [authMiddleware, adminMiddleware], {
  index() {
    return html(renderUserList())
  },
  show({ params }) {
    return html(renderUserProfile(params.id))
  },
  new() {
    return html(renderSignupForm())
  },
  async create({ request }) {
    let user = await request.json()
    return new Response(`User created: ${user.email}`, { status: 201 })
  },
  edit({ params }) {
    return html(renderUserEditForm(params.id))
  },
  async update({ params, request }) {
    let updates = await request.json()
    return new Response(`User ${params.id} updated`)
  },
  destroy({ params }) {
    return new Response(`User ${params.id} deleted`)
  },
})

function renderUserList() {
  return `
    <html>
      <head><title>Users - Admin</title></head>
      <body>
        <h1>👥 User Management</h1>
        <p><a href="/users/new">Add New User</a></p>
        <table>
          <tr><th>ID</th><th>Name</th><th>Email</th><th>Actions</th></tr>
          <tr><td>1</td><td>John Doe</td><td>john@example.com</td><td><a href="/users/1">View</a> | <a href="/users/1/edit">Edit</a></td></tr>
          <tr><td>2</td><td>Jane Smith</td><td>jane@example.com</td><td><a href="/users/2">View</a> | <a href="/users/2/edit">Edit</a></td></tr>
        </table>
      </body>
    </html>
  `
}

function renderUserProfile(id: string) {
  return `
    <html>
      <head><title>User ${id} - Profile</title></head>
      <body>
        <h1>👤 User Profile</h1>
        <h2>User ID: ${id}</h2>
        <p><strong>Name:</strong> Sample User</p>
        <p><strong>Email:</strong> user${id}@example.com</p>
        <p><strong>Member Since:</strong> 2023</p>
        <p><strong>Orders:</strong> <a href="/orders">View Order History</a></p>
        <p><a href="/users/${id}/edit">Edit Profile</a></p>
      </body>
    </html>
  `
}

function renderSignupForm() {
  return `
    <html>
      <head><title>New User - Admin</title></head>
      <body>
        <h1>➕ Add New User</h1>
        <form>
          <p><label>Name: <input name="name" required></label></p>
          <p><label>Email: <input name="email" type="email" required></label></p>
          <p><label>Password: <input name="password" type="password" required></label></p>
          <p><button type="submit">Create User</button></p>
        </form>
      </body>
    </html>
  `
}

function renderUserEditForm(id: string) {
  return `
    <html>
      <head><title>Edit User ${id} - Admin</title></head>
      <body>
        <h1>✏️ Edit User ${id}</h1>
        <form>
          <p><label>Name: <input name="name" value="Sample User ${id}"></label></p>
          <p><label>Email: <input name="email" value="user${id}@example.com"></label></p>
          <p><button type="submit">Update User</button></p>
          <p><button type="button" style="color: red;">Delete User</button></p>
        </form>
      </body>
    </html>
  `
}
