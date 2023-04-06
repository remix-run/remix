export type WriteChannel<T> = {
  write: (data: T) => void;
  reject: () => void;
};
export type ReadChannel<T> = {
  read: () => Promise<T>;
};
export type Channel<T> = WriteChannel<T> & ReadChannel<T>;

export const createChannel = <T>(): Channel<T> => {
  let promiseResolve: (value: T) => void;
  let promiseReject: () => void;

  let promise = new Promise<T>((resolve, reject) => {
    promiseResolve = resolve;
    promiseReject = reject;
  });

  return {
    write: promiseResolve!,
    read: () => promise,
    reject: promiseReject!,
  };
};
