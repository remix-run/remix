import { Link } from "@remix-run/react";
import { styled } from "../styles/stitches.config";

const Container = styled("div", {
  fontFamily: "system-ui, sans-serif",
  lineHeight: 1.4,
  backgroundColor: "#999",
});

export default function Index() {
  return (
    <Container>
      <h1>Welcome to Remix with Emotion Example</h1>
      <ul>
        <li>
          <Link to="/jokes">Jokes</Link>
        </li>
        <li>
          <Link to="/jokes-error">Jokes: Error</Link>
        </li>
      </ul>
    </Container>
  );
}
