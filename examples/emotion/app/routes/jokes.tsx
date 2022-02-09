import { Outlet } from "remix";
import styled from "@emotion/styled";

const Container = styled("div")`
  background-color: #666;
`;

export default function Jokes() {
  return (
    <Container>
      <h1>Jokes</h1>
      <Outlet />
    </Container>
  );
}
