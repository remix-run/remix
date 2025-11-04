import * as assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { createFormAction as formAction } from './form-action.ts'
import { createRoutes as route, Route } from './route-map.ts'
import type { Assert, IsEqual } from './type-utils.ts'

describe('createFormAction', () => {
  it('creates a route map with index and action routes', () => {
    let login = formAction('login')

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
    let settings = formAction('settings', { formMethod: 'PUT' })

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
    let profile = formAction('profile', { names: { index: 'show' } })

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
    let signup = formAction('signup', { names: { action: 'register' } })

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
    let contact = formAction('contact', {
      names: {
        index: 'form',
        action: 'submit',
      },
    })

    type T = [
      Assert<
        IsEqual<
          typeof contact,
          {
            form: Route<'GET', '/contact'>
            submit: Route<'POST', '/contact'>
          }
        >
      >,
    ]

    assert.deepEqual(contact.form, new Route('GET', '/contact'))
    assert.deepEqual(contact.submit, new Route('POST', '/contact'))
  })

  it('supports custom names with custom form method', () => {
    let account = formAction('account', {
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

  it('creates nested form actions', () => {
    let routes = route({
      account: {
        ...formAction('account'),
        settings: formAction('account/settings'),
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
