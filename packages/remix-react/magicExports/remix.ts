/* eslint-disable import/no-extraneous-dependencies */

import * as react from "@remix-run/react";
import type * as ReactTypes from "@remix-run/react";

const warn = <T extends Function>(fn: T, message: string): T =>
  ((...args: unknown[]) => {
    console.warn(message);

    return fn(...args);
  }) as unknown as T;

const getDeprecatedMessage = (functionName: string, packageName: string) =>
  `All \`remix\` exports are considered deprecated as of v1.3.3. Please import \`${functionName}\` from \`@remix-run/${packageName}\` instead. You can run \`remix migrate --migration replace-remix-imports\` to automatically migrate your code.`;

// Re-export everything from this package that is available in `remix`.
// Note: We need to name all exports individually so the compiler is able
// to remove the ones we don't need in the browser builds.

/** @deprecated Import `Form` from `@remix-run/react` instead. */
export const Form = warn(react.Form, getDeprecatedMessage("Form", "react"));
/** @deprecated Import `Link` from `@remix-run/react` instead. */
export const Link = warn(react.Link, getDeprecatedMessage("Link", "react"));
/** @deprecated Import `Links` from `@remix-run/react` instead. */
export const Links = warn(react.Links, getDeprecatedMessage("Links", "react"));
/** @deprecated Import `LiveReload` from `@remix-run/react` instead. */
export const LiveReload = warn(
  react.LiveReload,
  getDeprecatedMessage("LiveReload", "react")
);
/** @deprecated Import `Meta` from `@remix-run/react` instead. */
export const Meta = warn(react.Meta, getDeprecatedMessage("Meta", "react"));
/** @deprecated Import `NavLink` from `@remix-run/react` instead. */
export const NavLink = warn(
  react.NavLink,
  getDeprecatedMessage("NavLink", "react")
);
/** @deprecated Import `PrefetchPageLinks` from `@remix-run/react` instead. */
export const PrefetchPageLinks = warn(
  react.PrefetchPageLinks,
  getDeprecatedMessage("PrefetchPageLinks", "react")
);
/** @deprecated Import `RemixBrowser` from `@remix-run/react` instead. */
export const RemixBrowser = warn(
  react.RemixBrowser,
  getDeprecatedMessage("RemixBrowser", "react")
);
/** @deprecated Import `RemixServer` from `@remix-run/react` instead. */
export const RemixServer = warn(
  react.RemixServer,
  getDeprecatedMessage("RemixServer", "react")
);
/** @deprecated Import `Scripts` from `@remix-run/react` instead. */
export const Scripts = warn(
  react.Scripts,
  getDeprecatedMessage("Scripts", "react")
);
/** @deprecated Import `ScrollRestoration` from `@remix-run/react` instead. */
export const ScrollRestoration = warn(
  react.ScrollRestoration,
  getDeprecatedMessage("ScrollRestoration", "react")
);
/** @deprecated Import `useActionData` from `@remix-run/react` instead. */
export const useActionData = warn(
  react.useActionData,
  getDeprecatedMessage("useActionData", "react")
);
/** @deprecated Import `useBeforeUnload` from `@remix-run/react` instead. */
export const useBeforeUnload = warn(
  react.useBeforeUnload,
  getDeprecatedMessage("useBeforeUnload", "react")
);
/** @deprecated Import `useCatch` from `@remix-run/react` instead. */
export const useCatch = warn(
  react.useCatch,
  getDeprecatedMessage("useCatch", "react")
);
/** @deprecated Import `useFetcher` from `@remix-run/react` instead. */
export const useFetcher = warn(
  react.useFetcher,
  getDeprecatedMessage("useFetcher", "react")
);
/** @deprecated Import `useFetchers` from `@remix-run/react` instead. */
export const useFetchers = warn(
  react.useFetchers,
  getDeprecatedMessage("useFetchers", "react")
);
/** @deprecated Import `useFormAction` from `@remix-run/react` instead. */
export const useFormAction = warn(
  react.useFormAction,
  getDeprecatedMessage("useFormAction", "react")
);
/** @deprecated Import `useLoaderData` from `@remix-run/react` instead. */
export const useLoaderData = warn(
  react.useLoaderData,
  getDeprecatedMessage("useLoaderData", "react")
);
/** @deprecated Import `useMatches` from `@remix-run/react` instead. */
export const useMatches = warn(
  react.useMatches,
  getDeprecatedMessage("useMatches", "react")
);
/** @deprecated Import `useSubmit` from `@remix-run/react` instead. */
export const useSubmit = warn(
  react.useSubmit,
  getDeprecatedMessage("useSubmit", "react")
);
/** @deprecated Import `useTransition` from `@remix-run/react` instead. */
export const useTransition = warn(
  react.useTransition,
  getDeprecatedMessage("useTransition", "react")
);

// react-router-dom exports
/** @deprecated Import `Outlet` from `@remix-run/react` instead. */
export const Outlet = warn(
  react.Outlet,
  getDeprecatedMessage("Outlet", "react")
);
/** @deprecated Import `useHref` from `@remix-run/react` instead. */
export const useHref = warn(
  react.useHref,
  getDeprecatedMessage("useHref", "react")
);
/** @deprecated Import `useLocation` from `@remix-run/react` instead. */
export const useLocation = warn(
  react.useLocation,
  getDeprecatedMessage("useLocation", "react")
);
/** @deprecated Import `useNavigate` from `@remix-run/react` instead. */
export const useNavigate = warn(
  react.useNavigate,
  getDeprecatedMessage("useNavigate", "react")
);
/** @deprecated Import `useNavigationType` from `@remix-run/react` instead. */
export const useNavigationType = warn(
  react.useNavigationType,
  getDeprecatedMessage("useNavigationType", "react")
);
/** @deprecated Import `useOutlet` from `@remix-run/react` instead. */
export const useOutlet = warn(
  react.useOutlet,
  getDeprecatedMessage("useOutlet", "react")
);
/** @deprecated Import `useOutletContext` from `@remix-run/react` instead. */
export const useOutletContext = warn(
  react.useOutletContext,
  getDeprecatedMessage("useOutletContext", "react")
);
/** @deprecated Import `useParams` from `@remix-run/react` instead. */
export const useParams = warn(
  react.useParams,
  getDeprecatedMessage("useParams", "react")
);
/** @deprecated Import `useResolvedPath` from `@remix-run/react` instead. */
export const useResolvedPath = warn(
  react.useResolvedPath,
  getDeprecatedMessage("useResolvedPath", "react")
);
/** @deprecated Import `useSearchParams` from `@remix-run/react` instead. */
export const useSearchParams = warn(
  react.useSearchParams,
  getDeprecatedMessage("useSearchParams", "react")
);

/** @deprecated Import type `FormEncType` from `@remix-run/react` instead. */
export type FormEncType = ReactTypes.FormEncType;
/** @deprecated Import type `FormMethod` from `@remix-run/react` instead. */
export type FormMethod = ReactTypes.FormMethod;
/** @deprecated Import type `FormProps` from `@remix-run/react` instead. */
export type FormProps = ReactTypes.FormProps;
/** @deprecated Import type `LinkProps` from `@remix-run/react` instead. */
export type LinkProps = ReactTypes.LinkProps;
/** @deprecated Import type `NavLinkProps` from `@remix-run/react` instead. */
export type NavLinkProps = ReactTypes.NavLinkProps;
/** @deprecated Import type `RemixBrowserProps` from `@remix-run/react` instead. */
export type RemixBrowserProps = ReactTypes.RemixBrowserProps;
/** @deprecated Import type `RemixServerProps` from `@remix-run/react` instead. */
export type RemixServerProps = ReactTypes.RemixServerProps;
/** @deprecated Import type `ShouldReloadFunction` from `@remix-run/react` instead. */
export type ShouldReloadFunction = ReactTypes.ShouldReloadFunction;
/** @deprecated Import type `SubmitFunction` from `@remix-run/react` instead. */
export type SubmitFunction = ReactTypes.SubmitFunction;
/** @deprecated Import type `SubmitOptions` from `@remix-run/react` instead. */
export type SubmitOptions = ReactTypes.SubmitOptions;
/** @deprecated Import type `ThrownResponse` from `@remix-run/react` instead. */
export type ThrownResponse = ReactTypes.ThrownResponse;
