export interface GraphQLRequestOptions
  extends Omit<RequestInit, "body" | "method"> {
  next?: {
    revalidate?: number | false;
    tags?: string[];
  };
}

interface GraphQLResponse<TData> {
  data?: TData;
  errors?: Array<{ message: string }>;
}

/** Small first-party transport wrapper inferred from the server-action queries. */
export async function queryGraphQL<
  TData,
  TVariables extends Record<string, unknown> = Record<string, never>,
>(
  endpoint: string,
  query: string,
  variables?: TVariables,
  options: GraphQLRequestOptions = {},
): Promise<TData> {
  const response = await fetch(endpoint, {
    ...options,
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...options.headers,
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!response.ok) {
    throw new Error(`GraphQL request failed with ${response.status}`);
  }

  const result = (await response.json()) as GraphQLResponse<TData>;
  if (result.errors?.length) {
    throw new Error(result.errors.map(({ message }) => message).join("; "));
  }
  if (!result.data) throw new Error("GraphQL response did not contain data");
  return result.data;
}
