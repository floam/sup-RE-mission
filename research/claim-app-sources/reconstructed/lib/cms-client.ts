import createClient, { type Client } from "openapi-fetch";
import { isHex, type Hex } from "viem";

import type { components, paths } from "./cms-openapi";

const DEFAULT_CMS_ORIGIN = "https://cms.superfluid.pro";

export type CmsClient = Client<paths>;
export type CmsPointEvent = components["schemas"]["PointEvent"];
export type CmsBalance = components["schemas"]["PointBalance"];
export type CmsBalanceBatchResponse =
  components["schemas"]["BalanceBatchResponse"];
export type CmsSignedBalanceBatchResponse =
  components["schemas"]["SignedBalanceBatchResponse"];
export type CmsEventsPage = components["schemas"]["PointEventsResponse"];

type CmsApiError = components["schemas"]["ApiError"];

interface CmsClientOptions {
  origin?: string;
  fetch?: typeof globalThis.fetch;
}

interface OpenApiResult<T> {
  data?: T;
  error?: unknown;
  response: Response;
}

export function createCmsClient(options: CmsClientOptions = {}): CmsClient {
  const fetchImplementation = options.fetch ?? globalThis.fetch;
  return createClient<paths>({
    baseUrl: (options.origin ?? DEFAULT_CMS_ORIGIN).replace(/\/$/, ""),
    fetch: (request) => fetchImplementation(request),
  });
}

function getApiErrorMessage(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as CmsApiError).message === "string"
  ) {
    return (error as CmsApiError).message;
  }
  return undefined;
}

export function requireCmsData<T>(path: string, result: OpenApiResult<T>): T {
  if (result.data !== undefined) return result.data;
  const message = getApiErrorMessage(result.error);
  throw new Error(
    `CMS ${path} returned ${result.response.status}${message ? `: ${message}` : ""}`,
  );
}

export function requireCmsSignature(signature: string): Hex {
  if (!isHex(signature)) {
    throw new Error("CMS signed balance batch returned a malformed signature.");
  }
  return signature;
}

export const cmsClient = createCmsClient();
