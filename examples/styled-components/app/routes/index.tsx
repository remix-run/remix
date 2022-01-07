import styled from "styled-components";

export default function Index() {
  return (
    <Box>
      <h1>Welcome to Remix (With Styled Component)</h1>
      <ul>
        <li>
          <a
            target="_blank"
            href="https://remix.run/tutorials/blog"
            rel="noreferrer"
          >
            15m Quickstart Blog Tutorial
          </a>
        </li>
        <li>
          <a
            target="_blank"
            href="https://remix.run/tutorials/jokes"
            rel="noreferrer"
          >
            Deep Dive Jokes App Tutorial
          </a>
        </li>
        <li>
          <a target="_blank" href="https://remix.run/docs" rel="noreferrer">
            Remix Docs
          </a>
        </li>
      </ul>
    </Box>
  );
}

const Box = styled("div")`
  fontFamily: "system-ui, sans-serif", lineHeight: "1.4"
`;
