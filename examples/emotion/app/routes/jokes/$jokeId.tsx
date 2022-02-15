import type { LoaderFunction } from "remix";
import { useCatch } from "remix";

import styled from "@emotion/styled";

const Wrapper = styled("div")`
  background-color: #e6e6e6;
`;

const ErrorWrapper = styled("div")`
  background-color: #ff0000;
  padding: 1em;
`;

export const loader: LoaderFunction = async () => {
  throw new Response("What a joke! Not found.", {
    status: 404
  });
};

export default function JokeRoute() {
  return (
    <Wrapper>
      <p>Here's your hilarious joke:</p>
      <p>
        Why don't you find hippopotamuses hiding in trees? They're really good
        at it.
      </p>
    </Wrapper>
  );
}

export function CatchBoundary() {
  const caught = useCatch();

  return (
    <ErrorWrapper>
      <h1>Caught</h1>
      <p>Status: {caught.status}</p>
      <pre>
        <code>{JSON.stringify(caught.data, null, 2)}</code>
      </pre>
    </ErrorWrapper>
  );
}
