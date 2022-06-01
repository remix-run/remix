import {
  getApps as getServerApps,
  initializeApp as initializeServerApp,
  cert as serverCert,
} from "firebase-admin/app";
import {
  getApps as getClientApps,
  initializeApp as initializeClientApp,
} from "firebase/app";
import { getAuth as getServerAuth } from "firebase-admin/auth";
import { getAuth as getClientAuth, connectAuthEmulator } from "firebase/auth";

if (getClientApps().length === 0) {
  let config,
    useEmulator = false;
  if (process.env.NODE_ENV === "development" && !process.env.CLIENT_CONFIG) {
    console.warn(
      "Missing CLIENT_CONFIG environment variable, using local emulator"
    );
    config = {
      apiKey: "fake-api-key",
      projectId: "remix-emulator",
    };
    useEmulator = true;
  } else if (!process.env.CLIENT_CONFIG) {
    throw new Error("Missing CLIENT_CONFIG environment variable, ");
  } else {
    try {
      config = JSON.parse(process.env.CLIENT_CONFIG);
    } catch {
      throw Error("Invalid CLIENT_CONFIG environment variable");
    }
  }
  initializeClientApp(config);
  if (useEmulator) {
    connectAuthEmulator(getClientAuth(), "http://localhost:9099");
  }
}

if (getServerApps().length === 0) {
  let config;
  if (process.env.NODE_ENV === "development" && !process.env.SERVICE_ACCOUNT) {
    console.warn(
      "Missing SERVICE_ACCOUNT environment variable, using local emulator"
    );
    // https://github.com/firebase/firebase-admin-node/issues/776
    process.env.FIRESTORE_EMULATOR_HOST = "localhost:8080";
    process.env.FIREBASE_AUTH_EMULATOR_HOST = "localhost:9099";
    config = {
      projectId: "remix-emulator",
    };
  } else if (!process.env.SERVICE_ACCOUNT) {
    throw new Error("Missing SERVICE_ACCOUNT environment variable");
  } else {
    try {
      const serviceAccount = JSON.parse(process.env.SERVICE_ACCOUNT);
      config = {
        credential: serverCert(serviceAccount),
      };
    } catch {
      throw Error("Invalid SERVICE_ACCOUNT environment variable");
    }
  }
  initializeServerApp(config);
}

export const auth = {
  server: getServerAuth(),
  client: getClientAuth(),
};
