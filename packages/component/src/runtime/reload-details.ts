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
  /**
   * Submitted form entries for a POST reload. `null` for GET reloads.
   * Shared with the initiating request; copy the entries before modifying them.
   */
  readonly formData: FormData | null
  /** The actual submit button, or `null` when there is no submitter. */
  readonly submitter: HTMLElement | null
  /**
   * Follows this reload like `frame.reload()`: resolves with its signal after rendering, or with
   * an aborted signal on cancellation, supersession, or frame removal. Rejects on failure.
   * On success, retained components have updated props. Descendant frame events track their
   * own reload completion.
   */
  readonly finished: Promise<AbortSignal>
}
