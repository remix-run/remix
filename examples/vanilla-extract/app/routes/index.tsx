import { Text, Box } from "~/components";

export default function Index() {
  return (
    <Box
      padding={{
        mobile: "small",
        tablet: "medium",
        desktop: "large",
      }}
    >
      <Text size="large">Hello World!</Text>
    </Box>
  );
}
