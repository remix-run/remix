import { Queue } from "~/utils/queue.server";

type QueueData = {
  emailAddress: string;
};

export const queue = Queue<QueueData>("notifier", async (job) => {
  console.log(`Sending email to ${job.data.emailAddress}`);

  // Delay 1 second to simulate sending an email, be it for user registration, a newsletter, etc.
  await new Promise((resolve) => setTimeout(resolve, 1000));

  console.log(`Email sent to ${job.data.emailAddress}`);
});
