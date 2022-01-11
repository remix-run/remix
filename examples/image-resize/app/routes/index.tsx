import { Image } from "~/components/image";

const containerStyles = {
  padding: "2rem",
  "margin-left": "auto",
  "margin-right": "auto"
};
const imageGridStyles = {
  display: "flex",
  gap: "1rem",
  "align-items": "center",
  "overflow-x": "scroll"
};

export default function Index() {
  return (
    <div style={containerStyles}>
      <h1>Cover</h1>
      <div style={imageGridStyles}>
        <Image src="dog-1.jpg" width={600} height={600} fit="cover" />
        <Image src="dog-1.jpg" width={300} height={300} fit="cover" />
        <Image src="dog-1.jpg" width={150} height={150} fit="cover" />
        <Image src="dog-1.jpg" width={50} height={50} fit="cover" />
      </div>

      <h1>Contain</h1>
      <div style={imageGridStyles}>
        <Image src="other-dogs/dog-2.jpg" width={600} fit="contain" />
        <Image src="other-dogs/dog-2.jpg" width={300} fit="contain" />
        <Image src="other-dogs/dog-2.jpg" width={150} fit="contain" />
        <Image src="other-dogs/dog-2.jpg" width={50} fit="contain" />
      </div>
    </div>
  );
}
