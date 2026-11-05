/** Request and lifecycle details shared by frame reload and form submission events. */
export interface ReloadDetails {
  /**
   * Source of the initiating reload, including any GET submission query. Inherited reloads keep
   * their ancestor's source. Relative values use the document base URL.
   */
  readonly src: string
  /** Effective HTTP method of the initiating reload, in lowercase. */
  readonly method: string
  /** Form encoding of the initiating POST reload. `null` for GET reloads. */
  readonly encType: string | null
  /** Submitted form entries for a POST reload. `null` for GET reloads. */
  readonly formData: FormData | null
  /**
   * The initiating anchor, area, or owning form. `null` for programmatic reloads, programmatic
   * navigations, and history traversal.
   */
  readonly element: Element | null
  /** The actual submit button, or `null` when there is no submitter. */
  readonly submitter: HTMLElement | null
  /**
   * Resolves with this reload's outcome once its content has rendered, it fails, or it is
   * aborted. Never rejects. Failures carry an `Error`; other thrown values are wrapped in an
   * `Error` with the original value as its `cause`. Aborted reloads have no error.
   * Descendant frame events track their own reload completion.
   */
  readonly finished: Promise<FrameReloadOutcome>
}

/** Completion of a frame reload, reported without rejecting the event's `finished` promise. */
export interface FrameReloadOutcome {
  /** Failure of the reload, or `undefined` when it completed or was aborted. */
  readonly error: Error | undefined
  /** Whether the reload was cancelled, superseded, or its frame was removed. */
  readonly aborted: boolean
}
