import * as React from 'react';
import { Link } from 'remix';
import { Characters } from '~/generated/types';

export interface CharacterListProps {
  data: Characters['results'];
}

/**
 * @name CharacterList
 * @description This component loops over an array of characters and renders
 * a link to each characters detail page.
 */
export const CharacterList: React.FC<CharacterListProps> = (props) => {
  const { data } = props;

  if (!data) return null;

  return (
    <div className="character-list">
      {data.map((character) => {
        if (!character) return null;

        const { image } = character;
        const to = `/character/${character.id}`;

        return (
          <Link className='character' key={character.id} to={to}>
            {image && <img alt="" height={40} src={image} width={40}  />}
            <h2>{character.name}</h2>
          </Link>
        );
      })}
    </div>
  );
};
