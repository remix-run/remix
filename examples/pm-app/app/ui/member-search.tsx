import * as React from "react";
import type { UserSecure } from "~/models";
import { useThrottle } from "~/utils/react";
import { matchSorter } from "match-sorter";
import { getUserDisplayName, getUserFromDisplayName } from "~/utils";
import {
  Combobox,
  ComboboxInput,
  ComboboxList,
  ComboboxOption,
  ComboboxPopover
} from "~/ui/combobox";
import type { ComboboxProps } from "~/ui/combobox";
import { Token, TokenDismissButton } from "~/ui/token";
import cx from "clsx";
import { useLayoutEffect } from "~/utils/react";
import { isFunction } from "~/utils";

interface MemberSearchContextValue {
  selectableUsers: UserSecure[];
  selectedUsers: UserSecure[];
  setSelectedUsers: React.Dispatch<React.SetStateAction<UserSecure[]>>;
}

const MemberSearchContext = React.createContext<MemberSearchContextValue>(
  null!
);

export function MemberSearch({
  users,
  className,
  children,
  initialSelection,
  selection,
  onSelectionChange
}: {
  users: UserSecure[];
  className?: string;
  children:
    | React.ReactNode
    | ((props: MemberSearchContextValue) => React.ReactNode);
  initialSelection?: UserSecure[];
  selection?: UserSecure[];
  onSelectionChange?: React.Dispatch<React.SetStateAction<UserSecure[]>>;
}) {
  const isControlledRef = React.useRef(selection !== undefined);
  const [valueState, setValue] = React.useState(initialSelection || []);

  const selectedUsers = isControlledRef.current ? selection! : valueState;

  const setSelectionRef = React.useRef(onSelectionChange);
  useLayoutEffect(() => {
    setSelectionRef.current = onSelectionChange;
  }, [onSelectionChange]);
  const setSelectedUsers: React.Dispatch<React.SetStateAction<UserSecure[]>> =
    React.useCallback(val => {
      const setSelection = setSelectionRef.current;
      if (!isControlledRef.current) {
        setValue(val);
      }
      setSelection && setSelection(val);
    }, []);

  const context = React.useMemo<MemberSearchContextValue>(() => {
    const selectableUsers = users.filter(u => {
      return !selectedUsers.find(sel => sel.id === u.id);
    });
    return {
      selectableUsers,
      selectedUsers,
      setSelectedUsers
    };
  }, [users, selectedUsers, setSelectedUsers]);

  return (
    <div className={cx(className, "ui--member-search")}>
      <MemberSearchContext.Provider value={context}>
        {isFunction(children) ? children(context) : children}
      </MemberSearchContext.Provider>
    </div>
  );
}

export function MemberSearchCombobox({
  className,
  ...props
}: { className?: string } & Omit<ComboboxProps, "children">) {
  const { selectableUsers, setSelectedUsers } = useMemberSearchContext();
  const [comboboxValue, setComboboxValue] = React.useState("");
  const comboboxResults = useUserMatch(selectableUsers, comboboxValue);

  function handleComboboxBlur(event: React.FocusEvent<HTMLDivElement>) {
    if (!event.currentTarget.contains(event.relatedTarget as Node)) {
      setComboboxValue("");
    }
  }

  function handleComboboxChange(event: React.ChangeEvent<HTMLInputElement>) {
    setComboboxValue(event.target.value);
  }

  function handleComboboxSelect(value: string) {
    const found = getUserFromDisplayName(selectableUsers, value);
    if (found) {
      setSelectedUsers(selectedUsers => selectedUsers.concat([found!]));
    }
    setComboboxValue("");
  }

  return (
    <Combobox
      aria-label="Choose a team member"
      onSelect={handleComboboxSelect}
      onBlur={handleComboboxBlur}
      className={cx("ui--member-search__combobox", className)}
      {...props}
    >
      <ComboboxInput
        autocomplete={false}
        onChange={handleComboboxChange}
        value={comboboxValue}
      />
      {comboboxResults && comboboxResults.length > 0 ? (
        <ComboboxPopover>
          <ComboboxList>
            {comboboxResults.slice(0, 10).map(result => (
              <ComboboxOption
                key={result.id}
                value={getUserDisplayName(result)}
              />
            ))}
          </ComboboxList>
        </ComboboxPopover>
      ) : null}
    </Combobox>
  );
}

export function MemberSearchSelections({ className }: { className?: string }) {
  const { selectedUsers, setSelectedUsers } = useMemberSearchContext();

  return (
    <div
      className={cx(className, "ui--member-search__selections")}
      onKeyDown={handleMemberListKeyDown}
      onBlur={handleMemberListBlur}
      onFocus={handleMemberListFocus}
    >
      {selectedUsers.map(selection => {
        return (
          <MemberToken
            key={selection.id}
            value={getUserDisplayName(selection)}
            className={"ui--member-search__selection-token"}
            remove={val => {
              setSelectedUsers(s =>
                s.filter(u => getUserDisplayName(u) !== val)
              );
            }}
          />
        );
      })}
    </div>
  );
}

export function MemberSearchHiddenField({ name }: { name: string }) {
  const { selectedUsers } = useMemberSearchContext();
  return (
    <input
      type="hidden"
      name={name}
      value={JSON.stringify(selectedUsers.map(u => u.id))}
    />
  );
}

function useUserMatch(users: UserSecure[], term: string) {
  const throttledTerm = useThrottle(term, 100);
  return React.useMemo(
    () =>
      throttledTerm.trim() === ""
        ? null
        : matchSorter(users, throttledTerm, {
            keys: [user => getUserDisplayName(user)]
          }),
    [throttledTerm, users]
  );
}

function MemberToken({
  value,
  remove,
  ...props
}: React.ComponentPropsWithoutRef<"span"> & {
  value: string;
  remove: (value: string) => void;
}) {
  return (
    <Token {...props}>
      {value}
      <TokenDismissButton
        aria-label={`Remove ${value}`}
        onClick={() => remove(value)}
      />
    </Token>
  );
}

function handleMemberListFocus(event: React.FocusEvent<HTMLElement>) {
  const target = event.target;
  if (!(target instanceof HTMLElement)) return;

  const listItem = target.parentElement!;
  const list = listItem.parentElement!;
  for (const button of list.querySelectorAll("button")) {
    button.setAttribute(
      "tabIndex",
      button.parentElement === listItem ? "0" : "-1"
    );
  }
}

function handleMemberListBlur(event: React.FocusEvent<HTMLElement>) {
  const list = event.currentTarget;
  if (!list.contains(event.relatedTarget)) {
    for (const button of list.querySelectorAll("button")) {
      button.removeAttribute("tabIndex");
    }
  }
}

function handleMemberListKeyDown(event: React.KeyboardEvent<HTMLElement>) {
  if (
    ![
      "ArrowUp",
      "ArrowDown",
      "ArrowLeft",
      "ArrowRight",
      "Home",
      "End"
    ].includes(event.key)
  ) {
    return;
  }

  const list = event.currentTarget!;
  const activeElement = document.activeElement as HTMLElement | null;
  const listButtons = Array.from(
    list.querySelectorAll<HTMLButtonElement>("button")
  );
  const currentIndex = listButtons.findIndex(el => el === activeElement);

  switch (event.key) {
    case "ArrowLeft":
    case "ArrowUp": {
      if (currentIndex === 0) {
        listButtons[listButtons.length - 1].focus();
      } else {
        listButtons[(currentIndex - 1) % listButtons.length]?.focus();
      }
      return;
    }
    case "ArrowRight":
    case "ArrowDown": {
      listButtons[(currentIndex + 1) % listButtons.length]?.focus();
      return;
    }
    case "Home":
      listButtons[0].focus();
      return;
    case "End":
      listButtons[listButtons.length - 1].focus();
      return;
  }
}

export function useMemberSearchContext() {
  const ctx = React.useContext(MemberSearchContext);
  if (!MemberSearchContext) {
    throw Error("Called useMemberSearchContext outside of its provider!");
  }
  return ctx;
}
