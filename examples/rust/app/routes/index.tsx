import { Form, useActionData } from "remix";
import { add } from "~/rust.server";
import indexStylesUrl from "~/styles/index.css";

import type { ActionFunction } from "remix";

export function links() {
  return [{ rel: "stylesheet", href: indexStylesUrl }];
}

export const action: ActionFunction = async ({ request }) => {
  const formData = await request.formData();
  const { left_operand, operator, right_operand } =
    Object.fromEntries(formData);
  console.log(Object.fromEntries(formData));
  switch (operator) {
    case "+":
      const result = add(Number(left_operand), Number(right_operand));
      console.log("result", result);
      return {
        result
      };
    default:
      // Implement other operators
      return {
        result: "🤷🏾"
      };
  }
};

export default function Index() {
  const data = useActionData();

  return (
    <Form className="form-container" method="post" replace>
      <div className="grid-container">
        <input
          className="operand"
          type="number"
          name="left_operand"
          id="left_operand"
          placeholder="2"
        />
        <select className="operator" name="operator" id="operator">
          <option value="+">+</option>
          <option value="-">-</option>
          <option value="*">*</option>
          <option value="/">/</option>
        </select>
        <input
          className="operand"
          type="number"
          name="right_operand"
          id="right_operand"
          placeholder="2"
        />
        <button className="submit" type="submit">
          =
        </button>
        <div className="result">{data?.result ? data?.result : ""}</div>
      </div>
    </Form>
  );
}
