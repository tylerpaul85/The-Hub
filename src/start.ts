import { createStart, createMiddleware } from "@tanstack/react-start";
import { setResponseHeaders } from "@tanstack/react-start/server";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "@/integrations/supabase/auth-attacher";

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    const errObj = error as any;

    const isProd = process.env.NODE_ENV === "production";
    const body = isProd
      ? "An internal error occurred. Please try again later."
      : `Request Error: ${errObj?.message || error}\nStack:\n${errObj?.stack || ""}`;

    return new Response(body, {
      status: 500,
      headers: { "content-type": "text/plain; charset=utf-8" },
    });
  }
});

// Security headers applied to every server response.
// X-Frame-Options is omitted in dev so the Lovable preview iframe still works;
// production gets DENY via CSP frame-ancestors.
const securityHeadersMiddleware = createMiddleware().server(async ({ next }) => {
  const isProd = process.env.NODE_ENV === "production";
  const headers: Record<string, string> = {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
  };
  if (isProd) {
    headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains; preload";
    headers["X-Frame-Options"] = "DENY";
    headers["X-Permitted-Cross-Domain-Policies"] = "none";
    headers["Content-Security-Policy"] =
      "default-src 'self'; " +
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.gpteng.co; " +
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
      "font-src 'self' data: https://fonts.gstatic.com; " +
      "img-src 'self' data: blob: https:; " +
      "media-src 'self' blob: https:; " +
      "connect-src 'self' https: wss:; " +
      "object-src 'none'; " +
      "frame-ancestors 'none'; " +
      "base-uri 'self'; " +
      "form-action 'self'; " +
      "upgrade-insecure-requests;";
  }
  try {
    setResponseHeaders(headers);
  } catch {
    // outside HTTP context — ignore
  }
  return next();
});

export const startInstance = createStart(() => ({
  functionMiddleware: [attachSupabaseAuth],
  requestMiddleware: [errorMiddleware, securityHeadersMiddleware],
}));
