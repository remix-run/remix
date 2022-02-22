import { useSpring, animated, config } from "react-spring";

export default function () {
  const [{ x }, interpolate] = useSpring(() => ({
    from: { x: 0 },
    config: config.wobbly
  }));

  const { opacity } = useSpring({
    from: { opacity: 0 },
    opacity: 1,
    config: config.slow,
    delay: 200
  });

  return (
    <animated.h1
      onMouseEnter={() => {
        interpolate({ x: 1 });
      }}
      onMouseLeave={() => {
        interpolate({ x: 0 });
      }}
      style={{
        width: "min-content",
        margin: "0 auto",
        cursor: "pointer",
        opacity,
        color: x.to({ range: [0, 1], output: ["#000", "#f00"] }),
        scale: x.to({ range: [0, 1], output: [1, 1.5] })
      }}
    >
      Remix
    </animated.h1>
  );
}
