/** @jsx jsx */
import React from 'react';
import {jsx} from '@theme-ui/core';
import { Link } from "@remix-run/react";


export default function Index() {
  return (
    <div sx={{backgroundColor: 'primary'}}>
      <h1>Welcome to Remix with Emotion Example</h1>
      <ul>
        <li>
          <Link to="/jokes">Jokes</Link>
        </li>
        <li>
          <Link to="/jokes-error">Jokes: Error</Link>
        </li>
      </ul>
    </div>
  );
}
