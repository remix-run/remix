import { Form, useActionData } from "@remix-run/react";
import { json, unstable_parseMultipartFormData } from "@remix-run/node";
import type { ActionFunction, UploadHandler } from "@remix-run/node";

import { uploadImage } from "~/utils/utils.server";

type ActionData = {
  errorMsg?: string;
  imgSrc?: string;
  imgDesc?: string;
};

export const action: ActionFunction = async ({ request }) => {
  const uploadHandler: UploadHandler = async ({ name, stream }) => {
    if (name !== "img") {
      stream.resume();
      return;
    }
    const uploadedImage = await uploadImage(stream);
    return uploadedImage.secure_url;
  };

  const formData = await unstable_parseMultipartFormData(
    request,
    uploadHandler
  );
  const imgSrc = formData.get("img");
  const imgDesc = formData.get("desc");
  if (!imgSrc) {
    return json({
      error: "something wrong",
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
        <button type="submit">upload to cloudinary</button>
      </Form>
      {data?.errorMsg && <h2>{data.errorMsg}</h2>}
      {data?.imgSrc && (
        <>
          <h2>uploaded image</h2>
          <img src={data.imgSrc} alt={data.imgDesc || "Upload result"} />
        </>
      )}
    </>
  );
}
