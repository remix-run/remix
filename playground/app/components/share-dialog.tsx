import { css, ref, type Handle } from "remix/ui";

import { connect, type AppUiApi, shallowEqual } from "../store/index.ts";

/**
 * The "Shared Project" modal. It subscribes to the share slice of the store and
 * reflects whatever {@link shareProject} publishes: a spinner while uploading,
 * the resulting link on success, or an error. Opening the dialog is the
 * responsibility of whoever starts the share (the toolbar), via its element id.
 */
export function ShareDialog(handle: Handle<{ api: AppUiApi }>) {
  const { api } = handle.props;
  const view = connect(
    handle,
    api,
    (s) => ({ sharing: s.sharing, sharedId: s.sharedId }),
    shallowEqual,
  );

  return () => {
    const { sharing, sharedId } = view();
    return (
      <jui-modal>
        <dialog
          closedby="any"
          mix={ref((node: HTMLDialogElement, signal) => {
            api.services.shareDialog = node;
            signal.addEventListener("abort", () => {
              if (api.services.shareDialog === node) api.services.shareDialog = null;
            });
          })}
        >
          <jui-modal-header>Shared Project</jui-modal-header>
          <jui-modal-body>
            {sharing ? (
              <p>Creating unique shareable link...</p>
            ) : sharedId ? (
              <>
                <p>Shareable link: </p>
                <p mix={css({ wordBreak: "break-all" })}>
                  <a href={`/?project=${sharedId}`} target="_blank">
                    {location.origin}/?project={sharedId}
                  </a>
                </p>
              </>
            ) : (
              <p>Failed to create shareable link.</p>
            )}
          </jui-modal-body>
          <jui-modal-footer>
            <form method="dialog">
              <jui-button size="sm">
                <button>Close</button>
              </jui-button>
            </form>
          </jui-modal-footer>
        </dialog>
      </jui-modal>
    );
  };
}
