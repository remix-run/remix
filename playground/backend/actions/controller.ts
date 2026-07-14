import { env } from 'cloudflare:workers'

// import { createAnthropic } from "@ai-sdk/anthropic";
// import { createOpenAI } from "@ai-sdk/openai";
// import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createController } from 'remix/router'
import { parse, parseSafe } from 'remix/data-schema'
// import { Session } from "remix/session";
// import type { Diagnostic } from "typescript";
// import { createWorkersAI } from "workers-ai-provider";

import { routes } from '../routes.ts'
import { SharedProjectSchema } from './models.ts'
// import SYSTEM_PROMPT from "./system-prompt.txt?raw";
// import { tools } from "./tools.ts";

export default createController(routes, {
  actions: {
    // async chat({ get, request }) {
    //   // const session = get(Session);
    //   // const userDid = session?.get("userDid") as string | undefined;
    //   // if (!userDid) {
    //   //   return Response.json({ error: "Unauthorized" }, { status: 401 });
    //   // }
    //   const userDid = "test-user";

    //   const workersai = createWorkersAI({
    //     binding: env.AI,
    //     gateway: {
    //       id: "remix-playground",
    //       cacheKey: userDid,
    //     },
    //   });

    //   const openai = createOpenAI({
    //     apiKey: env.OPENAI_API_KEY,
    //     baseURL: env.OPENAI_BASE_URL,
    //   });

    //   const anthropic = createAnthropic({
    //     apiKey: env.ANTHROPIC_API_KEY,
    //     baseURL: env.ANTHROPIC_BASE_URL,
    //   });

    //   const { lsp, messages: _messages }: {
    //     lsp?: Diagnostic[];
    //     messages: UIMessage[];
    //   } = await request.json();

    //   const messages = await convertToModelMessages(_messages);

    //   if (!messages || messages.length === 0) {
    //     return Response.json({ error: "No messages provided" }, {
    //       status: 400,
    //     });
    //   }

    //   if (lsp?.length) {
    //     messages.push({
    //       role: "user",
    //       content: `Code diagnostics:\n\`\`\`\n${
    //         JSON.stringify(lsp, null, 2)
    //       }\n\`\`\``,
    //     });
    //   }

    //   const result = streamText({
    //     // model: openai("gpt-5.4"),
    //     // model: openai("openai:gpt-5.5"),
    //     // model: openai.chat("groq:openai/gpt-oss-120b"),
    //     // model: openai.chat("bedrockmantle-us-east-1:mistral.devstral-2-123b"),
    //     // model: openai.chat("bedrockmantle-us-east-1:deepseek.v3.2"),
    //     // model: openai.chat("azureserverless-dev-us-east-1:kimi-k2.6"),
    //     // model: anthropic("claude-opus-4-8"),
    //     model: anthropic("claude-sonnet-4-6"),
    //     // model: openai.chat("claude-haiku-4-5"),
    //     // model: openai.chat("googlevertexai-global:gemini-flash-lite-latest"),
    //     // model: openai.chat("bedrock-us-east-1:moonshotai.kimi-k2.5"),
    //     // maxOutputTokens: 60000,
    //     // providerOptions: {
    //     //   openai: {
    //     //     reasoningEffort: "minimal",
    //     //     // reasoningEffort: "low",
    //     //   },
    //     // },
    //     // model: workersai("@cf/moonshotai/kimi-k2.6", {
    //     //   reasoning_effort: "high",
    //     //   sessionAffinity: userDid,
    //     // }),
    //     // model: workersai("@cf/zai-org/glm-4.7-flash", {
    //     //   reasoning_effort: "medium",
    //     //   sessionAffinity: userDid,
    //     // }),
    //     // model: workersai("@cf/google/gemma-4-26b-a4b-it", {
    //     //   reasoning_effort: "medium",
    //     //   sessionAffinity: userDid,
    //     // }),
    //     system: SYSTEM_PROMPT,
    //     tools,
    //     messages,
    //   });

    //   return result.toUIMessageStreamResponse();
    // },
    async loadSharedProject({ params: { projectId } }) {
      let project = await env.REMIX_PLAYGROUND_SHARE.get(projectId)
        .then((json) => parse(SharedProjectSchema, JSON.parse(json!)))
        .catch(() => null)
      if (!project) {
        return Response.json({ error: 'Project not found' }, { status: 404 })
      }
      return Response.json(project)
    },
    async shareProject({ request }) {
      let body = await request.json().catch(() => null)
      let parsed = parseSafe(SharedProjectSchema, body)
      if (!parsed.success) {
        return Response.json(
          {
            error: 'Invalid request body',
            issues: parsed.issues,
          },
          { status: 400 },
        )
      }
      let json = JSON.stringify(parsed.value)
      let projectId: string = await crypto.subtle
        .digest('SHA-256', new TextEncoder().encode(json))
        .then((hashBuffer) => {
          let hashArray = Array.from(new Uint8Array(hashBuffer))
          return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
        })

      if (
        await env.REMIX_PLAYGROUND_SHARE.get(projectId)
          .then((json) => parse(SharedProjectSchema, JSON.parse(json!)))
          .catch(() => null)
      ) {
        return Response.json({ projectId: projectId })
      }

      let saved = await env.REMIX_PLAYGROUND_SHARE.put(projectId, json)
        .then(() => true)
        .catch(() => false)
      if (!saved) {
        return Response.json(
          { error: 'Failed to save shared project' },
          {
            status: 500,
          },
        )
      }

      return Response.json({ projectId: projectId })
    },
  },
})
