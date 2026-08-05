// Minimal globals for Cloudflare Pages Functions typing (lint only).
interface Fetcher {
  fetch(request: Request | string | URL, init?: RequestInit): Promise<Response>;
}

interface EventContext<Env = any> {
  request: Request;
  functionPath: string;
  waitUntil(promise: Promise<any>): void;
  passThroughOnException(): void;
  next(input?: Request | string, init?: RequestInit): Promise<Response>;
  env: Env;
  params: Record<string, string | string[]>;
  data: any;
}

type PagesFunction<
  Env = any,
  Params extends string = any,
  Data extends Record<string, unknown> = Record<string, unknown>
> = (context: EventContext<Env>) => Promise<Response> | Response;

// eslint-disable-next-line @typescript-eslint/no-namespace
declare namespace PagesFunction {
  interface context<Env> extends EventContext<Env> {}
}