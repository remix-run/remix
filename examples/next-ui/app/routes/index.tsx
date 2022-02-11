import { Text, Container, css } from "@nextui-org/react";
export default function Index() {
  return (
    <Container
      fluid
      css={{
        background: "$blue100",
        minHeight: "100vh",
        minWidth: "100vw",
        fontFamily: "system-ui, sans-serif",
        padding: "$2 $4",
        lineHeight: "1.4",
        '@xs': {
          bg: '$blue800',
          color: '$blue100',
        },
        '@sm': {
          bg: '$yellow800',
          color: '$yellow100',
        },
        '@md': {
          bg: '$purple800',
          color: '$purple100',
        },
        '@lg': {
          bg: '$pink800'
        },
      }}
    >
      <Text
        h1
        weight="bold"
        css={{
          textAlign: "center",
          "@dark": {
            color: "$red400",
          },
          "@light": {
            color: "$green600",
          },
        }}
      >
        Remix X NextUI
      </Text>
      <Text
        h3
        weight="bold"
        css={{
          textAlign: "center",
          '@xs': {
            color: '$blue100',
          },
          '@sm': {
            color: '$yellow100',
          },
          '@md': {
            color: '$purple100',
          },
          '@lg': {
            bg: '$pink800'
          },
        }}
      >
        Resize the screen
      </Text>
    </Container>
  );
}
