import type {
    ActionFunction,
    LoaderFunction,
    MetaFunction,
} from "@remix-run/node";
import { useEffect } from "react";
import { useLoaderData, Form, useFetcher} from "@remix-run/react";
import { useSocket } from "~/context";
import { server } from "~/feathers.server";
import { json } from "@remix-run/node";


export const loader: LoaderFunction = async ()=>  {
    return await server.service('messages').find().then((data: any) => {
        console.log(data.data);
        return data.data;
    });
}

export const action: ActionFunction = async ({ context }) => {
    const { request } = context;
    const { message } = request.body
    if(!message) {
        return json("error", {status: 404})
    }
    const status = await server.service('messages').create({message});
    return json(status);
  }

export default function Index() {
  const feathers = useSocket();
  const fetcher = useFetcher();

  useEffect(() => {
    feathers?.on("event", (data: any) => {
      console.log(data);
    });
    //feathers emits service events in the form of servicepath eventname
    //in this case, our servicepath is messages and the event is created
    feathers?.on('messages created', () => {
        //if a message has been created, recall the loader
        console.log('Got message, calling loader');
        fetcher.load('/?index');
    })
  }, [feathers]);
  return (
    <div style={{ fontFamily: "system-ui, sans-serif", lineHeight: "1.4" }}>
      <h1>Welcome to Remix + Feathersjs</h1>
      <div>
        <button type="button" onClick={() => feathers?.emit("event", "ping")}>
          Send ping
        </button>
        <Form method="post">
            <input type="text" name="message" />
        </Form>
      </div>
      { fetcher.type == "done" ?
        fetcher.data.map((message: any) => (
                <div key={message.id}>
                  <p>{message.message}</p>
                </div>
            )) : <p>No messages</p> 
      }
      <p>See Browser console and Server terminal</p>
    </div>
  );
}