/** @jsx jsx */
import { css, jsx } from "@emotion/react";
import { useEffect, useState } from "react";

// Object Styles
const wrapperStyle = {
  height: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center"
};

// String Styles
const headingStyle = css`
  font-size: 3rem;
  font-weight: 700;
  color: hotpink;
`;

const headingDefaultStyle = css`
  font-size: 3rem;
`;

export default function Index() {
  const [state, setState] = useState(false);

  useEffect(() => {
    new Promise(resolve => setTimeout(resolve, 3000)).then(() => {
      setState(true);
    });
  }, []);

  return (
    <div css={wrapperStyle}>
      <h1 css={state ? headingStyle : headingDefaultStyle}>
        Welcome to Remix (With Emotion css Prop)
      </h1>
    </div>
  );
}
