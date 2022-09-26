export interface WriteChannel<T> {
  write: (data: T) => void;
}
export interface ReadChannel<T> {
  read: () => Promise<T>;
}
export type Channel<T> = WriteChannel<T> & ReadChannel<T>;

export const createChannel = <T>(): Channel<T> => {
  let promiseResolve: ((value: T) => void) | undefined = undefined;

  let promise = new Promise<T>((resolve) => {
    promiseResolve = resolve;
  });

  return {
    write: promiseResolve!,
    read: async () => promise,
  };
};
