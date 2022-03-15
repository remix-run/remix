import type { Processor } from "bullmq";
import { Queue as BullQueue, Worker, QueueScheduler } from "bullmq";

import { redis } from "./redis.server";

type RegisteredQueue = {
  queue: BullQueue;
  worker: Worker;
  scheduler: QueueScheduler;
};

declare global {
  var __registeredQueues: Record<string, RegisteredQueue> | undefined;
}

const registeredQueues =
  global.__registeredQueues || (global.__registeredQueues = {});

export function Queue<Payload>(
  name: string,
  handler: Processor<Payload>
): BullQueue<Payload> {
  if (registeredQueues[name]) {
    return registeredQueues[name].queue;
  }

  // Bullmq queues are the storage container managing jobs.
  const queue = new BullQueue<Payload>(name, { connection: redis });

  // Workers are where the meat of our processing lives within a queue.
  // They reach out to our redis connection and pull jobs off the queue
  // in an order determined by factors such as job priority, delay, etc.
  // The scheduler plays an important role in helping workers stay busy.
  const worker = new Worker<Payload>(name, handler, { connection: redis });

  // Schedulers are used to move tasks between states within the queue.
  // Jobs may be queued in a delayed or waiting state, but the scheduler's
  // job is to eventually move them to an active state.
  const scheduler = new QueueScheduler(name, { connection: redis });

  registeredQueues[name] = { queue, scheduler, worker };

  return queue;
}
