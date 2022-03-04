/**
 * @name fetchFromGraphQL
 * @external https://css-tricks.com/raw-graphql-querying
 * @description This function is used to fetch data from the GraphQL API.
 * Check out the link above for more information.
 */
export const fetchFromGraphQL = async (
  query: string,
  variables?: Record<string, any>
) => {
  if (!process.env.GRAPHQL_API) {
    throw new Error("GRAPHQL_API is required");
  }

  const body: any = { query };

  if (variables) body.variables = variables;

  return fetch(process.env.GRAPHQL_API, {
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
    method: "POST",
  });
};

export const gql = String.raw;
