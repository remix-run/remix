import * as React from "react";
import { vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useLoaderData } from "remix";
import UserScreen from "./$userId";

vi.mock("remix", () => {
  // mock whatever remix APIs you're using
  return {
    Form: (props: React.RefAttributes<HTMLFormElement>) => <form {...props} />,
    useLoaderData: vi.fn(),
    useLocation: vi.fn(() => ({ key: Math.random().toString(32).slice(2) }))
  };
});

test("works", () => {
  // may want to dynamically generate this data with faker:
  const user = {
    name: "Janna",
    email: "janna@example.com",
    id: "123"
  };
  // set what you want returned by the useLoaderData hook
  // @ts-expect-error https://github.com/vitest-dev/vitest/issues/745
  useLoaderData.mockImplementation(() => ({ user }));

  render(<UserScreen />);

  // make sure the hidden input with the ID is in the document:
  expect(screen.getByDisplayValue(user.id)).toBeInTheDocument();

  const nameInput = screen.getByRole("textbox", { name: /name/i });
  const emailInput = screen.getByRole("textbox", { name: /email/i });

  // defaultValue is wired up properly
  expect(nameInput).toHaveValue(user.name);
  expect(emailInput).toHaveValue(user.email);

  userEvent.clear(nameInput);
  userEvent.type(nameInput, "Anna");

  userEvent.clear(emailInput);
  userEvent.type(emailInput, "anna@example.com");

  // TODO: how do we test submitting the form? Do we need to?
  // What if I am using useTransition for optimistic UI... I think we'll
  // want to test that... Not sure I want to mock out useTransition........
});
