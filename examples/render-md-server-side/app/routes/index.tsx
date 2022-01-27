import { useLoaderData } from "remix";
import MarkdownContainer from "../markdown";

/**
 * Mock function to fetch your markdown content.
 * You could fetch from any CMS, the filesystem, GitHub, etc.
 */
async function fetchMarkdownFormSomewhere() {
  return `
# This is a H1 tag using the custom H1 component

## This is a H2 tag

### This is a H3 tag

This is a paragraph

This is a paragraph with a [link](https://remix.run)

This is a paragraph with a \`code\` block

\`\`\`javascript
console.log("Remix rocks!");
\`\`\`

`;
}

export const loader = async () => {
  // Fetch the markdown content server-side
  const content = await fetchMarkdownFormSomewhere();
  return { content };
};

export default function Index() {
  // Access the markdown in your app
  const { content } = useLoaderData<{ content: string }>();
  // Render the markdown anywhere in your app (it also works server-side!)
  return <MarkdownContainer source={content} />;
}
