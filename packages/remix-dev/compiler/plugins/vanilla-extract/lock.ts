const queue: Array<() => Promise<void>> = [];
let isRunning = false;

export const lock = async <T>(fn: () => Promise<T>): Promise<T> => {
  let executeNextTask = () => {
    const nextTask = queue.pop();

    if (nextTask) {
      nextTask();
    } else {
      isRunning = false;
    }
  };

  if (!isRunning) {
    isRunning = true;
    let result = await fn();

    executeNextTask();

    return result;
  } else {
    return new Promise((resolve) => {
      queue.push(async () => {
        let result = await fn();

        resolve(result);

        executeNextTask();
      });
    });
  }
};
