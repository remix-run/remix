/** @jsx jsx */
import { css, jsx } from "@emotion/react";
import { useEffect, useState } from "react";
import { Link } from "remix";

// Object Styles
const wrapperStyle = {
  height: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center"
};

// String Styles
const headingStyle = css`
  font-size: 2rem;
  color: blue;
  transition: color 0.5s 0s ease;
`;

const headingDefaultStyle = css`
  font-size: 2rem;
`;

export default function Index() {
  const [state, setState] = useState(false);

  useEffect(() => {
    new Promise(resolve => setTimeout(resolve, 1000)).then(() => {
      setState(true);
    });
  }, []);

  return (
    <div>
      <header>
        <Link to="/">Top Page</Link> | <Link to="/sub">Sub Page</Link>
      </header>
      <div css={wrapperStyle}>
        <h1 css={state ? headingStyle : headingDefaultStyle}>
          Welcome to SubPage (With Emotion css Prop)
        </h1>
      </div>
    </div>
  );
}
