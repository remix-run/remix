import * as React from 'react';

export interface CharacterProps {
  data: any;
}

/**
 * @name Character
 * @description tbd...
 */
export const Character: React.FC<CharacterProps> = (props) => {
  const { data } = props;

  return (
    <div className="character">
      <img alt={data?.character.name} src={data?.character.image} />
      <div className='list'>
        <div>
          <b>Gender:</b> {data?.character?.gender}
        </div>
        <div>
          <b>Species:</b> {data?.character?.species}
        </div>
        <div>
          <b>Status:</b> {data?.character?.status}
        </div>
      </div>
    </div>
  );
};
