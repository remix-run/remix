type Resolve<V> = (value: V | PromiseLike<V>) => void;
type Reject = (reason?: any) => void;

export type Read<V> = {
  promise: Promise<V>;
};

export type Write<V> = {
  resolve: Resolve<V>;
  reject: Reject;
};

export type WriteRead<V> = Write<V> & Read<V>;

export const create = <V>(): WriteRead<V> => {
  let _resolve: Resolve<V>;
  let _reject: Reject;

  let promise = new Promise<V>((resolve, reject) => {
    _resolve = resolve;
    _reject = reject;
  });

  return { promise, resolve: _resolve!, reject: _reject! };
};
