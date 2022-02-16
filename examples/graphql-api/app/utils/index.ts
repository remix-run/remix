import { GRAPHQL_API } from "~/config";

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
    const body: any = { query };

    if (variables) body.variables = variables;

    return fetch(GRAPHQL_API, {
      body: JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json'
      },
      method: 'POST',
    });
  };
