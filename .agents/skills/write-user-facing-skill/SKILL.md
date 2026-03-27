---
name: write-user-facing-skill
description: Write or revise user-facing Remix app skills under `skills/`. Use when creating, reviewing, or tightening skills that teach agents how to build with Remix as a framework, especially overview, layout, UI, routing, data, auth, files, or other app-building skills.
---

# Write User-Facing Skill

## Overview

Write skills in `skills/` for agents building Remix applications, not for contributors working on
the Remix repository itself.

These skills should help an agent build real apps with Remix by teaching a focused mental model,
workflow, or subsystem. They should not read like internal framework philosophy, repo-maintainer
notes, or vague marketing copy.

## Read First

Before drafting or revising a user-facing skill, read the existing skill graph, the current
user-facing skills, and the relevant package and demo docs:

- `skills/skill-architecture.md`
- `skills/remix-overview/SKILL.md`
- `skills/remix-project-layout/SKILL.md`
- `skills/remix-ui/SKILL.md`

Also read the READMEs, docs, and demos that define the subsystem you are writing about:

- Read the relevant package `README.md` files and any nearby docs for the APIs the skill is meant to
  teach.
- Read one or more demos that exercise that subsystem in realistic app code.
- Prefer `demos/bookstore/` as the default deep reference when you need to understand how multiple
  Remix subsystems compose in one real application.
- Use narrower demos such as auth-, frames-, SSE-, or file-related demos when the target skill is
  about one focused subsystem or edge case.

## Core Principles

- Optimize for agents building apps with Remix, not for humans contributing to Remix internals.
- Prefer multiple focused skills over one giant skill.
- Make the skill tell the agent what to do next, not just what Remix believes philosophically.
- Keep overview skills lightweight and routing-oriented.
- Keep specialist skills procedural and subsystem-specific.
- Use progressive disclosure inside focused skill boundaries: keep the main `SKILL.md` lean, then
  use local `references/` files when the skill needs deeper subsystem-specific context.
- Let skills reference other skills when a task crosses subsystem boundaries instead of redescribing
  that subsystem or handwaving past it.
- Treat cross-skill handoffs as part of the skill design, not optional polish. If a neighboring
  subsystem matters to the task, point to the skill that owns it.
- Make every cross-reference earn its place. Do not add generic sibling-skill lists when the skill
  already explains the relevant boundary inline or the linked skill is only loosely related.
- Make repeated guidance earn its place too. Do not restate defaults from broader skills unless the
  narrower skill is adding subsystem-specific meaning, correcting a common wrong turn, or showing a
  concrete shape the agent should copy.
- Use TODOs to preserve the intended shape of the skill graph when downstream skills are not ready
  yet. Do not fake completeness with placeholder detail.

## For Overview Skills

- Explain what Remix is in app-builder terms.
- Give a usable request-flow mental model.
- Identify the major subsystems.
- Route broad tasks to the next skill.
- Stay light on checklists, questionnaires, and implementation detail.

Do not turn an overview skill into a project plan, package catalog, or omnibus reference.

## For Specialist Skills

- Give the agent a clear scope boundary.
- Focus on one subsystem or one kind of decision.
- Teach practical defaults, ownership rules, and workflows.
- Link to sibling skills instead of absorbing their responsibilities.
- Prefer boundary handoffs in the exact spot where the boundary matters over a generic "Related
  Skills" section that just lists neighboring nodes.
- Prefer small, copyable code-shape examples when they teach the subsystem better than another
  paragraph of prose.
- Add `references/` files when the skill needs to spider into deeper API details, patterns,
  examples, or edge cases that would bloat the main `SKILL.md`.
- If another skill owns a related subsystem, reference that skill directly instead of duplicating
  its workflow or giving vague cross-subsystem advice.

Use `references/` when:

- the skill needs deeper API detail than fits comfortably in the main body
- the subsystem has multiple focused topics such as testing, frames, mixins, or migration patterns
- the agent may need to spider into examples or edge cases on demand

Prefer linking to another skill when:

- another skill owns the neighboring subsystem
- the overlap is conceptual or workflow-related rather than just extra API detail
- repeating the explanation would blur skill boundaries
- the handoff helps the agent decide what to do next right at the point of confusion

Avoid linking to another skill when:

- the target skill is only loosely adjacent and the link does not change the next action
- the same boundary is already stated clearly elsewhere in the skill
- the section would turn into a generic catalog of sibling skills instead of a real handoff

Prefer repeating guidance from another skill only when:

- the narrower skill needs to translate the broader rule into subsystem-specific action
- the repeated note prevents a common mistake in this subsystem
- a short example makes the guidance more concrete than the source skill does

Avoid repeating guidance when:

- it is only restating a convention the agent already learned from `remix-overview` or another
  upstream skill
- the repeated prose does not change what the agent should do next
- a code example or boundary handoff would teach the point more clearly

## Rules

- Keep `SKILL.md` concise and high signal.
- Put trigger context in the frontmatter `description`, not in a "when to use" section in the body.
- Prefer imports from `remix/...` when the app uses the `remix` package. Do not default to
  `@remix-run/...` imports in user-facing app skills.
- Avoid meta authoring notes inside the final user-facing skill body unless they are genuinely useful
  to the agent using the skill.
- Avoid internal repo-maintainer framing such as package export layout or monorepo concerns unless
  they directly affect the app-building task.
- Ground the skill in actual Remix package docs and demos before drafting guidance from memory.
- Prefer local `references/` over bloating the main skill body when deeper subsystem context is
  needed.
- Prefer linking to the skill that owns a neighboring subsystem over re-explaining that subsystem in
  summary form.
- Do not default to a broad "Related Skills" section. Add one only when the skill truly has a small,
  stable set of high-value handoffs that are not already covered inline.
- Do not duplicate overview-level conventions in specialist skills unless the repetition is
  materially more concrete or subsystem-specific.
- Use relative paths when pointing to sibling skills or local references so the relationship is
  explicit and durable.
- Keep prose oriented around building something: structure, request flow, rendering, data,
  navigation, auth, files, security, testing, and deployment.

## Helpful Patterns

- Use a short intro that says what the skill is for and what it should not try to do.
- Use a small set of sections with clear jobs.
- Give one concrete import or API-shape example when it prevents a common wrong turn.
- Replace weak "prefer imports like ..." reminders with a concrete shape example when the real
  lesson is how the subsystem is wired together.
- Use `references/` for progressive disclosure when the skill needs deeper detail.
- Give each reference a one-line reason to read it, as `remix-ui` does.
- Prefer short routing guidance such as "use `remix-project-layout` for structure" over long
  repeated explanations.
- Point to sibling skills when a task touches their subsystem.
- If you need a routing section, prefer names like "Hand Off To" or "Future Skill Handoffs" when
  they describe the section more honestly than "Related Skills".
- When a future skill is not ready, mention it with a TODO and keep moving.

## Anti-Patterns

- Writing skills for framework contributors when the audience is app builders.
- Turning an overview skill into a large implementation checklist.
- Explaining repository philosophy without translating it into app-building guidance.
- Duplicating another skill's detailed workflow instead of handing off to it.
- Letting one skill become an omnibus just because several related references could fit there.
- Re-explaining a neighboring subsystem instead of pointing to the skill that owns it.
- Adding weak or redundant cross-links just because nearby skills exist.
- Repeating overview-level guidance in a specialist skill without adding narrower, more useful
  direction.
- Leaving invalid frontmatter or malformed Markdown structure in a skill.
- Filling the skill with temporary author notes that are not useful to the agent consuming it.

## Checklist

- Does the skill have valid frontmatter with `name` and `description` only?
- Is the intended audience an agent building with Remix?
- Is the skill either clearly overview-level or clearly specialist-level?
- Does it help the agent choose the next step or next skill?
- Does it avoid unnecessary meta commentary?
- Does it prefer `remix/...` imports where appropriate?
- Is it grounded in the relevant package docs and demos, especially `demos/bookstore/` when broad
  app composition matters?
- Does it use local `references/` for deeper detail instead of bloating the main `SKILL.md`?
- Does it point to sibling skills when another subsystem owns part of the problem?
- Do cross-references appear only where they materially help the agent choose the next step?
- Does the skill avoid repeating broader-scope guidance unless it adds subsystem-specific value or a
  concrete example?
- Are TODOs used only to preserve shape, not to hide missing core content?
