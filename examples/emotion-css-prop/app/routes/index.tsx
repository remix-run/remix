/** @jsx jsx */
import { jsx, css } from "@emotion/react";

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
  font-weight: 700;
  color: hotpink;
`;

export default function Index() {
  return (
    <div css={wrapperStyle}>
      <h1 css={headingStyle}>Welcome to Remix (With Emotion css Prop)</h1>
    </div>
  );
}
