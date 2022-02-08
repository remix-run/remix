import { Button } from "@nodestrap/button";

export default function EsmLibs() {
  return (
    <>
      <h1>ESM Libs</h1>
      <Button
        tag="a"
        theme="primary"
        size="lg"
        gradient={true}
        outlined={true}
        press={true}
        onClick={() => alert("hello world")}
      >
        click me
      </Button>
    </>
  );
}
