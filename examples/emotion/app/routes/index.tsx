import styled from "@emotion/styled";
import { Link } from "remix";

const Container = styled("div")`
  font-family: "system-ui, sans-serif";
  line-height: 1.4;
  background-color: #ddd;
`;

export default function Index() {
  return (
    <Container>
      <h1>Welcome to Remix with Emotion Example</h1>
      <ul>
        <li>
          <Link to="/jokes">Jokes</Link>
        </li>
        <li>
          <Link to="/jokes/not-found">Jokes: Not Found</Link>
        </li>
        <li>
          <Link to="/jokes/test-id">Jokes: Test Id</Link>
        </li>
      </ul>
    </Container>
  );
}
