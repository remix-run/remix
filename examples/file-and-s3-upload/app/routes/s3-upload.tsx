import type { ActionFunction, UploadHandler } from "@remix-run/node";
import {
  json,
  unstable_composeUploadHandlers as composeUploadHandlers,
  unstable_createMemoryUploadHandler as createMemoryUploadHandler,
  unstable_parseMultipartFormData as parseMultipartFormData,
} from "@remix-run/node";
import { useFetcher } from "@remix-run/react";
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
  console.log(imgDesc);
  if (!imgSrc) {
    return json({
      errorMsg: "Something went wrong while uploading",
    });
  }
  return json({
    imgSrc,
    imgDesc,
  });
};

export default function Index() {
  const fetcher = useFetcher<ActionData>();
  return (
    <>
      <fetcher.Form method="post" encType="multipart/form-data">
        <label htmlFor="img-field">Image to upload</label>
        <input id="img-field" type="file" name="img" accept="image/*" />
        <label htmlFor="img-desc">Image description</label>
        <input id="img-desc" type="text" name="desc" />
        <button type="submit">Upload to S3</button>
      </fetcher.Form>
      {fetcher.type === "done" ? (
        fetcher.data.errorMsg ? (
          <h2>{fetcher.data.errorMsg}</h2>
        ) : (
          <>
            <div>
              File has been uploaded to S3 and is available under the following
              URL (if the bucket has public access enabled):
            </div>
            <div>{fetcher.data.imgSrc}</div>
            <img
              src={fetcher.data.imgSrc}
              alt={fetcher.data.imgDesc || "Uploaded image from S3"}
            />
          </>
        )
      ) : null}
    </>
  );
}
