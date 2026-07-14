/**
 * Interactive script to create a change file.
 *
 * Usage:
 *   pnpm changes:add
 */
import { cancel, intro, isCancel, multiselect, outro, select, text } from '@clack/prompts'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { getAllPackageDirNames, getPackagePath } from './utils/packages.ts'

// Common English stop words that add no meaning to a filename slug
const STOP_WORDS = new Set([
  'a',
  'an',
  'the',
  'and',
  'or',
  'but',
  'so',
  'nor',
  'yet',
  'in',
  'on',
  'at',
  'by',
  'for',
  'to',
  'of',
  'from',
  'with',
  'into',
  'onto',
  'about',
  'as',
  'via',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'being',
  'have',
  'has',
  'had',
  'do',
  'does',
  'did',
  'it',
  'its',
  'this',
  'that',
  'these',
  'those',
  'we',
  'us',
  'our',
  'i',
  'me',
  'my',
  'you',
  'your',
  'he',
  'him',
  'his',
  'she',
  'her',
  'they',
  'them',
  'their',
  'now',
  'then',
  'also',
  'just',
])

const bumpTypes = ['patch', 'minor', 'major'] as const
type BumpType = (typeof bumpTypes)[number]

interface PackageInfo {
  dirName: string
  name: string
}

intro('Create a change file')

const packages = getPackages()

const selectedPackages = await multiselect<PackageInfo>({
  message: 'Select packages',
  options: packages.map((pkg) => ({ label: pkg.name, value: pkg })),
  required: true,
})
if (isCancel(selectedPackages)) exitCancelled()

const bump = await select<BumpType>({
  message: 'Change type',
  options: bumpTypes.map((bumpType) => ({ label: bumpType, value: bumpType })),
  initialValue: 'patch',
})
if (isCancel(bump)) exitCancelled()

const descriptionAnswer = await text({
  message: 'Description',
  validate(value) {
    if (value == null || value.trim().length === 0) return 'Description cannot be empty'
  },
})
if (isCancel(descriptionAnswer)) exitCancelled()

const description = descriptionAnswer.trim()
const slug = toSlug(description)
const fileName = `${bump}.${slug}.md`

let results = ''

for (let pkg of selectedPackages) {
  let changesDir = path.join(getPackagePath(pkg.dirName), '.changes')
  let filePath = path.join(changesDir, fileName)

  if (!fs.existsSync(changesDir)) {
    fs.mkdirSync(changesDir, { recursive: true })
  }

  if (fs.existsSync(filePath)) {
    console.warn(`⚠️  File already exists, skipping: packages/${pkg.dirName}/.changes/${fileName}`)
    continue
  }

  fs.writeFileSync(filePath, `${description}\n`, 'utf-8')
  results += ` - packages/${pkg.dirName}/.changes/${fileName}\n`
}

outro('Done')

console.log(results ? `Created:\n\n${results}` : 'No change files were created.')

function getPackages(): PackageInfo[] {
  return getAllPackageDirNames()
    .map((dirName) => {
      let packageJsonPath = path.join(getPackagePath(dirName), 'package.json')
      if (!fs.existsSync(packageJsonPath)) return null

      let packageJson: unknown = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'))
      if (!isRecord(packageJson) || typeof packageJson.name !== 'string') return null

      return { dirName, name: packageJson.name }
    })
    .filter((pkg): pkg is PackageInfo => pkg !== null)
    .sort((a, b) => {
      function order(name: string) {
        if (name === 'remix') return 0
        if (name.startsWith('@remix-run/')) return 1
        return 2
      }
      let aOrder = order(a.name)
      let bOrder = order(b.name)
      if (aOrder !== bOrder) return aOrder - bOrder
      return a.name.localeCompare(b.name)
    })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function exitCancelled(): never {
  cancel('Operation cancelled')
  process.exit(0)
}

/**
 * Converts a free-text description into a kebab-case slug of at most five
 * meaningful words. Stop words and non-alphanumeric characters are stripped.
 */
function toSlug(description: string): string {
  return (
    description
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .trim()
      .split(/\s+/)
      .filter((word) => !STOP_WORDS.has(word))
      .slice(0, 5)
      .join('-') || 'change'
  )
}
