import * as React from "react";
import { Link, NavLink } from "~/ui/link";
import type { LinkProps, NavLinkProps } from "react-router-dom";
import cx from "clsx";

// TODO: Light mode for docs usage

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (props, ref) => {
    const { variant, size, rounded, children, ...domProps } = props;
    return (
      <button ref={ref} {...domProps} className={getButtonClassNames(props)}>
        <span className="ui--button__inner">{children}</span>
      </button>
    );
  }
);

const ButtonLink = React.forwardRef<HTMLAnchorElement, ButtonLinkProps>(
  (props, ref) => {
    const { variant, size, disabled, rounded, children, ...domProps } = props;
    return (
      <Link
        ref={ref}
        aria-disabled={disabled || undefined}
        tabIndex={disabled ? -1 : undefined}
        {...domProps}
        className={getButtonClassNames(props)}
      >
        <span className="ui--button__inner">{children}</span>
      </Link>
    );
  }
);

const ButtonNavLink = React.forwardRef<HTMLAnchorElement, ButtonNavLinkProps>(
  (props, ref) => {
    const { variant, size, disabled, rounded, children, ...domProps } = props;
    return (
      <NavLink
        ref={ref}
        aria-disabled={disabled || undefined}
        tabIndex={disabled ? -1 : undefined}
        {...domProps}
        className={({ isActive }) =>
          getButtonClassNames({ ...props, isActive })
        }
      >
        <span className="ui--button__inner">{children}</span>
      </NavLink>
    );
  }
);

/**
 * `ButtonDiv` should be used only when something is semantically not a button
 * but needs to look like one. It does not add a role or any aria props.
 */
const ButtonDiv = React.forwardRef<HTMLDivElement, ButtonDivProps>(
  (props, ref) => {
    const { variant, size, disabled, rounded, children, ...domProps } = props;
    return (
      <div
        ref={ref}
        {...domProps}
        className={cx(
          props.className,
          getButtonClassNames(props),
          "ui--button--div"
        )}
      >
        <span className="ui--button__inner">{children}</span>
      </div>
    );
  }
);

Button.displayName = "Button";
ButtonLink.displayName = "ButtonLink";
ButtonNavLink.displayName = "ButtonNavLink";
ButtonDiv.displayName = "ButtonDiv";

function getButtonClassNames({
  className,
  variant = "primary",
  disabled = false,
  isActive = false, // for active NavLink styles,
  rounded,
  size = "base"
}: {
  className?: string | ((props: { isActive: boolean }) => string);
  variant?: ButtonVariant;
  disabled?: boolean;
  isActive?: boolean;
  size?: ButtonSize;
  rounded?: boolean;
}) {
  return cx(
    typeof className === "function" ? className({ isActive }) : className,
    "ui--button",
    `ui--button--${variant}`,
    `ui--button--size-${size}`,
    {
      // all disabled buttons
      "ui--button--disabled": disabled,
      "ui--button--rounded": rounded
    }
  )
    .replace(/\s+/g, " ")
    .trim();
}

// Based on the variants in the designs
type ButtonVariant = "primary" | "secondary" | "danger" /* | "transparent" */;
type ButtonSize = "small" | "base" | "large";

interface ButtonSharedProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  rounded?: boolean;
}

interface ButtonProps
  extends React.ComponentPropsWithRef<"button">,
    ButtonSharedProps {}
interface ButtonDivProps
  extends React.ComponentPropsWithRef<"div">,
    ButtonSharedProps {}
interface ButtonLinkProps extends LinkProps, ButtonSharedProps {}
interface ButtonNavLinkProps extends NavLinkProps, ButtonSharedProps {}

export type {
  ButtonProps,
  ButtonLinkProps,
  ButtonNavLinkProps,
  ButtonDivProps
};
export { Button, ButtonLink, ButtonNavLink, ButtonDiv };
