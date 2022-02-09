import styled from "@emotion/styled";

const Wrapper = styled("div")`
  background-color: #e6e6e6;
`;

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
