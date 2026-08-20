declare interface Fetcher {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

// Starter worker adapter type supplied by Cloudflare at runtime.
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
declare interface D1Database {}

declare module "cloudflare:workers" {
  export const env: { DB?: D1Database };
}
