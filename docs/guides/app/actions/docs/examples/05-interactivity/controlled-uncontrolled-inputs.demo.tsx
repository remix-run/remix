import { on } from "remix/ui";
import type { Handle } from "remix/ui";

const initialTitle = "Thriller";

export function ControlledUncontrolledInputs(handle: Handle) {
  let title = initialTitle;

  return () => (
    <div>
      <p>
        <label>
          Uncontrolled <input defaultValue={initialTitle} />
        </label>
      </p>

      <p>
        <label>
          Controlled{" "}
          <input
            value={title}
            mix={on("input", (event) => {
              title = event.currentTarget.value;
              handle.update();
            })}
          />
        </label>
      </p>

      <button
        mix={on("click", () => {
          title = initialTitle;
          handle.update();
        })}
        type="button"
      >
        Reset controlled input
      </button>
    </div>
  );
}
