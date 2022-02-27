import React from "react";
import { useUserContext } from "~/lib/useUserContext";
import { Link, useSubmit } from "remix";
import { Container, Nav, Navbar } from "react-bootstrap";

export const Header = (): JSX.Element => {
  const [user, setUser] = useUserContext();
  const submit = useSubmit();

  const logout: React.MouseEventHandler<HTMLElement> = () => {
    setUser((prevState) => ({ ...prevState, user: undefined }));
    submit({ actionType: "logout" }, { method: "post" });
  };

  return (
    <Navbar bg="dark" variant="dark">
      <Container>
        <Navbar.Brand as={Link} to="/">
          Brand
        </Navbar.Brand>
        <Navbar.Collapse>
          <Nav>
            {user?.user?.email ? (
              <Nav.Link onClick={logout}>Logout</Nav.Link>
            ) : (
              <Nav.Link as={Link} to="/admin/login">
                Login
              </Nav.Link>
            )}
            <Nav.Link as={Link} to="/admin/dashboard">
              Dashboard
            </Nav.Link>
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
};
