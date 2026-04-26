import { NextResponse } from "next/server";

const DEFAULT_MAX_BODY_BYTES = 1_000_000;

export class ApiRouteError extends Error {
  constructor(
    message: string,
    readonly status = 400,
  ) {
    super(message);
    this.name = "ApiRouteError";
  }
}

type ApiRouteHandler = (request: Request) => Promise<Response> | Response;

interface ApiRouteOptions {
  label: string;
  maxBodyBytes?: number;
}

export function withApiHandler(
  handler: ApiRouteHandler,
  options: ApiRouteOptions,
): ApiRouteHandler {
  return async (request) => {
    try {
      const maxBodyBytes = options.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;
      const contentLength = request.headers.get("content-length");
      if (contentLength && Number.parseInt(contentLength, 10) > maxBodyBytes) {
        throw new ApiRouteError("Payload too large", 413);
      }

      return await handler(request);
    } catch (error) {
      if (error instanceof Response) return error;

      if (error instanceof ApiRouteError) {
        return NextResponse.json({ error: error.message }, { status: error.status });
      }

      console.error(`[${options.label}]`, error);
      const detail = error instanceof Error ? error.message : "Unknown error";
      return NextResponse.json(
        { error: process.env.NODE_ENV === "development" ? detail : "Internal server error" },
        { status: 500 },
      );
    }
  };
}

export async function readJsonBody<T = unknown>(
  request: Request,
  options: { maxBodyBytes?: number } = {},
): Promise<T> {
  const raw = await request.text();
  const maxBodyBytes = options.maxBodyBytes ?? DEFAULT_MAX_BODY_BYTES;

  if (new TextEncoder().encode(raw).byteLength > maxBodyBytes) {
    throw new ApiRouteError("Payload too large", 413);
  }

  try {
    return JSON.parse(raw) as T;
  } catch {
    throw new ApiRouteError("Invalid payload", 400);
  }
}
