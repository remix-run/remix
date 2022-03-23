import { Form, useActionData } from "@remix-run/react";
import { json, unstable_createFileUploadHandler, unstable_parseMultipartFormData } from "@remix-run/node";
import type { ActionFunction } from "@remix-run/node";

type ActionData = {
  errorMsg?: string;
  imgSrc?: string;
};

export const action: ActionFunction = async ({ request }) => {
  const uploadHandler = unstable_createFileUploadHandler({
    directory: "public",
    maxFileSize: 30000,
  });
  const formData = await unstable_parseMultipartFormData(
    request,
    uploadHandler
  );
  const image = formData.get("img");
  if (!image) {
    return json({
      error: "something wrong",
    });
  }
  return json({
    imgSrc: image.name,
  });
};

export default function Index() {
  const data = useActionData<ActionData>();
  return (
    <>
      <Form method="post" encType="multipart/form-data">
        <input type="file" name="img" accept="image/*" />
        <button type="submit">upload image</button>
      </Form>
      {data?.errorMsg && <h2>{data.errorMsg}</h2>}
      {data?.imgSrc && (
        <>
          <h2>uploaded image</h2>
          <img alt="uploaded" src={data.imgSrc} />
        </>
      )}
    </>
  );
}
