export type WriteChannel<T> = {
  write: (data: T) => void;
};
export type ReadChannel<T> = {
  read: () => Promise<T>;
  reject: (reason: any) => void;
};
export type Channel<T> = WriteChannel<T> & ReadChannel<T>;

export const createChannel = <T>(): Channel<T> => {
  let promiseResolve: (value: T) => void;
  let promiseReject: (reason: any) => void;

  let promise = new Promise<T>((resolve, reject) => {
    promiseResolve = resolve;
    promiseReject = reject;
  }).catch((error) => {
    return error;
  });

  return {
    write: promiseResolve!,
    read: () => promise,
    reject: promiseReject!,
  };
};
