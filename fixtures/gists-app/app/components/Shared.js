import guitar from "./314ce.png";

export default function Shared() {
  return (
    <div>
      <p>I am shared</p>
      <img
        alt="Taylor 314ce"
        src={guitar}
        height="200"
        style={{ border: "solid 2px black" }}
      />
    </div>
  );
}
