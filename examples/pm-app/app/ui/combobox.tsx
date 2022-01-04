import * as React from "react";
import {
  Combobox as ReachCombobox,
  ComboboxInput as ReachComboboxInput,
  ComboboxList as ReachComboboxList,
  ComboboxOption as ReachComboboxOption,
  ComboboxOptionText,
  ComboboxPopover as ReachComboboxPopover,
  ComboboxButton as ReachComboboxButton
} from "@reach/combobox";
import type {
  ComboboxProps as ReachComboboxProps,
  ComboboxInputProps as ReachComboboxInputProps,
  ComboboxListProps as ReachComboboxListProps,
  ComboboxOptionProps as ReachComboboxOptionProps,
  ComboboxPopoverProps as ReachComboboxPopoverProps,
  ComboboxButtonProps as ReachComboboxButtonProps
} from "@reach/combobox";
import cx from "clsx";
import { useFieldContext, Field } from "~/ui/form";

const Combobox = React.forwardRef<HTMLDivElement, ComboboxProps>(
  (props, ref) => {
    const context = useFieldContext();
    return (
      <ReachCombobox
        as="div"
        ref={ref}
        {...props}
        className={cx(props.className, "ui--combobox", {
          "ui--combobox--invalid": context?.invalid,
          "ui--combobox--disabled": context?.disabled
        })}
      />
    );
  }
);

const ComboboxInput = React.forwardRef<HTMLInputElement, ComboboxInputProps>(
  (props, ref) => {
    return (
      <ReachComboboxInput
        as={Field}
        ref={ref}
        {...props}
        className={cx(
          props.className,
          "ui--combobox__input",
          "ui--form-field--combobox"
        )}
      />
    );
  }
);

const ComboboxPopover = React.forwardRef<HTMLDivElement, ComboboxPopoverProps>(
  (props, ref) => {
    return (
      <ReachComboboxPopover
        as="div"
        ref={ref}
        portal={false}
        {...props}
        className={cx(props.className, "ui--combobox__popover")}
      />
    );
  }
);

const ComboboxList = React.forwardRef<HTMLUListElement, ComboboxListProps>(
  (props, ref) => {
    return (
      <ReachComboboxList
        as="ul"
        ref={ref}
        {...props}
        className={cx(props.className, "ui--combobox__list")}
      />
    );
  }
);

const ComboboxOption = React.forwardRef<HTMLLIElement, ComboboxOptionProps>(
  ({ children, ...props }, ref) => {
    return (
      <ReachComboboxOption
        as="li"
        ref={ref}
        {...props}
        className={cx(props.className, "ui--combobox__option")}
      >
        <span className={cx(props.className, "ui--combobox__option-text")}>
          <ComboboxOptionText />
        </span>
      </ReachComboboxOption>
    );
  }
);

const ComboboxButton = React.forwardRef<HTMLButtonElement, ComboboxButtonProps>(
  (props, ref) => {
    const context = useFieldContext();
    return (
      <ReachComboboxButton
        as="button"
        ref={ref}
        {...props}
        className={cx(props.className, "ui--combobox__button")}
        disabled={context?.disabled || props.disabled}
      />
    );
  }
);

Combobox.displayName = "Combobox";
ComboboxInput.displayName = "ComboboxInput";
ComboboxPopover.displayName = "ComboboxPopover";
ComboboxList.displayName = "ComboboxList";
ComboboxOption.displayName = "ComboboxOption";
ComboboxButton.displayName = "ComboboxButton";

interface ComboboxProps
  extends ReachComboboxProps,
    Omit<React.ComponentPropsWithRef<"div">, keyof ReachComboboxProps> {}

interface ComboboxInputProps
  extends ReachComboboxInputProps,
    Omit<
      React.ComponentPropsWithRef<"input">,
      "type" | keyof ReachComboboxInputProps
    > {}

interface ComboboxListProps
  extends ReachComboboxListProps,
    Omit<React.ComponentPropsWithRef<"ul">, keyof ReachComboboxListProps> {}

interface ComboboxOptionProps
  extends ReachComboboxOptionProps,
    Omit<React.ComponentPropsWithRef<"li">, keyof ReachComboboxOptionProps> {}

interface ComboboxPopoverProps
  extends ReachComboboxPopoverProps,
    Omit<React.ComponentPropsWithRef<"div">, keyof ReachComboboxPopoverProps> {}

interface ComboboxButtonProps
  extends ReachComboboxButtonProps,
    Omit<
      React.ComponentPropsWithRef<"button">,
      keyof ReachComboboxButtonProps
    > {}

export {
  Combobox,
  ComboboxInput,
  ComboboxPopover,
  ComboboxList,
  ComboboxOption,
  ComboboxButton
};

export type {
  ComboboxProps,
  ComboboxInputProps,
  ComboboxPopoverProps,
  ComboboxListProps,
  ComboboxOptionProps,
  ComboboxButtonProps
};
