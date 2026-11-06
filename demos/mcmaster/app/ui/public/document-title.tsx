import { clientEntry, type Handle } from 'remix/component'

export function formatDocumentTitle(title: string): string {
  return `${title} | Remix Supply`
}

/**
 * Keeps `document.title` in sync when a navigation swaps only the content frame. The `<title>`
 * element lives in the document head, outside the frame, so the frame carries its title here.
 */
export const DocumentTitle = clientEntry(
  import.meta.url,
  function DocumentTitle(handle: Handle<{ title: string }>) {
    return () => {
      let title = formatDocumentTitle(handle.props.title)
      handle.queueTask(() => {
        document.title = title
      })
      return null
    }
  },
)
