import styled from "@emotion/styled";

const ErrorWrapper = styled("div")`
  background-color: #ff0000;
  padding: 1em;
`;

export default function JokeNotFoundRoute() {
  throw new Error("Something went wrong.");
}

export function ErrorBoundary({ error }) {
  return (
    <ErrorWrapper>
      <h1>Error</h1>
      <p>{error.message}</p>
      <p>The stack trace is:</p>
      <pre>{error.stack}</pre>
    </ErrorWrapper>
  );
}
