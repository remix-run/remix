import {
  Form,
  unstable_parseMultipartFormData,
  useActionData,
  json
} from "remix";
import type { ActionFunction, UploadHandler } from "remix";

import { uploadImage } from "~/utils/utils.server";

type ActionData = {
  errorMsg?: string;
  imgSrc?: string;
};

export const action: ActionFunction = async ({ request }) => {
  let uploadHandler: UploadHandler = async ({ name, stream }) => {
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
  if (!imgSrc) {
    return json({
      error: "something wrong"
    });
  }
  return json({
    imgSrc
  });
};

export default function Index() {
  const data = useActionData<ActionData>();
  return (
    <>
      <Form method="post" encType="multipart/form-data">
        <input type="file" name="img" accept="image/*" />
        <button type="submit">upload to cloudinary</button>
      </Form>
      {data?.errorMsg && <h2>{data.errorMsg}</h2>}
      {data?.imgSrc && (
        <>
          <h2>uploaded image</h2>
          <img src={data.imgSrc} />
        </>
      )}
    </>
  );
}
