import DataLoader from "dataloader";
import { db } from "~/data.server";

export const usersById = new DataLoader(async (keys: Readonly<string[]>) =>
  db.user.findMany({
    where: {
      id: {
        in: keys
      }
    }
  })
);
