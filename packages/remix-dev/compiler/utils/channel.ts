type Resolve<T> = (value: T | PromiseLike<T>) => void;
type Reject = (reason?: any) => void;

export type Read<T> = {
  promise: Promise<T>;
};

export type Write<T> = {
  resolve: Resolve<T>;
  reject: Reject;
};

export type Type<T> = Write<T> & Read<T>;

export const create = <T>(): Type<T> => {
  let _resolve: Resolve<T>;
  let _reject: Reject;

  let promise = new Promise<T>((resolve, reject) => {
    _resolve = resolve;
    _reject = reject;
  });

  return { promise, resolve: _resolve!, reject: _reject! };
};
