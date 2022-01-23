import * as React from 'react';
import { Link } from 'remix';
import { Character } from '~/generated/types';

export interface CharacterListProps {
  data: Character[];
}

/**
 * @name CharacterList
 * @description tbd...
 */
export const CharacterList: React.FC<CharacterListProps> = (props) => {
  const { data } = props;

  return (
    <div className="character-list">
      {data.map((character) => {
        const { image } = character
        if (!character) return null;

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
