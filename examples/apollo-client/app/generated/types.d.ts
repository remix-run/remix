import type { GraphQLResolveInfo, GraphQLScalarType, GraphQLScalarTypeConfig } from 'graphql';
import gql from 'graphql-tag';
export type Maybe<T> = T | null;
export type InputMaybe<T> = Maybe<T>;
export type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] };
export type MakeOptional<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]?: Maybe<T[SubKey]> };
export type MakeMaybe<T, K extends keyof T> = Omit<T, K> & { [SubKey in K]: Maybe<T[SubKey]> };
export type RequireFields<T, K extends keyof T> = { [X in Exclude<keyof T, K>]?: T[X] } & { [P in K]-?: NonNullable<T[P]> };

      export interface PossibleTypesResultData {
        possibleTypes: {
          [key: string]: string[]
        }
      }
      const result: PossibleTypesResultData = {
  "possibleTypes": {}
};
      export default result;
    
/** All built-in and custom scalars, mapped to their actual values */
export type Scalars = {
  ID: string;
  String: string;
  Boolean: boolean;
  Int: number;
  Float: number;
  /** The `Upload` scalar type represents a file upload. */
  Upload: any;
};

export type CacheControlScope =
  | 'PRIVATE'
  | 'PUBLIC';

export type Character = {
  __typename?: 'Character';
  /** Time at which the character was created in the database. */
  created: Maybe<Scalars['String']>;
  /** Episodes in which this character appeared. */
  episode: Array<Maybe<Episode>>;
  /** The gender of the character ('Female', 'Male', 'Genderless' or 'unknown'). */
  gender: Maybe<Scalars['String']>;
  /** The id of the character. */
  id: Maybe<Scalars['ID']>;
  /**
   * Link to the character's image.
   * All images are 300x300px and most are medium shots or portraits since they are intended to be used as avatars.
   */
  image: Maybe<Scalars['String']>;
  /** The character's last known location */
  location: Maybe<Location>;
  /** The name of the character. */
  name: Maybe<Scalars['String']>;
  /** The character's origin location */
  origin: Maybe<Location>;
  /** The species of the character. */
  species: Maybe<Scalars['String']>;
  /** The status of the character ('Alive', 'Dead' or 'unknown'). */
  status: Maybe<Scalars['String']>;
  /** The type or subspecies of the character. */
  type: Maybe<Scalars['String']>;
};

export type Characters = {
  __typename?: 'Characters';
  info: Maybe<Info>;
  results: Maybe<Array<Maybe<Character>>>;
};

export type Episode = {
  __typename?: 'Episode';
  /** The air date of the episode. */
  air_date: Maybe<Scalars['String']>;
  /** List of characters who have been seen in the episode. */
  characters: Array<Maybe<Character>>;
  /** Time at which the episode was created in the database. */
  created: Maybe<Scalars['String']>;
  /** The code of the episode. */
  episode: Maybe<Scalars['String']>;
  /** The id of the episode. */
  id: Maybe<Scalars['ID']>;
  /** The name of the episode. */
  name: Maybe<Scalars['String']>;
};

export type Episodes = {
  __typename?: 'Episodes';
  info: Maybe<Info>;
  results: Maybe<Array<Maybe<Episode>>>;
};

export type FilterCharacter = {
  gender: InputMaybe<Scalars['String']>;
  name: InputMaybe<Scalars['String']>;
  species: InputMaybe<Scalars['String']>;
  status: InputMaybe<Scalars['String']>;
  type: InputMaybe<Scalars['String']>;
};

export type FilterEpisode = {
  episode: InputMaybe<Scalars['String']>;
  name: InputMaybe<Scalars['String']>;
};

export type FilterLocation = {
  dimension: InputMaybe<Scalars['String']>;
  name: InputMaybe<Scalars['String']>;
  type: InputMaybe<Scalars['String']>;
};

export type Info = {
  __typename?: 'Info';
  /** The length of the response. */
  count: Maybe<Scalars['Int']>;
  /** Number of the next page (if it exists) */
  next: Maybe<Scalars['Int']>;
  /** The amount of pages. */
  pages: Maybe<Scalars['Int']>;
  /** Number of the previous page (if it exists) */
  prev: Maybe<Scalars['Int']>;
};

export type Location = {
  __typename?: 'Location';
  /** Time at which the location was created in the database. */
  created: Maybe<Scalars['String']>;
  /** The dimension in which the location is located. */
  dimension: Maybe<Scalars['String']>;
  /** The id of the location. */
  id: Maybe<Scalars['ID']>;
  /** The name of the location. */
  name: Maybe<Scalars['String']>;
  /** List of characters who have been last seen in the location. */
  residents: Array<Maybe<Character>>;
  /** The type of the location. */
  type: Maybe<Scalars['String']>;
};

export type Locations = {
  __typename?: 'Locations';
  info: Maybe<Info>;
  results: Maybe<Array<Maybe<Location>>>;
};

export type Query = {
  __typename?: 'Query';
  /** Get a specific character by ID */
  character: Maybe<Character>;
  /** Get the list of all characters */
  characters: Maybe<Characters>;
  /** Get a list of characters selected by ids */
  charactersByIds: Maybe<Array<Maybe<Character>>>;
  /** Get a specific episode by ID */
  episode: Maybe<Episode>;
  /** Get the list of all episodes */
  episodes: Maybe<Episodes>;
  /** Get a list of episodes selected by ids */
  episodesByIds: Maybe<Array<Maybe<Episode>>>;
  /** Get a specific locations by ID */
  location: Maybe<Location>;
  /** Get the list of all locations */
  locations: Maybe<Locations>;
  /** Get a list of locations selected by ids */
  locationsByIds: Maybe<Array<Maybe<Location>>>;
};


export type QueryCharacterArgs = {
  id: Scalars['ID'];
};


export type QueryCharactersArgs = {
  filter: InputMaybe<FilterCharacter>;
  page: InputMaybe<Scalars['Int']>;
};


export type QueryCharactersByIdsArgs = {
  ids: Array<Scalars['ID']>;
};


export type QueryEpisodeArgs = {
  id: Scalars['ID'];
};


export type QueryEpisodesArgs = {
  filter: InputMaybe<FilterEpisode>;
  page: InputMaybe<Scalars['Int']>;
};


export type QueryEpisodesByIdsArgs = {
  ids: Array<Scalars['ID']>;
};


export type QueryLocationArgs = {
  id: Scalars['ID'];
};


export type QueryLocationsArgs = {
  filter: InputMaybe<FilterLocation>;
  page: InputMaybe<Scalars['Int']>;
};


export type QueryLocationsByIdsArgs = {
  ids: Array<Scalars['ID']>;
};

export const GetCharacterFields = gql`
    fragment GetCharacterFields on Character {
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
    `;
export const GetCharactersFields = gql`
    fragment GetCharactersFields on Characters {
  info {
    count
    next
    pages
    prev
  }
  results {
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
}
    `;
export const GetCharacter = gql`
    query getCharacter($id: ID!) {
  character(id: $id) {
    ...GetCharacterFields
  }
}
    ${GetCharacterFields}`;
export const GetCharacters = gql`
    query getCharacters($page: Int) {
  characters(page: $page) {
    ...GetCharactersFields
  }
}
    ${GetCharactersFields}`;

declare module '*/getCharacter.graphql' {
  import { DocumentNode } from 'graphql';
  const defaultDocument: DocumentNode;
  export const GetCharacterFields: DocumentNode;
export const getCharacter: DocumentNode;

  export default defaultDocument;
}
    

declare module '*/getCharacters.graphql' {
  import { DocumentNode } from 'graphql';
  const defaultDocument: DocumentNode;
  export const GetCharactersFields: DocumentNode;
export const getCharacters: DocumentNode;

  export default defaultDocument;
}
    
export type WithIndex<TObject> = TObject & Record<string, any>;
export type ResolversObject<TObject> = WithIndex<TObject>;

export type ResolverTypeWrapper<T> = Promise<T> | T;


export type ResolverWithResolve<TResult, TParent, TContext, TArgs> = {
  resolve: ResolverFn<TResult, TParent, TContext, TArgs>;
};
export type Resolver<TResult, TParent = {}, TContext = {}, TArgs = {}> = ResolverFn<TResult, TParent, TContext, TArgs> | ResolverWithResolve<TResult, TParent, TContext, TArgs>;

export type ResolverFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => Promise<TResult> | TResult;

export type SubscriptionSubscribeFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => AsyncIterable<TResult> | Promise<AsyncIterable<TResult>>;

export type SubscriptionResolveFn<TResult, TParent, TContext, TArgs> = (
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => TResult | Promise<TResult>;

export interface SubscriptionSubscriberObject<TResult, TKey extends string, TParent, TContext, TArgs> {
  subscribe: SubscriptionSubscribeFn<{ [key in TKey]: TResult }, TParent, TContext, TArgs>;
  resolve?: SubscriptionResolveFn<TResult, { [key in TKey]: TResult }, TContext, TArgs>;
}

export interface SubscriptionResolverObject<TResult, TParent, TContext, TArgs> {
  subscribe: SubscriptionSubscribeFn<any, TParent, TContext, TArgs>;
  resolve: SubscriptionResolveFn<TResult, any, TContext, TArgs>;
}

export type SubscriptionObject<TResult, TKey extends string, TParent, TContext, TArgs> =
  | SubscriptionSubscriberObject<TResult, TKey, TParent, TContext, TArgs>
  | SubscriptionResolverObject<TResult, TParent, TContext, TArgs>;

export type SubscriptionResolver<TResult, TKey extends string, TParent = {}, TContext = {}, TArgs = {}> =
  | ((...args: any[]) => SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>)
  | SubscriptionObject<TResult, TKey, TParent, TContext, TArgs>;

export type TypeResolveFn<TTypes, TParent = {}, TContext = {}> = (
  parent: TParent,
  context: TContext,
  info: GraphQLResolveInfo
) => Maybe<TTypes> | Promise<Maybe<TTypes>>;

export type IsTypeOfResolverFn<T = {}, TContext = {}> = (obj: T, context: TContext, info: GraphQLResolveInfo) => boolean | Promise<boolean>;

export type NextResolverFn<T> = () => Promise<T>;

export type DirectiveResolverFn<TResult = {}, TParent = {}, TContext = {}, TArgs = {}> = (
  next: NextResolverFn<TResult>,
  parent: TParent,
  args: TArgs,
  context: TContext,
  info: GraphQLResolveInfo
) => TResult | Promise<TResult>;

/** Mapping between all available schema types and the resolvers types */
export type ResolversTypes = ResolversObject<{
  Boolean: ResolverTypeWrapper<Scalars['Boolean']>;
  CacheControlScope: CacheControlScope;
  Character: ResolverTypeWrapper<Character>;
  Characters: ResolverTypeWrapper<Characters>;
  Episode: ResolverTypeWrapper<Episode>;
  Episodes: ResolverTypeWrapper<Episodes>;
  FilterCharacter: FilterCharacter;
  FilterEpisode: FilterEpisode;
  FilterLocation: FilterLocation;
  ID: ResolverTypeWrapper<Scalars['ID']>;
  Info: ResolverTypeWrapper<Info>;
  Int: ResolverTypeWrapper<Scalars['Int']>;
  Location: ResolverTypeWrapper<Location>;
  Locations: ResolverTypeWrapper<Locations>;
  Query: ResolverTypeWrapper<{}>;
  String: ResolverTypeWrapper<Scalars['String']>;
  Upload: ResolverTypeWrapper<Scalars['Upload']>;
}>;

/** Mapping between all available schema types and the resolvers parents */
export type ResolversParentTypes = ResolversObject<{
  Boolean: Scalars['Boolean'];
  Character: Character;
  Characters: Characters;
  Episode: Episode;
  Episodes: Episodes;
  FilterCharacter: FilterCharacter;
  FilterEpisode: FilterEpisode;
  FilterLocation: FilterLocation;
  ID: Scalars['ID'];
  Info: Info;
  Int: Scalars['Int'];
  Location: Location;
  Locations: Locations;
  Query: {};
  String: Scalars['String'];
  Upload: Scalars['Upload'];
}>;

export type CacheControlDirectiveArgs = {
  maxAge: Maybe<Scalars['Int']>;
  scope: Maybe<CacheControlScope>;
};

export type CacheControlDirectiveResolver<Result, Parent, ContextType = any, Args = CacheControlDirectiveArgs> = DirectiveResolverFn<Result, Parent, ContextType, Args>;

export type CharacterResolvers<ContextType = any, ParentType extends ResolversParentTypes['Character'] = ResolversParentTypes['Character']> = ResolversObject<{
  created: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  episode: Resolver<Array<Maybe<ResolversTypes['Episode']>>, ParentType, ContextType>;
  gender: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  id: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType>;
  image: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  location: Resolver<Maybe<ResolversTypes['Location']>, ParentType, ContextType>;
  name: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  origin: Resolver<Maybe<ResolversTypes['Location']>, ParentType, ContextType>;
  species: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  status: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  type: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type CharactersResolvers<ContextType = any, ParentType extends ResolversParentTypes['Characters'] = ResolversParentTypes['Characters']> = ResolversObject<{
  info: Resolver<Maybe<ResolversTypes['Info']>, ParentType, ContextType>;
  results: Resolver<Maybe<Array<Maybe<ResolversTypes['Character']>>>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type EpisodeResolvers<ContextType = any, ParentType extends ResolversParentTypes['Episode'] = ResolversParentTypes['Episode']> = ResolversObject<{
  air_date: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  characters: Resolver<Array<Maybe<ResolversTypes['Character']>>, ParentType, ContextType>;
  created: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  episode: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  id: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType>;
  name: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type EpisodesResolvers<ContextType = any, ParentType extends ResolversParentTypes['Episodes'] = ResolversParentTypes['Episodes']> = ResolversObject<{
  info: Resolver<Maybe<ResolversTypes['Info']>, ParentType, ContextType>;
  results: Resolver<Maybe<Array<Maybe<ResolversTypes['Episode']>>>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type InfoResolvers<ContextType = any, ParentType extends ResolversParentTypes['Info'] = ResolversParentTypes['Info']> = ResolversObject<{
  count: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  next: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  pages: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  prev: Resolver<Maybe<ResolversTypes['Int']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type LocationResolvers<ContextType = any, ParentType extends ResolversParentTypes['Location'] = ResolversParentTypes['Location']> = ResolversObject<{
  created: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  dimension: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  id: Resolver<Maybe<ResolversTypes['ID']>, ParentType, ContextType>;
  name: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  residents: Resolver<Array<Maybe<ResolversTypes['Character']>>, ParentType, ContextType>;
  type: Resolver<Maybe<ResolversTypes['String']>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type LocationsResolvers<ContextType = any, ParentType extends ResolversParentTypes['Locations'] = ResolversParentTypes['Locations']> = ResolversObject<{
  info: Resolver<Maybe<ResolversTypes['Info']>, ParentType, ContextType>;
  results: Resolver<Maybe<Array<Maybe<ResolversTypes['Location']>>>, ParentType, ContextType>;
  __isTypeOf?: IsTypeOfResolverFn<ParentType, ContextType>;
}>;

export type QueryResolvers<ContextType = any, ParentType extends ResolversParentTypes['Query'] = ResolversParentTypes['Query']> = ResolversObject<{
  character: Resolver<Maybe<ResolversTypes['Character']>, ParentType, ContextType, RequireFields<QueryCharacterArgs, 'id'>>;
  characters: Resolver<Maybe<ResolversTypes['Characters']>, ParentType, ContextType, RequireFields<QueryCharactersArgs, never>>;
  charactersByIds: Resolver<Maybe<Array<Maybe<ResolversTypes['Character']>>>, ParentType, ContextType, RequireFields<QueryCharactersByIdsArgs, 'ids'>>;
  episode: Resolver<Maybe<ResolversTypes['Episode']>, ParentType, ContextType, RequireFields<QueryEpisodeArgs, 'id'>>;
  episodes: Resolver<Maybe<ResolversTypes['Episodes']>, ParentType, ContextType, RequireFields<QueryEpisodesArgs, never>>;
  episodesByIds: Resolver<Maybe<Array<Maybe<ResolversTypes['Episode']>>>, ParentType, ContextType, RequireFields<QueryEpisodesByIdsArgs, 'ids'>>;
  location: Resolver<Maybe<ResolversTypes['Location']>, ParentType, ContextType, RequireFields<QueryLocationArgs, 'id'>>;
  locations: Resolver<Maybe<ResolversTypes['Locations']>, ParentType, ContextType, RequireFields<QueryLocationsArgs, never>>;
  locationsByIds: Resolver<Maybe<Array<Maybe<ResolversTypes['Location']>>>, ParentType, ContextType, RequireFields<QueryLocationsByIdsArgs, 'ids'>>;
}>;

export interface UploadScalarConfig extends GraphQLScalarTypeConfig<ResolversTypes['Upload'], any> {
  name: 'Upload';
}

export type Resolvers<ContextType = any> = ResolversObject<{
  Character: CharacterResolvers<ContextType>;
  Characters: CharactersResolvers<ContextType>;
  Episode: EpisodeResolvers<ContextType>;
  Episodes: EpisodesResolvers<ContextType>;
  Info: InfoResolvers<ContextType>;
  Location: LocationResolvers<ContextType>;
  Locations: LocationsResolvers<ContextType>;
  Query: QueryResolvers<ContextType>;
  Upload: GraphQLScalarType;
}>;

export type DirectiveResolvers<ContextType = any> = ResolversObject<{
  cacheControl: CacheControlDirectiveResolver<any, any, ContextType>;
}>;
