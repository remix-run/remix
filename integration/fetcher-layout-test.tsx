import * as React from "react";
import { unstable_createRemixStub as createRemixStub } from "@remix-run/testing";
import {
  Outlet,
  useFetcher,
  useFormAction,
  useLoaderData,
} from "@remix-run/react";
import { json } from "@remix-run/node";

import { render, screen, userEvent, waitFor } from "./render";

function ActionLayout() {
  let fetcher = useFetcher();
  let action = useFormAction();

  let invokeFetcher = () => {
    fetcher.submit({}, { method: "post", action });
  };

  return (
    <div>
      <h1>Layout</h1>
      <button data-testid="layout-fetcher" onClick={invokeFetcher}>
        Invoke Fetcher
      </button>
      {!!fetcher.data && (
        <p data-testid="layout-fetcher-data">{fetcher.data}</p>
      )}
      <Outlet />
    </div>
  );
}

function ActionLayoutIndex() {
  let data = useLoaderData();
  let fetcher = useFetcher();
  let action = useFormAction();

  let invokeFetcher = () => {
    fetcher.submit({}, { method: "post", action });
  };

  return (
    <>
      <p data-testid="child-data">{data}</p>
      <button data-testid="index-fetcher" onClick={invokeFetcher}>
        Invoke Index Fetcher
      </button>
      {!!fetcher.data && <p data-testid="index-fetcher-data">{fetcher.data}</p>}
    </>
  );
}

function ActionLayoutChild() {
  let data = useLoaderData();
  let fetcher = useFetcher();
  let action = useFormAction();

  let invokeFetcher = () => {
    fetcher.submit({}, { method: "post", action });
  };

  return (
    <>
      <p data-testid="child-data">{data}</p>
      <button data-testid="param-fetcher" onClick={invokeFetcher}>
        Invoke Param Fetcher
      </button>
      {!!fetcher.data && <p data-testid="param-fetcher-data">{fetcher.data}</p>}
    </>
  );
}

function LoaderLayout() {
  let fetcher = useFetcher();
  let action = useFormAction();

  let invokeFetcher = () => {
    fetcher.load(action);
  };

  return (
    <div>
      <h1>Layout</h1>
      <button data-testid="layout-fetcher" onClick={invokeFetcher}>
        Invoke Fetcher
      </button>
      {!!fetcher.data && (
        <p data-testid="layout-fetcher-data">{fetcher.data}</p>
      )}
      <Outlet />
    </div>
  );
}

function LoaderLayoutIndex() {
  let fetcher = useFetcher();
  let action = useFormAction();

  let invokeFetcher = () => {
    fetcher.load(action);
  };

  return (
    <>
      <button data-testid="index-fetcher" onClick={invokeFetcher}>
        Invoke Index Fetcher
      </button>
      {!!fetcher.data && <p data-testid="index-fetcher-data">{fetcher.data}</p>}
    </>
  );
}

function LoaderLayoutChild() {
  let fetcher = useFetcher();
  let action = useFormAction();

  let invokeFetcher = () => {
    fetcher.load(action);
  };

  return (
    <>
      <button data-testid="param-fetcher" onClick={invokeFetcher}>
        Invoke Param Fetcher
      </button>
      {!!fetcher.data && <p data-testid="param-fetcher-data">{fetcher.data}</p>}
    </>
  );
}

let RemixStub = createRemixStub([
  {
    path: "/layout-action",
    action: () => json("layout action data"),
    element: <ActionLayout />,
    children: [
      {
        index: true,
        loader: () => json("index data"),
        action: () => json("index action data"),
        element: <ActionLayoutIndex />,
      },
      {
        path: ":param",
        loader: ({ params }) => json(params.param),
        action: ({ params }) => json("param action data"),
        element: <ActionLayoutChild />,
      },
    ],
  },
  {
    path: "/layout-loader",
    loader: () => json("layout loader data"),
    element: <LoaderLayout />,
    children: [
      {
        index: true,
        loader: () => json("index data"),
        element: <LoaderLayoutIndex />,
      },
      {
        path: ":param",
        loader: ({ params }) => json(params.param),
        element: <LoaderLayoutChild />,
      },
    ],
  },
]);

test("fetcher calls layout route action when at index route", async () => {
  render(<RemixStub initialEntries={["/layout-action"]} />);
  await screen.findByText("Layout");
  await userEvent.click(screen.getByTestId("layout-fetcher"));
  await waitFor(() => screen.getByTestId("layout-fetcher-data"));
  let dataElement = screen.getByTestId("layout-fetcher-data");
  expect(dataElement).toHaveTextContent("layout action data");
  let childDataElement = screen.getByTestId("child-data");
  expect(childDataElement).toHaveTextContent("index data");
});

test("fetcher calls layout route loader when at index route", async () => {
  render(<RemixStub initialEntries={["/layout-loader"]} />);
  await screen.findByText("Layout");
  await userEvent.click(screen.getByTestId("layout-fetcher"));
  await waitFor(() => screen.getByTestId("layout-fetcher-data"));
  let dataElement = screen.getByTestId("layout-fetcher-data");
  expect(dataElement).toHaveTextContent("layout loader data");
});

test("fetcher calls index route action when at index route", async () => {
  render(<RemixStub initialEntries={["/layout-action"]} />);
  await screen.findByText("Layout");
  await userEvent.click(screen.getByTestId("index-fetcher"));
  await waitFor(() => screen.getByTestId("index-fetcher-data"));
  let dataElement = screen.getByTestId("index-fetcher-data");
  expect(dataElement).toHaveTextContent("index action data");
  let childDataElement = screen.getByTestId("child-data");
  expect(childDataElement).toHaveTextContent("index data");
});

test("fetcher calls index route loader when at index route", async () => {
  render(<RemixStub initialEntries={["/layout-loader"]} />);
  await screen.findByText("Layout");
  await userEvent.click(screen.getByTestId("index-fetcher"));
  await waitFor(() => screen.getByTestId("index-fetcher-data"));
  let dataElement = screen.getByTestId("index-fetcher-data");
  expect(dataElement).toHaveTextContent("index data");
});

test("fetcher calls layout route action when at paramaterized route", async () => {
  render(<RemixStub initialEntries={["/layout-action/foo"]} />);
  await screen.findByText("Layout");
  await userEvent.click(screen.getByTestId("layout-fetcher"));
  await waitFor(() => screen.getByTestId("layout-fetcher-data"));
  let dataElement = screen.getByTestId("layout-fetcher-data");
  expect(dataElement).toHaveTextContent("layout action data");
  let childDataElement = screen.getByTestId("child-data");
  expect(childDataElement).toHaveTextContent("foo");
});

test("fetcher calls layout route loader when at parameterized route", async () => {
  render(<RemixStub initialEntries={["/layout-loader/foo"]} />);
  await screen.findByText("Layout");
  await userEvent.click(screen.getByTestId("layout-fetcher"));
  await waitFor(() => screen.getByTestId("layout-fetcher-data"));
  let dataElement = screen.getByTestId("layout-fetcher-data");
  expect(dataElement).toHaveTextContent("layout loader data");
});

test("fetcher calls parameterized route route action", async () => {
  render(<RemixStub initialEntries={["/layout-action/foo"]} />);
  await screen.findByText("Layout");
  await userEvent.click(screen.getByTestId("param-fetcher"));
  await waitFor(() => screen.getByTestId("param-fetcher-data"));
  let dataElement = screen.getByTestId("param-fetcher-data");
  expect(dataElement).toHaveTextContent("param action data");
  let childDataElement = screen.getByTestId("child-data");
  expect(childDataElement).toHaveTextContent("foo");
});

test("fetcher calls parameterized route route loader", async () => {
  render(<RemixStub initialEntries={["/layout-loader/foo"]} />);
  await screen.findByText("Layout");
  await userEvent.click(screen.getByTestId("param-fetcher"));
  await waitFor(() => screen.getByTestId("param-fetcher-data"));
  let dataElement = screen.getByTestId("param-fetcher-data");
  expect(dataElement).toHaveTextContent("foo");
});
