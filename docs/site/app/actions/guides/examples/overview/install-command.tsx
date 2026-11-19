import type { AppContext } from "../../../../router.ts";
import { parseMarkdown, renderMarkdown } from "../../../../markdown.ts";
import { setMarkdownFallback } from "../markdown-fallback.ts";
import { createInstallRunners } from "./public/install-runners.ts";
import { InstallTabs } from "./public/install-tabs.tsx";

// Markdown has no tabs, so it shows the first runner, npm.
setMarkdownFallback(handler, {
  markdown: `\`\`\`sh\n${createInstallRunners("my-app")[0].script}\n\`\`\``,
});

export async function handler(context: AppContext) {
  let panels = await Promise.all(
    createInstallRunners("my-app").map(async ({ value, label, script }) => ({
      value,
      label,
      html: await renderMarkdown(parseMarkdown(`\`\`\`sh\n${script}\n\`\`\`\n`).root),
    })),
  );

  return context.render(<InstallTabs panels={panels} />);
}
