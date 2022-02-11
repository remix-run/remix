export type User = { name: string };
export async function getUser() {
  return { name: "Rachel" };
}

export type Workshop = { id: string; title: string; description: string };
export async function getWorkshops() {
  return [
    {
      id: "1",
      title: "Making Cookies",
      description: `Let's make some cookies! 🍪`
    },
    {
      id: "2",
      title: "Baking Bread",
      description: `Let's bake some bread! 🍞`
    },
    {
      id: "3",
      title: "Cooking Chicken",
      description: `Let's cook some chicken! 🍗`
    }
  ];
}
