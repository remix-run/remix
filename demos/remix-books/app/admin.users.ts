import { html } from '@remix-run/fetch-router'
import type { RouteHandlers } from '@remix-run/fetch-router'

import { routes } from '../routes.ts'
import { layout, escapeHtml, redirect } from './views/layout.ts'
import { USER_KEY } from './middleware/auth.ts'
import { getAllUsers, getUserById, updateUser, deleteUser } from './models/users.ts'

export default {
  index({ storage }) {
    let user = storage.get(USER_KEY)
    let users = getAllUsers()

    let usersHtml = `
    <table>
      <thead>
        <tr>
          <th>Name</th>
          <th>Email</th>
          <th>Role</th>
          <th>Created</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${users
          .map(
            (u) => `
          <tr>
            <td>${escapeHtml(u.name)}</td>
            <td>${escapeHtml(u.email)}</td>
            <td><span class="badge ${u.role === 'admin' ? 'badge-info' : 'badge-success'}">${u.role}</span></td>
            <td>${u.createdAt.toLocaleDateString()}</td>
            <td class="actions">
              <a href="${routes.admin.users.edit.href({ userId: u.id })}" class="btn btn-secondary" style="font-size: 0.875rem; padding: 0.25rem 0.5rem;">Edit</a>
              ${
                u.id !== user.id
                  ? `
              <form method="POST" action="${routes.admin.users.destroy.href({ userId: u.id })}" style="display: inline;">
                <button type="submit" class="btn btn-danger" style="font-size: 0.875rem; padding: 0.25rem 0.5rem;" onclick="return confirm('Are you sure?')">Delete</button>
              </form>
              `
                  : ''
              }
            </td>
          </tr>
        `,
          )
          .join('')}
      </tbody>
    </table>
  `

    let content = `
    <h1>Manage Users</h1>
    
    <p style="margin-bottom: 1rem;">
      <a href="${routes.admin.index.href()}" class="btn btn-secondary">Back to Dashboard</a>
    </p>

    <div class="card">
      ${usersHtml}
    </div>
  `

    return html(layout(content, user))
  },

  show({ storage, params }) {
    let user = storage.get(USER_KEY)
    let targetUser = getUserById(params.userId)

    if (!targetUser) {
      return html(layout('<div class="card"><h1>User Not Found</h1></div>', user), { status: 404 })
    }

    let content = `
    <h1>User Details</h1>
    
    <div class="card">
      <p><strong>Name:</strong> ${escapeHtml(targetUser.name)}</p>
      <p><strong>Email:</strong> ${escapeHtml(targetUser.email)}</p>
      <p><strong>Role:</strong> <span class="badge ${targetUser.role === 'admin' ? 'badge-info' : 'badge-success'}">${targetUser.role}</span></p>
      <p><strong>Created:</strong> ${targetUser.createdAt.toLocaleDateString()}</p>
      
      <div style="margin-top: 2rem;">
        <a href="${routes.admin.users.edit.href({ userId: targetUser.id })}" class="btn">Edit</a>
        <a href="${routes.admin.users.index.href()}" class="btn btn-secondary" style="margin-left: 0.5rem;">Back to List</a>
      </div>
    </div>
  `

    return html(layout(content, user))
  },

  edit({ storage, params }) {
    let user = storage.get(USER_KEY)
    let targetUser = getUserById(params.userId)

    if (!targetUser) {
      return html(layout('<div class="card"><h1>User Not Found</h1></div>', user), { status: 404 })
    }

    let content = `
    <h1>Edit User</h1>
    
    <div class="card">
      <form method="POST" action="${routes.admin.users.update.href({ userId: targetUser.id })}">
        <div class="form-group">
          <label for="name">Name</label>
          <input type="text" id="name" name="name" value="${escapeHtml(targetUser.name)}" required>
        </div>
        
        <div class="form-group">
          <label for="email">Email</label>
          <input type="email" id="email" name="email" value="${escapeHtml(targetUser.email)}" required>
        </div>
        
        <div class="form-group">
          <label for="role">Role</label>
          <select id="role" name="role">
            <option value="customer" ${targetUser.role === 'customer' ? 'selected' : ''}>Customer</option>
            <option value="admin" ${targetUser.role === 'admin' ? 'selected' : ''}>Admin</option>
          </select>
        </div>
        
        <button type="submit" class="btn">Update User</button>
        <a href="${routes.admin.users.index.href()}" class="btn btn-secondary" style="margin-left: 0.5rem;">Cancel</a>
      </form>
    </div>
  `

    return html(layout(content, user))
  },

  async update({ request, params, url }) {
    let formData = await request.formData()

    updateUser(params.userId, {
      name: formData.get('name')?.toString() || '',
      email: formData.get('email')?.toString() || '',
      role: (formData.get('role')?.toString() || 'customer') as 'customer' | 'admin',
    })

    return redirect(routes.admin.users.index.href(), url)
  },

  destroy({ params, url }) {
    deleteUser(params.userId)

    return redirect(routes.admin.users.index.href(), url)
  },
} satisfies RouteHandlers<typeof routes.admin.users>
