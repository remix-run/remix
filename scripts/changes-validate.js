import { validateAllChanges, formatValidationErrors } from './utils/changes.js'

/**
 * Validates all change files in the repository
 * Exits with code 1 if any validation errors are found
 */
function main() {
  console.log('🔍 Validating change files...\n')

  let validationResult = validateAllChanges()

  if (validationResult.errorCount === 0) {
    console.log('✅ All change files are valid!\n')
    process.exit(0)
  }

  console.error('❌ Validation failed\n')
  console.error(formatValidationErrors(validationResult))
  console.error()

  process.exit(1)
}

main()
