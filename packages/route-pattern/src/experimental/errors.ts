type ParseErrorType = 'unmatched (' | 'unmatched )' | 'missing variable name' | 'dangling escape'

export class ParseError extends Error {
  type: ParseErrorType
  source: string
  index: number

  constructor(type: ParseErrorType, source: string, index: number) {
    let underline = ' '.repeat(index) + '^'
    let message = `${type}\n\n${source}\n${underline}`

    super(message)
    this.name = 'ParseError'
    this.type = type
    this.source = source
    this.index = index
  }
}

export class InternalError extends Error {}
