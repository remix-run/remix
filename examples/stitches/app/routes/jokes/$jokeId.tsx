import { styled } from "@stitches/react";

export default function Jokes() {
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

const Wrapper = styled("div", {
  backgroundColor: "#e6e6e6"
});
