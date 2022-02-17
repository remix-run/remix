import { Outlet, Link } from "remix";
import styled from "@emotion/styled";

const Container = styled("div")`
  background-color: #d6d6d6;
`;

export default function Jokes() {
  return (
    <Container>
      <h1>Jokes</h1>
      <Outlet />
      <Link to="/">Back to home</Link>
    </Container>
  );
}
