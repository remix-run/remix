import * as React from 'react';
import { GetCharacterFieldsFragment } from '~/generated/hooks';

export interface CharacterDetailProps {
  data?: GetCharacterFieldsFragment;
}

export const CharacterDetail: React.FC<CharacterDetailProps> = (props) => {
  const { data } = props;

  // 🔌 Short Circuit
  if (!data) return null;

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
