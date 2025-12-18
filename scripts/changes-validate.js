import { validateAllChanges, formatValidationErrors } from './utils/changes.js'
import { colors, colorize } from './utils/color.js'

/**
 * Validates all change files in the repository
 * Exits with code 1 if any validation errors are found
 */
function main() {
  console.log('Validating change files...\n')

  let validationResult = validateAllChanges()

  if (validationResult.errorCount === 0) {
    console.log(colorize('All change files are valid!', colors.lightGreen) + '\n')
    process.exit(0)
  }

  console.error(colorize('Validation failed', colors.red) + '\n')
  console.error(formatValidationErrors(validationResult))
  console.error()
  process.exit(1)
}

main()
