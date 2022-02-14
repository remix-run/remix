import { Queue, Worker, QueueScheduler } from "bullmq";

import { redis } from "~/utils/redis.server";

declare global {
  var __notifierQueue: Queue | undefined;
  var __notifierWorker: Worker | undefined;
  var __notifierScheduler: QueueScheduler | undefined;
}

const QUEUE_NAME = "notifier";

type QueueData = {
  emailAddress: string;
};

// Bullmq queues are the storage container managing jobs.
export const queue: Queue =
  global.__notifierQueue ||
  (global.__notifierQueue = new Queue<QueueData>(QUEUE_NAME, {
    connection: redis
  }));

// Workers are where the meat of our processing lives within a queue.
// They reach out to our redis connection and pull jobs off the queue
// in an order determined by factors such as job priority, delay, etc.
// The scheduler plays an important role in helping workers stay busy.
const worker: Worker =
  global.__notifierWorker ||
  (global.__notifierWorker = new Worker<QueueData>(
    QUEUE_NAME,
    async job => {
      console.log(`Sending email to ${job.data.emailAddress}`);

      // Delay 1 second to simulate sending an email, be it for user registration, a newsletter, etc.
      await new Promise(resolve => setTimeout(resolve, 1000));

      console.log(`Email sent to ${job.data.emailAddress}`);
    },
    {
      connection: redis
    }
  ));

// Schedulers are used to move tasks between states within the queue.
// Jobs may be queued in a delayed or waiting state, but the scheduler's
// job is to eventually move them to an active state.
const scheduler: QueueScheduler =
  global.__notifierScheduler ||
  (global.__notifierScheduler = new QueueScheduler(QUEUE_NAME, {
    connection: redis
  }));
