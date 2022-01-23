import * as React from 'react';
import { Link } from 'remix';
import { CharacterFieldsFragment } from '~/generated/hooks';

export interface CharacterListProps {
  data: CharacterFieldsFragment[];
}

export const CharacterList: React.FC<CharacterListProps> = (props) => {
  const { data } = props;

  // Markup
  const renderCharacter = (character: CharacterFieldsFragment) => {
    const { image } = character;
    const to = `/character/${character.id}`;

    return (
      <Link className='character' key={character.id} to={to}>
        {image && <img alt="" height={40} src={image} width={40}  />}
        <h2>{character.name}</h2>
      </Link>
    );
  }

  return (
    <div className="character-list">
      {data.map(renderCharacter)}
    </div>
  );
};
