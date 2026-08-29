/**
 * Small Express helpers: async error forwarding and a secret-free error handler.
 */
import type {
  ErrorRequestHandler,
  NextFunction,
  Request,
  RequestHandler,
  Response,
} from "express";

/** Wrap an async route so rejected promises reach the error middleware. */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}

/**
 * Terminal error middleware. Returns a generic 500 and logs only the error's
 * name/message (never request bodies, codes, or tokens) per REQ-NFR-002.
 */
export function errorHandler(): ErrorRequestHandler {
  return (err, _req, res, _next) => {
    const name = err instanceof Error ? err.name : "Error";
    const message = err instanceof Error ? err.message : String(err);
    // eslint-disable-next-line no-console
    console.error(`[api] unhandled ${name}: ${message}`);
    if (res.headersSent) {
      return;
    }
    res.status(500).json({ error: "internal server error" });
  };
}
