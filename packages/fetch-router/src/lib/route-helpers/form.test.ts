import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createFormRoutes as form } from './form.ts'
import { createRoutes as route, Route } from '../route-map.ts'
import type { Assert, IsEqual } from '../type-utils.ts'

describe('form routes helper', () => {
  it('creates a route map with index and action routes', () => {
    let login = form('login')

    type T = [
      Assert<
        IsEqual<
          typeof login,
          {
            index: Route<'GET', '/login'>
            action: Route<'POST', '/login'>
          }
        >
      >,
    ]

    assert.deepEqual(login.index, new Route('GET', '/login'))
    assert.deepEqual(login.action, new Route('POST', '/login'))
  })

  it('supports a custom form method', () => {
    let settings = form('settings', { formMethod: 'PUT' })

    type T = [
      Assert<
        IsEqual<
          typeof settings,
          {
            index: Route<'GET', '/settings'>
            action: Route<'PUT', '/settings'>
          }
        >
      >,
    ]

    assert.deepEqual(settings.index, new Route('GET', '/settings'))
    assert.deepEqual(settings.action, new Route('PUT', '/settings'))
  })

  it('supports a custom index name', () => {
    let profile = form('profile', { names: { index: 'show' } })

    type T = [
      Assert<
        IsEqual<
          typeof profile,
          {
            show: Route<'GET', '/profile'>
            action: Route<'POST', '/profile'>
          }
        >
      >,
    ]

    assert.deepEqual(profile.show, new Route('GET', '/profile'))
    assert.deepEqual(profile.action, new Route('POST', '/profile'))
  })

  it('supports a custom action name', () => {
    let signup = form('signup', { names: { action: 'register' } })

    type T = [
      Assert<
        IsEqual<
          typeof signup,
          {
            index: Route<'GET', '/signup'>
            register: Route<'POST', '/signup'>
          }
        >
      >,
    ]

    assert.deepEqual(signup.index, new Route('GET', '/signup'))
    assert.deepEqual(signup.register, new Route('POST', '/signup'))
  })

  it('supports custom names for both index and action', () => {
    let contact = form('contact', {
      names: {
        index: 'show',
        action: 'submit',
      },
    })

    type T = [
      Assert<
        IsEqual<
          typeof contact,
          {
            show: Route<'GET', '/contact'>
            submit: Route<'POST', '/contact'>
          }
        >
      >,
    ]

    assert.deepEqual(contact.show, new Route('GET', '/contact'))
    assert.deepEqual(contact.submit, new Route('POST', '/contact'))
  })

  it('supports custom names with custom form method', () => {
    let account = form('account', {
      formMethod: 'PATCH',
      names: {
        index: 'edit',
        action: 'update',
      },
    })

    type T = [
      Assert<
        IsEqual<
          typeof account,
          {
            edit: Route<'GET', '/account'>
            update: Route<'PATCH', '/account'>
          }
        >
      >,
    ]

    assert.deepEqual(account.edit, new Route('GET', '/account'))
    assert.deepEqual(account.update, new Route('PATCH', '/account'))
  })

  it('creates nested forms', () => {
    let routes = route({
      account: {
        ...form('account'),
        settings: form('account/settings'),
      },
    })

    type T = [
      Assert<
        IsEqual<
          typeof routes.account,
          {
            index: Route<'GET', '/account'>
            action: Route<'POST', '/account'>
            settings: {
              index: Route<'GET', '/account/settings'>
              action: Route<'POST', '/account/settings'>
            }
          }
        >
      >,
    ]

    assert.deepEqual(routes.account.index, new Route('GET', '/account'))
    assert.deepEqual(routes.account.action, new Route('POST', '/account'))

    assert.deepEqual(routes.account.settings.index, new Route('GET', '/account/settings'))
    assert.deepEqual(routes.account.settings.action, new Route('POST', '/account/settings'))
  })
})
