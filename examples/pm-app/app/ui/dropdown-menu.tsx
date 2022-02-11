import * as React from "react";
import cx from "clsx";
import { Link } from "~/ui/link";
import type { LinkProps } from "~/ui/link";
import { Button } from "~/ui/button";
import {
  Menu as ReachMenu,
  MenuButton as ReachMenuButton,
  MenuPopover as ReachMenuPopover,
  MenuItem as ReachMenuItem,
  MenuLink as ReachMenuLink,
  MenuItems as ReachMenuItems
} from "@reach/menu-button";
import type {
  MenuProps as ReachMenuProps,
  MenuButtonProps as ReachMenuButtonProps,
  MenuPopoverProps as ReachMenuPopoverProps,
  MenuItemProps as ReachMenuItemProps,
  MenuLinkProps as ReachMenuLinkProps,
  MenuItemsProps as ReachMenuItemsProps
} from "@reach/menu-button";
import { IconDots } from "~/ui/icons";

const DropdownMenu = React.forwardRef<HTMLDivElement, DropdownMenuProps>(
  ({ className, children, id, ...props }, ref) => {
    return (
      <div ref={ref} id={id} className={cx(className, "ui--dropdown-menu")}>
        <ReachMenu id={id} {...props}>
          {children}
        </ReachMenu>
      </div>
    );
  }
);
DropdownMenu.displayName = "DropdownMenu";

const DropdownMenuButton = React.forwardRef<
  HTMLButtonElement,
  DropdownMenuButtonProps
>(({ className, ...props }, ref) => {
  return (
    <ReachMenuButton
      as={Button}
      ref={ref}
      className={cx(className, "ui--dropdown-menu__button")}
      {...props}
    />
  );
});
DropdownMenuButton.displayName = "DropdownMenuButton";

const DropdownMenuButtonUnstyled = React.forwardRef<
  HTMLButtonElement,
  DropdownMenuButtonProps
>(({ className, ...props }, ref) => {
  return (
    <ReachMenuButton
      ref={ref}
      className={cx(
        className,
        "ui--dropdown-menu__button ui--dropdown-menu__button--unstyled"
      )}
      {...props}
    />
  );
});
DropdownMenuButtonUnstyled.displayName = "DropdownMenuButtonUnstyled";

const DropdownMenuOptionsButton = React.forwardRef<
  HTMLButtonElement,
  Omit<DropdownMenuButtonProps, "children"> & { size?: 6 | 8 | 10 }
>(({ className, size, ...props }, ref) => {
  return (
    <ReachMenuButton
      ref={ref}
      className={cx(
        className,
        "ui--dropdown-menu__button",
        "ui--dropdown-menu__options-button",
        {
          "ui--dropdown-menu__options-button--size-8": size === 8,
          "ui--dropdown-menu__options-button--size-10": size === 10
        }
      )}
      aria-label="Options"
      {...props}
    >
      <span className="ui--dropdown-menu__options-button__inner">
        <IconDots aria-hidden />
      </span>
    </ReachMenuButton>
  );
});
DropdownMenuOptionsButton.displayName = "DropdownMenuOptionsButton";

const DropdownMenuPopover = React.forwardRef<
  HTMLDivElement,
  DropdownMenuPopoverProps
>(({ className, ...props }, ref) => {
  return (
    <ReachMenuPopover
      ref={ref}
      className={cx(className, "ui--dropdown-menu__popover")}
      // portal={false}
      {...props}
    />
  );
});
DropdownMenuPopover.displayName = "DropdownMenuPopover";

const DropdownMenuList = React.forwardRef<
  HTMLDivElement,
  DropdownMenuListProps
>(({ className, ...props }, ref) => {
  return (
    <ReachMenuItems
      ref={ref}
      className={cx(className, "ui--dropdown-menu__list")}
      {...props}
    />
  );
});
DropdownMenuList.displayName = "DropdownMenuList";

const DropdownMenuItem = React.forwardRef<
  HTMLDivElement,
  DropdownMenuItemProps
>(({ className, onSelect = () => {}, variant, ...props }, ref) => {
  return (
    <ReachMenuItem
      ref={ref}
      className={cx(
        className,
        "ui--dropdown-menu__item",
        variant && `ui--dropdown-menu__item--${variant}`
      )}
      onSelect={onSelect}
      {...props}
    />
  );
});
DropdownMenuItem.displayName = "DropdownMenuItem";

const DropdownMenuItemLink = React.forwardRef<
  HTMLAnchorElement,
  DropdownMenuItemLinkProps
>(({ className, ...props }, ref) => {
  return (
    <ReachMenuLink
      as={Link}
      ref={ref}
      className={cx(
        className,
        "ui--dropdown-menu__item",
        "ui--dropdown-menu__item-link"
      )}
      {...props}
    />
  );
});
DropdownMenuItem.displayName = "DropdownMenuItem";

export {
  DropdownMenu,
  DropdownMenuButton,
  DropdownMenuButtonUnstyled,
  DropdownMenuOptionsButton,
  DropdownMenuPopover,
  DropdownMenuList,
  DropdownMenuItem,
  DropdownMenuItemLink
};

export interface DropdownMenuProps
  extends Omit<ReachMenuProps, "id">,
    Omit<React.ComponentPropsWithRef<"div">, keyof ReachMenuProps> {
  id: string;
}

export interface DropdownMenuButtonProps
  extends ReachMenuButtonProps,
    Omit<React.ComponentPropsWithRef<"button">, keyof ReachMenuButtonProps> {}

export interface DropdownMenuPopoverProps
  extends ReachMenuPopoverProps,
    Omit<React.ComponentPropsWithRef<"div">, keyof ReachMenuPopoverProps> {}

export interface DropdownMenuListProps
  extends ReachMenuItemsProps,
    Omit<React.ComponentPropsWithRef<"div">, keyof ReachMenuItemsProps> {}

export interface DropdownMenuItemProps
  extends Omit<ReachMenuItemProps, "onSelect">,
    Omit<React.ComponentPropsWithRef<"div">, keyof ReachMenuItemProps> {
  onSelect?(): void;
  variant?: "danger";
}

export interface DropdownMenuItemLinkProps
  extends ReachMenuLinkProps,
    Omit<LinkProps, keyof ReachMenuLinkProps> {}
