import styled from "styled-components";

const Box = styled("div")`
  font-family: system-ui, sans-serif;
  line-height: 1.4;
`;

export default function Index() {
  return (
    <Box>
      <h1>Welcome to Remix (With Styled Component)</h1>
    </Box>
  );
}
