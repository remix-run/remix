import type { LoaderFunction } from "remix";

import greetingsQueue from "~/queues/greetings.server";

export const loader: LoaderFunction = async () => {
	await greetingsQueue.enqueue("Groot");
	return null;
};

export default function Index() {
	return <p>Check the code. Nothing relevant in the UI.</p>;
}
