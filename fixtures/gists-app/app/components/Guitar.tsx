import guitar from "img:./guitar.jpg?quality=50&format=avif&placeholder&width=500";
import guitar2 from "img:./guitar.jpg?quality=80&format=jpg&srcset=720,1080,2048&placeholder";

export default function Guitar() {
  return (
    <div>
      <h2>Images</h2>
      <p>Fixed Image</p>
      <img
        alt="Guitar"
        src={guitar.src}
        style={{
          backgroundImage: `url(${guitar.placeholder})`,
          backgroundSize: "cover"
        }}
        width={guitar.width / 2}
        height={guitar.height / 2}
      />

      <p>Responsive</p>
      <img
        alt="Guitar"
        src={guitar2.src}
        srcSet={guitar2.srcset}
        style={{
          backgroundImage: `url(${guitar2.placeholder})`,
          backgroundSize: "cover"
        }}
      />
    </div>
  );
}
