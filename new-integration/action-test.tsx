import * as React from "react";
import { unstable_createRemixStub as createRemixStub } from "@remix-run/testing";
import { json, redirect } from "@remix-run/node";
import { useActionData, Form } from "@remix-run/react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

let FIELD_NAME = "message";
let WAITING_VALUE = "Waiting...";
let SUBMITTED_VALUE = "Submission";
let THROWS_REDIRECT = "redirect-throw";
let REDIRECT_TARGET = "page";
let PAGE_TEXT = "PAGE_TEXT";

function UrlEncoded() {
  let data = useActionData();

  return (
    <Form method="post" data-testid="form">
      <p data-testid="text">
        {data ? <span data-testid="action-text">{data}</span> : WAITING_VALUE}
      </p>
      <p>
        <input type="text" defaultValue={SUBMITTED_VALUE} name={FIELD_NAME} />
        <button type="submit" data-testid="submit">
          Go
        </button>
      </p>
    </Form>
  );
}

function RequestText() {
  let data = useActionData();

  return (
    <Form method="post" data-testid="form">
      <p data-testid="text">
        {data ? <span data-testid="action-text">{data}</span> : WAITING_VALUE}
      </p>
      <p>
        <input name="a" defaultValue="1" />
        <input name="b" defaultValue="2" />
        <button type="submit" data-testid="submit">
          Go
        </button>
      </p>
    </Form>
  );
}

let RemixStub = createRemixStub([
  {
    path: "/urlencoded",
    action: async ({ request }) => {
      let formData = await request.formData();
      return formData.get(FIELD_NAME);
    },
    element: <UrlEncoded />,
  },
  {
    path: "/request-text",
    action: async ({ request }) => {
      let text = await request.text();
      return text;
    },
    element: <RequestText />,
  },
  {
    path: `/${THROWS_REDIRECT}`,
    action: async () => {
      throw redirect(`/${REDIRECT_TARGET}`);
    },
    element: (
      <Form method="post">
        <button type="submit">Go</button>
      </Form>
    ),
  },
  {
    path: `/${REDIRECT_TARGET}`,
    element: <div data-testid={REDIRECT_TARGET}>{PAGE_TEXT}</div>,
  },
]);

describe("actions", () => {
  test("is not called on document GET requests", async () => {
    render(<RemixStub initialEntries={["/urlencoded"]} />);
    await waitFor(() => screen.getByText(WAITING_VALUE));
    expect(screen.getByTestId("text")).toHaveTextContent(WAITING_VALUE);
  });

  // test("is called on document POST requests", async () => {
  //   let FIELD_VALUE = "cheeseburger";

  //   let params = new URLSearchParams();
  //   params.append(FIELD_NAME, FIELD_VALUE);

  //   let res = await fixture.postDocument("/urlencoded", params);

  //   let html = selectHtml(await res.text(), "#text");
  //   expect(html).toMatch(FIELD_VALUE);
  // });

  test("is called on script transition POST requests", async () => {
    render(<RemixStub initialEntries={["/urlencoded"]} />);
    await waitFor(() => screen.getByTestId("text"));
    expect(screen.getByTestId("text")).toHaveTextContent(WAITING_VALUE);

    await userEvent.click(screen.getByRole("button"));
    await waitFor(() => screen.getByTestId("action-text"));
    expect(screen.getByTestId("text")).toHaveTextContent(SUBMITTED_VALUE);
  });

  test("properly encodes form data for request.text() usage", async () => {
    render(<RemixStub initialEntries={["/request-text"]} />);
    await waitFor(() => screen.getByTestId("text"));
    expect(screen.getByTestId("text")).toHaveTextContent(WAITING_VALUE);

    await userEvent.click(screen.getByRole("button"));
    await waitFor(() => screen.getByTestId("action-text"));
    expect(screen.getByTestId("action-text")).toHaveTextContent("a=1&b=2");
  });

  // test("redirects a thrown response on document requests", async () => {
  //   let params = new URLSearchParams();
  //   let res = await fixture.postDocument(`/${THROWS_REDIRECT}`, params);
  //   expect(res.status).toBe(302);
  //   expect(res.headers.get("Location")).toBe(`/${REDIRECT_TARGET}`);
  // });

  test("redirects a thrown response on script transitions", async () => {
    // let app = new PlaywrightFixture(appFixture, page);
    // await app.goto(`/${THROWS_REDIRECT}`);
    // let responses = app.collectDataResponses();
    // await app.clickSubmitButton(`/${THROWS_REDIRECT}`);

    // await page.waitForSelector(`#${REDIRECT_TARGET}`);

    // expect(responses.length).toBe(1);
    // expect(responses[0].status()).toBe(204);

    // expect(new URL(page.url()).pathname).toBe(`/${REDIRECT_TARGET}`);
    // expect(await app.getHtml()).toMatch(PAGE_TEXT);

    render(<RemixStub initialEntries={[`/${THROWS_REDIRECT}`]} />);

    await waitFor(() => screen.getByRole("button"));
    await userEvent.click(screen.getByRole("button"));

    await waitFor(() => screen.getByTestId(REDIRECT_TARGET));

    await waitFor(() => window.location.pathname === `/${REDIRECT_TARGET}`);
    expect(screen.getByTestId(REDIRECT_TARGET)).toHaveTextContent(PAGE_TEXT);
  });
});
