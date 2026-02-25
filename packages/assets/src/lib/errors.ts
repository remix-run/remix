export class AssetError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AssetError'
  }
}

export class AssetNotFoundError extends AssetError {
  path: string

  constructor(path: string, detail?: string) {
    super(detail ? `Asset not found: '${path}' — ${detail}` : `Asset not found: '${path}'`)
    this.name = 'AssetNotFoundError'
    this.path = path
  }
}

export class AssetVariantRequiredError extends AssetError {
  path: string
  availableVariants: string[]

  constructor(path: string, availableVariants: string[]) {
    super(`Asset '${path}' requires a variant. Available variants: ${availableVariants.join(', ')}`)
    this.name = 'AssetVariantRequiredError'
    this.path = path
    this.availableVariants = availableVariants
  }
}

export class AssetVariantNotFoundError extends AssetError {
  path: string
  variant: string
  availableVariants: string[]

  constructor(path: string, variant: string, availableVariants: string[]) {
    super(
      `Asset '${path}' has no variant '${variant}'. Available variants: ${availableVariants.join(', ')}`,
    )
    this.name = 'AssetVariantNotFoundError'
    this.path = path
    this.variant = variant
    this.availableVariants = availableVariants
  }
}

export class AssetVariantUnexpectedError extends AssetError {
  path: string
  variant: string

  constructor(path: string, variant: string) {
    super(`Asset '${path}' has no variants configured, but variant '${variant}' was requested`)
    this.name = 'AssetVariantUnexpectedError'
    this.path = path
    this.variant = variant
  }
}
