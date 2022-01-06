import { LinksFunction } from "remix";
import stylesUrl from "../styles/index.css";

export const links: LinksFunction = () => {
  return [
    {
      rel: "stylesheet",
      href: stylesUrl
    }
  ];
};

export default function App() {
  const date = new Date();
  // today string in "YYYY-MM-DD" format
  const todayString = `${date.getFullYear()}-${('00' + (date.getMonth() + 1)).slice(-2)}-${('00' + (date.getDate())).slice(-2)}`;
  // tomorrow string in "YYYY-MM-DD" format
  const tomorrowString = `${date.getFullYear()}-${('00' + (date.getMonth() + 1)).slice(-2)}-${('00' + (date.getDate() + 1)).slice(-2)}`;

  return (
    <div className="root">
      <h1>Client-Side Validation Example</h1>
      <form method="post">
        <div className="form-control">
          <label>
            Required text
            <abbr title="This field is mandatory" aria-label="required">
              *
            </abbr>
            <input type="text" required />
          </label>
        </div>
        <div className="form-control">
          <fieldset>
            <legend>
              Required checkbox
              <abbr title="This field is mandatory" aria-label="required">
                *
              </abbr>
            </legend>
            <label>
              <input
                type="radio"
                required
                name="required-checkbox"
                value="yes"
              />
              Yes
            </label>
            <label>
              <input
                type="radio"
                required
                name="required-checkbox"
                value="maybe"
              />
              Maybe
            </label>
            <label>
              <input
                type="radio"
                required
                name="required-checkbox"
                value="no"
              />
              No
            </label>
          </fieldset>
        </div>
        <div className="form-control">
          <label>
            Text with regex validation (only allow [Bb]anana or [Oo]range)
            <input
              type="text"
              name="text-with-regex"
              list="list1"
              pattern="[Bb]anana|[Oo]range"
            />
            <datalist id="list1">
              <option>Banana</option>
              <option>Cherry</option>
              <option>Apple</option>
              <option>Strawberry</option>
              <option>Lemon</option>
              <option>Orange</option>
            </datalist>
          </label>
        </div>
        <div className="form-control">
          <label>
            Number with min (12) and max (120) validation
            <input
              type="number"
              name="number-with-min-max"
              min="12"
              max="120"
              step="1"
              pattern="\d+"
            />
          </label>
        </div>
        <div className="form-control">
          <label>
            Email
            <input name="email" type="email" />
          </label>
        </div>
        <div className="form-control">
          <label>Text with minLength(10) and maxLength(140)</label>
          <textarea
            name="text-with-minlength-maxlength"
            minLength={10}
            maxLength={140}
            rows={3}
          ></textarea>
        </div>
        <div className="form-control">
          <label>Date with min(today) and max(tomorrow)</label>
          <input
            type='date'
            name="date-with-min-max"
            min={todayString}
            max={tomorrowString}
          />
        </div>
        <div className="form-control">
          <button>Submit</button>
        </div>
      </form>
    </div>
  );
}
