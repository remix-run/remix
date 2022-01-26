import { Link } from "remix";
import { Menu } from "@headlessui/react";

export default function Index() {
  return (
    <div>
      <h2>Basic example of a Menu (dropdown) component from the HeadlessUI colection.</h2>
      <p>All the other components should work too, like magic!</p>

      <Menu>
        <Menu.Button>Toggle dropdown</Menu.Button>
        <Menu.Items>
          <Menu.Item>
            {({ active }) => (
              <Link
                className={`${active && 'some-active-class'}`}
                to="/"
              >
                Example Link
              </Link>
            )}
          </Menu.Item>
          <Menu.Item>
            {({ active }) => (
              <a
                className={`${active && 'some-active-class'}`}
                href="https://headlessui.dev/react/menu"
              >
                Documentation
              </a>
            )}
          </Menu.Item>
          <Menu.Item>
            {({ active }) => (
              <a
                className={`${active && 'some-active-class'}`}
                href="https://remix.run/docs"
              >
                Remix Docs
              </a>
            )}
          </Menu.Item>
          <Menu.Item>
            {({ active }) => (
              <a
                className={`${active && 'some-active-class'}`}
                href="https://remix.guide"
              >
                Remix guide
              </a>
            )}
          </Menu.Item>
          <Menu.Item disabled>
            <span>Disabled menu item</span>
          </Menu.Item>
        </Menu.Items>
      </Menu>
      
      <p><small><em>You can then style those components using custom CSS or framework like Tailwind or DaisyUI.</em></small></p>
    </div>
  )
}