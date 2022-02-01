import * as React from 'react';
import { Character } from '~/generated/types';

export interface CharacterDetailProps {
  data: Character;
}

/**
 * @name CharacterDetail
 * @description Detail view for a single Character.
 */
export const CharacterDetail: React.FC<CharacterDetailProps> = (props) => {
  const { data } = props;

  return (
    <div className="character-detail">
      {data.image && <img alt={data.name ?? ''} src={data.image} />}
      <div className="list">
        <b>Gender:</b> {data?.gender}
        <br />
        <b>Species:</b> {data?.species}
        <br />
        <b>Status:</b> {data?.status}
      </div>
    </div>
  );
};
