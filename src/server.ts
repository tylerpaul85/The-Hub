import "./lib/error-capture";

import { consumeLastCapturedError } from "./lib/error-capture";
import { renderErrorPage } from "./lib/error-page";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// h3 swallows in-handler throws into a normal 500 Response with body
// {"unhandled":true,"message":"HTTPError"} — try/catch alone never fires for those.
async function normalizeCatastrophicSsrResponse(response: Response): Promise<Response> {
  if (response.status < 500) return response;
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) return response;

  const body = await response.clone().text();
  if (!body.includes('"unhandled":true') || !body.includes('"message":"HTTPError"')) {
    return response;
  }

  const err = consumeLastCapturedError();
  console.error(err ?? new Error(`h3 swallowed SSR error: ${body}`));

  const isProd = typeof process !== "undefined" && process.env?.NODE_ENV === "production";
  const responseBody = isProd
    ? "An internal error occurred. Please try again later."
    : `Catastrophic SSR Error: ${err?.message || "HTTPError"}\nStack:\n${err?.stack || ""}\nBody: ${body}`;

  return new Response(responseBody, {
    status: 500,
    headers: { "content-type": "text/plain; charset=utf-8" },
  });
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return await normalizeCatastrophicSsrResponse(response);
    } catch (error: any) {
      console.error(error);

      const isProd = typeof process !== "undefined" && process.env?.NODE_ENV === "production";
      const responseBody = isProd
        ? "An internal error occurred. Please try again later."
        : `Server Error: ${error?.message || error}\nStack:\n${error?.stack || ""}`;

      return new Response(responseBody, {
        status: 500,
        headers: { "content-type": "text/plain; charset=utf-8" },
      });
    }
  },
};
