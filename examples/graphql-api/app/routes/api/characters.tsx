import type { ApolloError } from "apollo-server-errors";
import { json } from "@remix-run/node";
import type { LoaderFunction } from "@remix-run/node";

import { fetchFromGraphQL, gql } from "~/utils";
import type { Characters } from "~/generated/types";

export type LoaderData = {
  data: { characters: Characters };
  errors?: ApolloError[];
};

export const loader: LoaderFunction = async (args): Promise<LoaderData> => {
  const { params } = args;
  const { page = 1 } = params;

  const getCharactersQuery = gql`
    fragment CharacterFields on Character {
      gender
      id
      image
      name
      origin {
        dimension
        name
        type
      }
      species
      status
      type
    }

    fragment GetCharactersFields on Characters {
      results {
        ...CharacterFields
      }
    }

    query getCharacters($page: Int) {
      characters(page: $page) {
        ...GetCharactersFields
      }
    }
  `;

  const res = await fetchFromGraphQL(getCharactersQuery, { page });

  return json(await res.json());
};
