import { forwardRef } from "react";

import styles from "./Button.module.css";

const Button = forwardRef(({ children, ...props }) => {
  return (
    <button
      data-test-id="button"
      {...props}
      className={
        props.className ? props.className + " " + styles.button : styles.button
      }
    >
      {children}
    </button>
  );
});
Button.displayName = "Button";
export default Button;
