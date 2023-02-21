type AsyncFunction<T> = () => Promise<T>;

let queue: Array<() => void> = [];
let isProcessingQueue = false;

export async function lock<T>(fn: AsyncFunction<T>): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let queueFn = async () => {
      try {
        let result = await fn();
        resolve(result);
      } catch (error) {
        reject(error);
      } finally {
        isProcessingQueue = false;
        processQueue();
      }
    };

    queue.push(queueFn);

    if (!isProcessingQueue) {
      processQueue();
    }
  });
}

async function processQueue() {
  if (isProcessingQueue || queue.length === 0) {
    return;
  }

  isProcessingQueue = true;
  let fn = queue.shift()!;

  await fn();
}
