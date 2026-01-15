import { parseAllChangeFiles, formatValidationErrors } from './utils/changes.ts'
import { colors, colorize } from './utils/color.ts'

/**
 * Validates all change files in the repository
 * Exits with code 1 if any validation errors are found
 */
function main() {
  console.log('Validating change files...\n')

  let result = parseAllChangeFiles()

  if (result.valid) {
    console.log(colorize('All change files are valid!', colors.lightGreen) + '\n')
    process.exit(0)
  }

  console.error(colorize('Validation failed', colors.red) + '\n')
  console.error(formatValidationErrors(result.errors))
  console.error()
  process.exit(1)
}

main()
