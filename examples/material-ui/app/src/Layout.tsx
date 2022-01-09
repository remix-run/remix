import * as React from 'react';
import Container from '@mui/material/Container';
import Box from '@mui/material/Box';

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <Container maxWidth="sm">
      <Box sx={{ my: 4 }}>
        {children}
      </Box>
    </Container>
  );
}
