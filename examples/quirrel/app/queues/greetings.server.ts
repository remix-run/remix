import { Queue } from "quirrel/remix";

export default Queue("/queues/greetings", async (name: string) => {
	console.log(`Greetings, ${name}!`);
});
