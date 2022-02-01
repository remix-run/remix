import * as React from 'react';

export interface CodeProps {
  data: any;
  summary: string;
}

/**
 * @name Code
 * @description Simple component to render out our JSON responses.
 */
export const Code: React.FC<CodeProps> = (props) => {
  const { data, summary } = props;

  return (
    <details className="code">
      <summary>{summary}</summary>
      <code>
        <pre>
          {JSON.stringify(data, null, 2)}
        </pre>
      </code>
    </details>
  );
};
