import * as React from "react";
import {
  DialogOverlay as ReachDialogOverlay,
  DialogContent as ReachDialogContent
} from "@reach/dialog";
import type {
  DialogProps as ReachDialogProps,
  DialogOverlayProps as ReachDialogOverlayProps,
  DialogContentProps as ReachDialogContentProps
} from "@reach/dialog";
import { IconX } from "./icons";
import cx from "clsx";
import { composeEventHandlers } from "~/utils";

const DialogContext = React.createContext<any>(null);

const DialogOverlay = React.forwardRef<HTMLDivElement, DialogOverlayProps>(
  ({ children, ...props }, ref) => {
    return (
      <ReachDialogOverlay
        data-cooooool=""
        {...props}
        ref={ref}
        className={cx("ui--dialog ui--dialog__overlay", props.className)}
      >
        <DialogContext.Provider value={{ onDismiss: props.onDismiss }}>
          {children}
        </DialogContext.Provider>
      </ReachDialogOverlay>
    );
  }
);

const DialogContent = React.forwardRef<HTMLDivElement, DialogContentProps>(
  ({ children, ...props }, ref) => {
    return (
      <ReachDialogContent
        {...props}
        ref={ref}
        className={cx("ui--dialog__content", props.className)}
      >
        {children}
      </ReachDialogContent>
    );
  }
);

const Dialog = React.forwardRef<HTMLDivElement, DialogProps>(
  (
    {
      allowPinchZoom = false,
      initialFocusRef,
      isOpen,
      onDismiss,
      children,
      ...props
    },
    ref
  ) => {
    return (
      <DialogOverlay
        allowPinchZoom={allowPinchZoom}
        initialFocusRef={initialFocusRef}
        isOpen={isOpen}
        onDismiss={onDismiss}
      >
        <DialogContent ref={ref} {...props}>
          {children}
        </DialogContent>
      </DialogOverlay>
    );
  }
);

const DialogCloseButton = React.forwardRef<
  HTMLButtonElement,
  DialogCloseButtonProps
>(({ className, onClick, ...props }, ref) => {
  const { onDismiss } = React.useContext(DialogContext);
  return (
    <button
      ref={ref}
      type="button"
      aria-label="Close Dialog"
      onClick={composeEventHandlers(onClick, onDismiss)}
      className={cx(className, "ui--dialog__close-button")}
      title="Close dialog"
      {...props}
    >
      <IconX aria-hidden height={16} width={16} />
    </button>
  );
});

Dialog.displayName = "Dialog";
DialogOverlay.displayName = "DialogOverlay";
DialogContent.displayName = "DialogContent";
DialogCloseButton.displayName = "DialogCloseButton";

export { Dialog, DialogContent, DialogOverlay, DialogCloseButton };

interface DialogProps
  extends ReachDialogProps,
    Omit<React.ComponentPropsWithRef<"div">, keyof ReachDialogProps> {}

interface DialogOverlayProps
  extends ReachDialogOverlayProps,
    Omit<React.ComponentPropsWithRef<"div">, keyof ReachDialogOverlayProps> {}

interface DialogContentProps
  extends ReachDialogContentProps,
    Omit<React.ComponentPropsWithRef<"div">, keyof ReachDialogContentProps> {}

interface DialogCloseButtonProps
  extends Omit<React.ComponentPropsWithRef<"button">, "children"> {}
