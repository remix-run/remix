import type { RequestHandler } from '@remix-run/fetch-router'
import { html } from '@remix-run/fetch-router'

import { routes } from '../routes.ts'
import { layout, escapeHtml, redirect } from './views/layout.ts'
import { getUser } from './middleware/auth.ts'
import { getOrdersByUserId, getOrderById } from './models/orders.ts'
import { updateUser } from './models/users.ts'

let accountIndexHandler: RequestHandler = (ctx) => {
  // User is guaranteed to exist because requireAuth middleware ran
  let user = getUser(ctx)!

  let content = `
    <h1>My Account</h1>
    
    <div class="card">
      <h2>Account Information</h2>
      <p><strong>Name:</strong> ${escapeHtml(user.name)}</p>
      <p><strong>Email:</strong> ${escapeHtml(user.email)}</p>
      <p><strong>Role:</strong> ${escapeHtml(user.role)}</p>
      <p><strong>Member Since:</strong> ${user.createdAt.toLocaleDateString()}</p>
      
      <p style="margin-top: 1.5rem;">
        <a href="${routes.account.settings.href()}" class="btn">Edit Settings</a>
      </p>
    </div>

    <div class="card" style="margin-top: 1.5rem;">
      <h2>Quick Links</h2>
      <p>
        <a href="${routes.account.orders.index.href()}" class="btn btn-secondary">View Orders</a>
        <a href="${routes.books.index.href()}" class="btn btn-secondary" style="margin-left: 0.5rem;">Browse Books</a>
      </p>
    </div>
  `

  return html(layout(content, user))
}

let accountSettingsHandler: RequestHandler = (ctx) => {
  let user = getUser(ctx)!

  let content = `
    <h1>Account Settings</h1>
    
    <div class="card">
      <form method="POST" action="${routes.account.settingsUpdate.href()}">
        <div class="form-group">
          <label for="name">Name</label>
          <input type="text" id="name" name="name" value="${escapeHtml(user.name)}" required>
        </div>
        
        <div class="form-group">
          <label for="email">Email</label>
          <input type="email" id="email" name="email" value="${escapeHtml(user.email)}" required>
        </div>
        
        <div class="form-group">
          <label for="password">New Password (leave blank to keep current)</label>
          <input type="password" id="password" name="password" autocomplete="new-password">
        </div>
        
        <button type="submit" class="btn">Update Settings</button>
        <a href="${routes.account.index.href()}" class="btn btn-secondary" style="margin-left: 0.5rem;">Cancel</a>
      </form>
    </div>
  `

  return html(layout(content, user))
}

let accountSettingsUpdateHandler: RequestHandler = async (ctx) => {
  let user = getUser(ctx)!

  let formData = await ctx.request.formData()
  let name = formData.get('name')?.toString() || ''
  let email = formData.get('email')?.toString() || ''
  let password = formData.get('password')?.toString() || ''

  let updateData: any = { name, email }
  if (password) {
    updateData.password = password
  }

  updateUser(user.id, updateData)

  return redirect(routes.account.index.href(), ctx.url)
}

let ordersIndexHandler: RequestHandler = (ctx) => {
  let user = getUser(ctx)!
  let orders = getOrdersByUserId(user.id)

  let ordersHtml =
    orders.length > 0
      ? `
    <table>
      <thead>
        <tr>
          <th>Order ID</th>
          <th>Date</th>
          <th>Items</th>
          <th>Total</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${orders
          .map(
            (order) => `
          <tr>
            <td>#${order.id}</td>
            <td>${order.createdAt.toLocaleDateString()}</td>
            <td>${order.items.length} item(s)</td>
            <td>$${order.total.toFixed(2)}</td>
            <td><span class="badge badge-info">${order.status}</span></td>
            <td>
              <a href="${routes.account.orders.show.href({ orderId: order.id })}" class="btn btn-secondary" style="font-size: 0.875rem; padding: 0.25rem 0.5rem;">View</a>
            </td>
          </tr>
        `,
          )
          .join('')}
      </tbody>
    </table>
  `
      : '<p>You have no orders yet.</p>'

  let content = `
    <h1>My Orders</h1>
    
    <div class="card">
      ${ordersHtml}
    </div>

    <p style="margin-top: 1.5rem;">
      <a href="${routes.account.index.href()}" class="btn btn-secondary">Back to Account</a>
    </p>
  `

  return html(layout(content, user))
}

let orderShowHandler: RequestHandler<{ orderId: string }> = (ctx) => {
  let user = getUser(ctx)!
  let order = getOrderById(ctx.params.orderId)

  if (!order || order.userId !== user.id) {
    let content = `
      <div class="card">
        <h1>Order Not Found</h1>
        <p>
          <a href="${routes.account.orders.index.href()}" class="btn">Back to Orders</a>
        </p>
      </div>
    `

    return html(layout(content, user), { status: 404 })
  }

  let itemsHtml = order.items
    .map(
      (item) => `
    <tr>
      <td>${escapeHtml(item.title)}</td>
      <td>${item.quantity}</td>
      <td>$${item.price.toFixed(2)}</td>
      <td>$${(item.price * item.quantity).toFixed(2)}</td>
    </tr>
  `,
    )
    .join('')

  let content = `
    <h1>Order #${order.id}</h1>
    
    <div class="card">
      <p><strong>Order Date:</strong> ${order.createdAt.toLocaleDateString()}</p>
      <p><strong>Status:</strong> <span class="badge badge-info">${order.status}</span></p>
      
      <h2 style="margin-top: 2rem;">Items</h2>
      <table style="margin-top: 1rem;">
        <thead>
          <tr>
            <th>Book</th>
            <th>Quantity</th>
            <th>Price</th>
            <th>Subtotal</th>
          </tr>
        </thead>
        <tbody>
          ${itemsHtml}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="3" style="text-align: right; font-weight: bold;">Total:</td>
            <td style="font-weight: bold;">$${order.total.toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>

      <h2 style="margin-top: 2rem;">Shipping Address</h2>
      <p>${escapeHtml(order.shippingAddress.street)}</p>
      <p>${escapeHtml(order.shippingAddress.city)}, ${escapeHtml(order.shippingAddress.state)} ${escapeHtml(order.shippingAddress.zip)}</p>
    </div>

    <p style="margin-top: 1.5rem;">
      <a href="${routes.account.orders.index.href()}" class="btn btn-secondary">Back to Orders</a>
    </p>
  `

  return html(layout(content, user))
}

export default {
  account: {
    index: accountIndexHandler,
    settings: accountSettingsHandler,
    settingsUpdate: accountSettingsUpdateHandler,
    orders: {
      index: ordersIndexHandler,
      show: orderShowHandler,
    },
  },
}
