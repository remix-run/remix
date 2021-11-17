// shout-out to https://icanhazdadjoke.com/

import { z } from "zod";

export let Joke = z.object({
  name: z.string(),
  content: z.string(),
  id: z.string(),
});

export type Joke = z.infer<typeof Joke>;

export let jokes: Array<Joke> = [
  {
    name: "Road worker",
    content: `I never wanted to believe that my Dad was stealing from his job as a road worker. But when I got home, all the signs were there.`,
    id: "khoqm1v9dl8",
  },
  {
    name: "Frisbee",
    content: `I was wondering why the frisbee was getting bigger, then it hit me.`,
    id: "end19pnrol8",
  },
  {
    name: "Trees",
    content: `Why do trees seem suspicious on sunny days? Dunno, they're just a bit shady.`,
    id: "7684nk3n77o",
  },
  {
    name: "Skeletons",
    content: `Why don't skeletons ride roller coasters? They don't have the stomach for it.`,
    id: "to1cih4hc2o",
  },
  {
    name: "Hippos",
    content: `Why don't you find hippopotamuses hiding in trees? They're really good at it.`,
    id: "cb3gaqlbr08",
  },
  {
    name: "Dinner",
    content: `What did one plate say to the other plate? Dinner is on me!`,
    id: "adu27frjaf8",
  },
  {
    name: "Elevator",
    content: `My first time using an elevator was an uplifting experience. The second time let me down.`,
    id: "cj9rhamh1lg",
  },
];
