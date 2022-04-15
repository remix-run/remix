import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Collaboration, ydoc, WebrtcProvider } from "~/utils/webrtc.client";

if (typeof document !== "undefined") {
  //join the room remix example
  new WebrtcProvider("room-remix-example", ydoc);
}
export default () => {
  let editor;
  if (typeof document !== "undefined") {
    editor = useEditor({
      extensions: [
        StarterKit.configure({
          history: false,
        }),
        Collaboration.configure({
          document: ydoc,
        }),
      ],
    });
  }

  return (
    <div>
      <h1>Open in two browsers and see the editing in sync</h1>
      <div style={{ border: "1px solid" }}>
        {editor && <EditorContent editor={editor} />}
      </div>
    </div>
  );
};
