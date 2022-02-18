import type { TypeC } from "io-ts";
import { pipe } from "fp-ts/function";
import { fold } from "fp-ts/Either";

/**
 * A type guard that ensures that `value` is numeric, even if passed as
 * a `string`:
 * isNumeric(1)   === true
 * isNumeric('1') === true
 * isNumeric('a') === false
 * https://www.typescriptlang.org/docs/handbook/2/narrowing.html#using-type-predicates
 */
const isNumeric = (value: any): value is number | string =>
  !isNaN(parseFloat(value)) && isFinite(value);

type Form = Record<string, any>;

/**
 * Takes a `request` and a runtime representation of a type (see `const User` in
 * `/routes/index.tsx`) and returns the correctly typed form data if it equates
 * to the given runtime-type. Throws a 422 otherwise.
 */
export const decodeFormData = async <DecodedForm extends Form>(
  request: Request,
  codec: TypeC<DecodedForm>
) => {
  const formData = await request.formData();

  const form: Form = {};
  for (const [name, value] of formData.entries()) {
    const numericValueExpected = codec.props[name]?.name === "number";
    form[name] =
      numericValueExpected && isNumeric(value) ? Number(value) : value;
  }

  return pipe(
    codec.decode(form),
    fold(
      // left: the error case
      errors => {
        throw new Response(JSON.stringify(errors), { status: 422 });
      },
      // right: successful computation of `codec.decode(form)`
      decodedFormData => decodedFormData
    )
  );
};
