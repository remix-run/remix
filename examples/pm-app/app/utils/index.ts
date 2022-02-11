import type { RemoveIndex } from "~/utils/types";

export function getUserDisplayName(user: {
  nameFirst: string;
  nameLast?: string | null;
}) {
  return [user.nameFirst, user.nameLast].filter(Boolean).join(" ");
}

export function getUserFromDisplayName<
  U extends { nameFirst: string; nameLast?: string | null }
>(users: Array<U>, displayName: string) {
  return users.find(u => getUserDisplayName(u) === displayName);
}

export const canUseDOM: boolean = !!(
  typeof window !== "undefined" &&
  typeof window.document !== "undefined" &&
  typeof window.document.createElement !== "undefined"
);

export function getClientSafeEnvVariable<
  K extends keyof RemoveIndex<Exclude<Window["ENV"], undefined>>
>(key: K): Exclude<Window["ENV"], undefined>[K] {
  if (typeof window !== "undefined") {
    try {
      const ENV = window.ENV;
      if (!ENV) {
        throw Error(
          `ENV is not available in the browser in this context. Check \`root.tsx\` and make sure you're setting \`window.ENV\` before rendering \`<Scripts />\`.`
        );
      }
      if (ENV[key] === undefined) {
        throw Error(
          `The environment variable \`${key}\` is not available in the browser in this context.`
        );
      }
      return ENV[key];
    } catch (err) {
      console.error(
        "There was an error parsing window.ENV. See https://docs.remix.run/v0.20/guides/envvars/#environment-variables-for-the-browser"
      );
      throw err;
    }
  } else {
    return process.env[key];
  }
}

export function getServerSafeEnvVariable<
  K extends keyof RemoveIndex<NodeJS.ProcessEnv>
>(key: K): Exclude<NodeJS.ProcessEnv[K], undefined> {
  try {
    const val: any = process.env[key];
    if (!val) {
      throw Error(`Missing env variable: ${key}`);
    }
    return val;
  } catch (_) {
    throw Error(
      "You tried to access a server-side environment variable on the client!"
    );
  }
}

export function composeEventHandlers<
  EventType extends React.SyntheticEvent | Event
>(
  theirHandler: ((event: EventType) => any) | undefined,
  ourHandler: (event: EventType) => any
): (event: EventType) => any {
  return event => {
    theirHandler && theirHandler(event);
    if (!event.defaultPrevented) {
      return ourHandler(event);
    }
  };
}

export function isExternalUrl(str: string) {
  return /^((https?:|s?ftp:|file:\/|chrome:)?\/\/|mailto:|tel:)/.test(
    str.toLowerCase()
  );
}

export function isObject(value: any): value is object {
  const type = typeof value;
  return value != null && (type === "object" || type === "function");
}

export function isFunction(val: any): val is Function {
  return typeof val === "function";
}

export function isPlainObject(value: any): boolean {
  let tag: string;
  if (value == null) {
    tag = value === undefined ? "[object Undefined]" : "[object Null]";
  } else {
    tag = Object.prototype.toString.call(value);
  }

  if (!isObjectLike(value) || tag != "[object Object]") {
    return false;
  }
  if (Object.getPrototypeOf(value) === null) {
    return true;
  }
  let proto = value;
  while (Object.getPrototypeOf(proto) !== null) {
    proto = Object.getPrototypeOf(proto);
  }
  return Object.getPrototypeOf(value) === proto;
}

export function isObjectLike(value: any): boolean {
  return typeof value === "object" && value !== null;
}
