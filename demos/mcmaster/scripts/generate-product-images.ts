/**
 * Generates studio-style product photos with the OpenAI Images API: one per catalog family, saved to
 * app/images/products/<family>.webp, and one per presentation, saved to
 * app/images/products/<family>/<presentation>.webp. The photo descriptions live in
 * app/data/catalog.ts. Existing images are kept unless you pass --force.
 *
 *   OPENAI_API_KEY=... pnpm images:generate
 *   OPENAI_API_KEY=... pnpm images:generate --force --only hex-nuts --only o-rings/viton
 *
 * `--only` accepts a family slug, which selects the family and all of its presentations, or a
 * `family/presentation` path. Set OPENAI_BASE_URL to use an OpenAI-compatible proxy.
 */
import * as fs from 'node:fs/promises'
import * as path from 'node:path'
import { parseArgs } from 'node:util'
import sharp from 'sharp'

import { catalog } from '../app/data/catalog.ts'
import { toParam } from '../app/data/specs.ts'

const model = 'gpt-image-2.5-flare'
// Matches the official OpenAI SDKs, so the script also works through OpenAI-compatible proxies.
const baseUrl = process.env.OPENAI_BASE_URL ?? 'https://api.openai.com/v1'
const outputDirectory = path.join(import.meta.dirname, '../app/images/products')
const outputSize = 768
const concurrency = 6

interface PhotoJob {
  /** `family` or `family/presentation`, relative to the output directory. */
  id: string
  photo: string
}

const { values: options } = parseArgs({
  options: {
    force: { type: 'boolean', default: false },
    only: { type: 'string', multiple: true },
  },
})

const apiKey = process.env.OPENAI_API_KEY
if (!apiKey) throw new Error('Set OPENAI_API_KEY to generate product images')

const jobs: PhotoJob[] = catalog
  .flatMap((section) => section.categories)
  .flatMap((category) => category.families)
  .flatMap((family) => [
    { id: family.slug, photo: family.photo },
    ...family.presentations.map((presentation) => ({
      id: `${family.slug}/${toParam(presentation.name)}`,
      photo: presentation.photo,
    })),
  ])
  .filter(
    (job) =>
      options.only == null ||
      options.only.some((only) => job.id === only || job.id.startsWith(`${only}/`)),
  )

const queue = [...jobs]
const failures: string[] = []
await Promise.all(
  Array.from({ length: concurrency }, async () => {
    for (let job = queue.shift(); job != null; job = queue.shift()) {
      let file = path.join(outputDirectory, `${job.id}.webp`)
      if (!options.force && (await exists(file))) {
        console.log(`skip     ${job.id}`)
        continue
      }

      try {
        let image = await generateImage(job.photo)
        await fs.mkdir(path.dirname(file), { recursive: true })
        await sharp(image).resize(outputSize, outputSize).webp({ quality: 82 }).toFile(file)
        console.log(`saved    ${path.relative(process.cwd(), file)}`)
      } catch (error) {
        // Keep going so one rejected prompt does not waste the rest of the run.
        failures.push(job.id)
        console.error(`failed   ${job.id}: ${error instanceof Error ? error.message : error}`)
      }
    }
  }),
)

if (failures.length > 0) {
  console.error(`\n${failures.length} images failed: ${failures.join(', ')}`)
  process.exitCode = 1
}

async function generateImage(subject: string): Promise<Buffer> {
  let response = await fetch(`${baseUrl}/images/generations`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      prompt: [
        `Studio product photograph for an industrial supply catalog: ${subject}.`,
        'Centered and filling about 70% of a square frame, isolated on a pure white seamless background.',
        'Soft, even, diffused lighting with a subtle natural shadow beneath. Sharp focus and true-to-life materials.',
        'No text, labels, logos, packaging, hands, or props.',
      ].join(' '),
      size: '1024x1024',
      quality: 'medium',
      background: 'opaque',
      output_format: 'png',
      n: 1,
    }),
  })

  if (!response.ok) {
    throw new Error(`Image generation failed (${response.status}): ${await response.text()}`)
  }

  let result: unknown = await response.json()
  let base64 = getBase64Image(result)
  if (base64 == null) throw new Error('Image generation returned no image data')

  return Buffer.from(base64, 'base64')
}

function getBase64Image(result: unknown): string | undefined {
  if (typeof result !== 'object' || result == null || !('data' in result)) return undefined
  if (!Array.isArray(result.data)) return undefined

  let [first]: unknown[] = result.data
  if (typeof first !== 'object' || first == null || !('b64_json' in first)) return undefined
  return typeof first.b64_json === 'string' ? first.b64_json : undefined
}

async function exists(file: string): Promise<boolean> {
  try {
    await fs.access(file)
    return true
  } catch {
    return false
  }
}
