import { column as c, table } from "remix/data-table";
import type { TableRow } from "remix/data-table";

export const guestBook = table({
  name: "guestbook",
  columns: {
    id: c.integer().primaryKey().autoIncrement(),
    name: c.text(),
    createdAt: c.integer(),
  },
  beforeWrite({ operation, value }) {
    const next = { ...value };

    if (operation === "create") {
      next.createdAt = Date.now();
    }

    return { value: next };
  },
});

export type GuestBookEntry = TableRow<typeof guestBook>;
