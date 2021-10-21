import type { MetaFunction } from "remix";

export let meta: MetaFunction = () => {
  return { title: "Ain't nothing here" };
};

export default function FourOhFour() {
  return (
    <div>
      <h1>404</h1>
    </div>
  );
}
