import admin from "firebase-admin/app";
import client from "firebase/app";
import { getAuth as getServerAuth } from "firebase-admin/auth";
import { getAuth as getClientAuth } from "firebase/auth";

if (client.getApps().length === 0) {
  client.initializeApp(JSON.parse(process.env.CLIENT_CONFIG as string));
}

if (admin.getApps().length === 0) {
  admin.initializeApp({
    credential: admin.cert(JSON.parse(process.env.SERVICE_ACCOUNT as string)),
  });
}

export const auth = {
  server: getServerAuth(),
  client: getClientAuth(),
};
