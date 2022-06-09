import type { ActionFunction, UploadHandler } from "@remix-run/node";
import {
    json,
  unstable_composeUploadHandlers as composeUploadHandlers,
  unstable_createMemoryUploadHandler as createMemoryUploadHandler,
  unstable_parseMultipartFormData as parseMultipartFormData,
} from "@remix-run/node";
import { Form, useActionData } from "@remix-run/react";
import { s3UploadHandler } from "~/utils/s3.server";

type ActionData = {
  errorMsg?: string;
  imgSrc?: string;
  imgDesc?: string;
};

export const action: ActionFunction = async ({ request }) => {
  const uploadHandler: UploadHandler = composeUploadHandlers(
    s3UploadHandler,
    createMemoryUploadHandler()
  );
  const formData = await parseMultipartFormData(request, uploadHandler);
  const imgSrc = formData.get("img");
  const imgDesc = formData.get("desc");
  console.log(imgDesc)
  if (!imgSrc) {
    return json({
      error: "Something went wrong while uploading",
    });
  }
  return json({
    imgSrc,
    imgDesc,
  });
};

export default function Index() {
  const data = useActionData<ActionData>();
  return (
    <>
      <Form method="post" encType="multipart/form-data">
        <label htmlFor="img-field">Image to upload</label>
        <input id="img-field" type="file" name="img" accept="image/*" />
        <label htmlFor="img-desc">Image description</label>
        <input id="img-desc" type="text" name="desc" />
        <button type="submit">Upload to S3</button>
      </Form>
      {data?.errorMsg && <h2>{data.errorMsg}</h2>}
      {data?.imgSrc && (
        <>
          <div>File has been uploaded to S3 and is available under the following URL (if the bucket has public access enabled):</div>
          <div>{data.imgSrc}</div>
          <img src={data.imgSrc} alt={data.imgDesc || "Uploaded image from S3"} />
          
        </>
      )}
    </>
  );
}
