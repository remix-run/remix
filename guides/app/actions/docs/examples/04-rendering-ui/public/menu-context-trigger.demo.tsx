import { css, type Handle } from "remix/ui";
import { MenuItem, MenuList, Submenu } from "remix/components/menu";
import * as menu from "remix/ui/menu";
import { onMenuSelect } from "remix/ui/menu";

type FileAction =
  | "copyPath"
  | "duplicate"
  | "move"
  | "rename"
  | "reveal"
  | "trash";

const actionLabelByName: Record<FileAction, string> = {
  copyPath: "Copied path",
  duplicate: "Duplicated file",
  move: "Moved file",
  rename: "Renamed file",
  reveal: "Revealed in Finder",
  trash: "Moved to trash",
};

export function ContextMenuTrigger(handle: Handle) {
  let latestAction = "Right-click the card.";

  return () => (
    <menu.Context label="File actions">
      <div mix={layoutCss}>
        <div tabIndex={0} mix={[fileCardCss, menu.contextTrigger()]}>
          <span mix={fileIconCss}>TS</span>
          <span mix={fileTextCss}>
            <strong mix={fileNameCss}>context-menu.tsx</strong>
            <span mix={fileMetaCss}>Right-click or press Shift+F10</span>
          </span>
        </div>

        <p aria-live="polite" mix={statusCss}>
          {latestAction}
        </p>
      </div>

      <MenuList
        mix={onMenuSelect((event) => {
          latestAction =
            actionLabelByName[event.item.name as FileAction] ??
            `Selected ${event.item.label}`;
          void handle.update();
        })}
      >
        <MenuItem name="rename">Rename</MenuItem>
        <MenuItem name="duplicate">Duplicate</MenuItem>
        <MenuItem name="copyPath">Copy path</MenuItem>
        <hr mix={separatorCss} />
        <Submenu label="Move to">
          <MenuItem name="move" value="drafts">
            Drafts
          </MenuItem>
          <MenuItem name="move" value="archive">
            Archive
          </MenuItem>
        </Submenu>
        <MenuItem name="reveal">Reveal in Finder</MenuItem>
        <hr mix={separatorCss} />
        <MenuItem name="trash">Move to trash</MenuItem>
      </MenuList>
    </menu.Context>
  );
}

const layoutCss = css({
  display: "grid",
  justifyItems: "start",
  gap: "12px",
});

const separatorCss = css({
  marginBlock: "4px",
  marginInline: "8px",
  border: 0,
  borderTop: "1px solid #e7e7e7",
});

const fileCardCss = css({
  display: "grid",
  gridTemplateColumns: "auto minmax(0, 1fr)",
  alignItems: "center",
  gap: "12px",
  width: "min(100%, 21rem)",
  padding: "12px",
  border: "1px solid #e7e7e7",
  borderRadius: "12px",
  backgroundColor: "#f8f8f8",
  color: "#151515",
  boxShadow: "0 1px 1px rgb(0 0 0 / 0.05)",
  cursor: "context-menu",
  userSelect: "none",
  "&:focus-visible": {
    outline: "2px solid #1A72FF",
    outlineOffset: "2px",
  },
});

const fileIconCss = css({
  display: "inline-grid",
  placeItems: "center",
  width: "36px",
  height: "36px",
  borderRadius: "8px",
  backgroundColor: "#1A72FF",
  color: "rgb(255 255 255 / 0.92)",
  fontSize: "12px",
  fontWeight: "700",
});

const fileTextCss = css({
  display: "grid",
  gap: "1px",
  minWidth: 0,
});

const fileNameCss = css({
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  fontSize: "13px",
  lineHeight: "1.45",
});

const fileMetaCss = css({
  color: "#4f4f4f",
  fontSize: "12px",
  lineHeight: "1.45",
});

const statusCss = css({
  margin: 0,
  minHeight: "1.45em",
  color: "#4f4f4f",
  fontSize: "13px",
  lineHeight: "1.45",
});
