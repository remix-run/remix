import { client } from "~/utils/edgedb.server";
import e from "./dbschema/edgeql-js";
import bcrypt from "bcryptjs";
const USERNAME = "joker";
const PASSWORD = "remixrulz";

const JOKES = [
  {
    name: "Road worker",
    content: `I never wanted to believe that my Dad was stealing from his job as a road worker. But when I got home, all the signs were there.`,
  },
  {
    name: "Frisbee",
    content: `I was wondering why the frisbee was getting bigger, then it hit me.`,
  },
  {
    name: "Trees",
    content: `Why do trees seem suspicious on sunny days? Dunno, they're just a bit shady.`,
  },
  {
    name: "Skeletons",
    content: `Why don't skeletons ride roller coasters? They don't have the stomach for it.`,
  },
  {
    name: "Hippos",
    content: `Why don't you find hippopotamuses hiding in trees? They're really good at it.`,
  },
  {
    name: "Dinner",
    content: `What did one plate say to the other plate? Dinner is on me!`,
  },
  {
    name: "Elevator",
    content: `My first time using an elevator was an uplifting experience. The second time let me down.`,
  },
];

async function seed() {
  const passwordHash = await bcrypt.hash(PASSWORD, 10);
  const newUser = await e
    .insert(e.User, {
      username: USERNAME,
      passwordHash,
    })
    .run(client);

  const jokes = await e
    .for(e.json_array_unpack(e.json(JOKES)), (joke) => {
      return e.insert(e.Joke, {
        name: e.cast(e.str, joke.name),
        content: e.cast(e.str, joke.content),
        jokester: e.select(e.User, (user) => ({
          filter: e.op(user.id, "=", e.uuid(newUser.id)),
        })),
      });
    })
    .run(client);

  console.log(`Database has been seeded. 🌱`);
}

seed();
