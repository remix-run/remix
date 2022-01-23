import * as React from 'react';
import { CharacterFieldsFragment } from '~/generated/hooks';

export interface CharacterDetailProps {
  data: CharacterFieldsFragment;
}

export const CharacterDetail: React.FC<CharacterDetailProps> = (props) => {
  const { data } = props;

  return (
    <div className="character">
      {data.image && <img alt={data.name ?? ''} src={data.image} />}
      <div className='list'>
        <div>
          <b>Gender:</b> {data?.gender}
        </div>
        <div>
          <b>Species:</b> {data?.species}
        </div>
        <div>
          <b>Status:</b> {data?.status}
        </div>
      </div>
    </div>
  );
};
