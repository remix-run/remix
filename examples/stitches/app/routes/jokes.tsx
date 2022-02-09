import { Outlet } from "remix";
import { styled } from "@stitches/react";

export default function Jokes() {
  return (
    <Container>
      <h1>Jokes</h1>
      <Outlet />
    </Container>
  );
}

const Container = styled("div", {
  backgroundColor: "#666"
});
