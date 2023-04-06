type Ok<V> = V extends void ? { ok: true } : { ok: true; value: V };
type Err<E = unknown> = { ok: false; error: E };
export type Type<V, E = unknown> = Ok<V> | Err<E>;

export let ok = ((...args: unknown[]) => {
  if (args.length === 0) {
    return { ok: true };
  }
  return { ok: true, value: args[0] };
}) as {
  (): { ok: true };
  <V>(value: V): { ok: true; value: V };
};
export let err = <E>(error: E): Err<E> => ({ ok: false, error });
