import type { ApolloError } from "apollo-server-errors";
import type { LoaderFunction } from "remix";

import { fetchFromGraphQL } from "~/utils/index";
import type { Character } from "~/generated/types";

export type LoaderData = {
  data: { character: Character };
  errors?: ApolloError[];
};

export const loader: LoaderFunction = async (args): Promise<LoaderData> => {
  const { request } = args;

  const url = new URL(request.url);
  const id = url.searchParams.get("id");

  const getCharacterQuery = `
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

    query getCharacter($id: ID!) {
      character(id: $id) {
        ...CharacterFields
      }
    }
  `;

  const res = await fetchFromGraphQL(getCharacterQuery, { id });
  const data = await res.json();

  return data;
};
