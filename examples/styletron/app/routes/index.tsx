import { styled } from "styletron-react";

const Box = styled("div", () => ({
  fontFamily: "system-ui, sans-serif",
  lineHeight: 1.4,
}));

export default function Index() {
  return (
    <Box>
      <h1>Welcome to Remix + Styletron</h1>
      <p>These styles were extracted during server-side rendering!</p>
    </Box>
  );
}
