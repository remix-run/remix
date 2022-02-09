import { Form, useMatches } from "remix";

import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import Typography from "@mui/material/Typography";
import Brightness2Icon from "@mui/icons-material/Brightness2";
import Brightness7Icon from "@mui/icons-material/Brightness7";

import type { RootLoaderData } from "~/root";

const Index = () => {
  // Grabs theme from the loader that is in root.tsx
  const { theme } = useMatches()[0].data as RootLoaderData;

  return (
    <Box
      sx={{
        height: "100vh",
        width: "100vw",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        textAlign: "center"
      }}
    >
      <Form reloadDocument action="/" method="post">
        <Tooltip title="Toggle theme">
          <IconButton type="submit" aria-label="Toggle theme">
            {theme === "light" ? <Brightness7Icon /> : <Brightness2Icon />}
          </IconButton>
        </Tooltip>
        <Typography component="h1" variant="h6">
          Selected theme: {theme}
        </Typography>
      </Form>
    </Box>
  );
};

export default Index;
