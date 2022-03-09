import { PrismaClient } from "@prisma/client";

let prisma: PrismaClient;

/* eslint-disable prefer-let/prefer-let */
declare global {
  var __db__: PrismaClient;
}
/* eslint-disable prefer-let/prefer-let */

// this is needed because in development we don't want to restart
// the server with every change, but we want to make sure we don't
// create a new connection to the DB with every change either.
// in production we'll have a single connection to the DB.
if (process.env.NODE_ENV === "production") {
  prisma = new PrismaClient();
} else {
  if (!global.__db__) {
    global.__db__ = new PrismaClient();
  }
  prisma = global.__db__;
  prisma.$connect();
}

export { prisma };
