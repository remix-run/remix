// Admin order management handlers

import type { RequestHandler } from '@remix-run/fetch-router'
import { html } from '@remix-run/fetch-router'

import { routes } from '../routes.ts'
import { layout, escapeHtml } from './views/layout.ts'
import { getUser } from './middleware/auth.ts'
import { getAllOrders, getOrderById } from './models/orders.ts'

let indexHandler: RequestHandler = (ctx) => {
  // User is guaranteed to exist and be admin because middleware ran
  let user = getUser(ctx)!
  let orders = getAllOrders()

  let ordersHtml = `
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
              <a href="${routes.admin.orders.show.href({ orderId: order.id })}" class="btn btn-secondary" style="font-size: 0.875rem; padding: 0.25rem 0.5rem;">View</a>
            </td>
          </tr>
        `,
          )
          .join('')}
      </tbody>
    </table>
  `

  let content = `
    <h1>Manage Orders</h1>
    
    <p style="margin-bottom: 1rem;">
      <a href="${routes.admin.index.href()}" class="btn btn-secondary">Back to Dashboard</a>
    </p>

    <div class="card">
      ${ordersHtml}
    </div>
  `

  return html(layout(content, user))
}

let showHandler: RequestHandler<{ orderId: string }> = (ctx) => {
  // User is guaranteed to exist and be admin because middleware ran
  let user = getUser(ctx)!
  let order = getOrderById(ctx.params.orderId)

  if (!order) {
    return html(layout('<div class="card"><h1>Order Not Found</h1></div>', user), { status: 404 })
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
      <p><strong>User ID:</strong> ${order.userId}</p>
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
      <a href="${routes.admin.orders.index.href()}" class="btn btn-secondary">Back to Orders</a>
    </p>
  `

  return html(layout(content, user))
}

export default {
  index: indexHandler,
  show: showHandler,
}
