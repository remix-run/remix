import { test, expect } from '@playwright/test'
import { PlaywrightFixture } from './helpers/playwright-fixture'
import type { Fixture, AppFixture } from './helpers/create-fixture'
import { createAppFixture, createFixture, js } from './helpers/create-fixture'

let fixture: Fixture
let appFixture: AppFixture

test.beforeAll(async () => {
  fixture = await createFixture({
    files: {
      'app/routes/index.jsx': js`
        import { Form } from '@remix-run/react'
        import { redirect, json } from '@remix-run/server-runtime'
        import { PrefetchPageLinks } from '@remix-run/react'

        export const loader = async () => {
          const response = json(null)
          response.headers.set('set-cookie', 'testcookie=setByLoader')
          return response
        }

        export const action = async () => {
          const response = redirect('/result-page')
          response.headers.set('set-cookie', 'testcookie=setByAction')
          return response
        }       

        export default function Index() {
          return (
            <Form method='post'>
              <PrefetchPageLinks page='/result-page' />
              <button type='submit'>Submit</button>
            </Form>            
          )
        }
      `,
      
      'app/routes/result-page.jsx': js`
        import { json } from '@remix-run/server-runtime'
        import { useLoaderData } from '@remix-run/react'

        export const loader = async ({ request }) => {
          return json(request.headers.get('cookie'))
        }

        export default function ResultPage() {
          const loaderData = useLoaderData()

          return (
            <p>{JSON.stringify(loaderData)}</p>
          )
        }
      `, 
    },
  })

  appFixture = await createAppFixture(fixture)
})

test.afterAll(() => appFixture.close())

test(`testcookie=setByAction should be displayed because the /result-page loader should have been rerun after the /index action.

It seems to work in Firefox and Webkit but not in Chromium and Edge.

In Chromium and Edge testcookie=setByLoader is displayed which is the data returned by the /result-page loader when called due to the presence of the PrefetchPageLinks component in /index.
`, async ({ page }) => {
  let app = new PlaywrightFixture(appFixture, page)
  await app.goto('/')
  await app.clickElement('button')
  await expect(page.locator('p')).toContainText('testcookie=setByAction')
})
