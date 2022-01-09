import * as React from 'react';
import type { MetaFunction } from 'remix';
import { Link } from 'remix';
import Typography from '@mui/material/Typography';

export const meta: MetaFunction = () => {
  return {
    title: 'Remix-Material-UI',
    description: 'Welcome to remix!',
  };
};

export default function Index() {
  return (
    <React.Fragment>
      <Typography variant="h4" component="h1" gutterBottom>
        Remix with TypeScript example
      </Typography>
    </React.Fragment>
  );
}
