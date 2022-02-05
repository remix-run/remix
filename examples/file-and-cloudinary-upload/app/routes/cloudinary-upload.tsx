import {
  Form,
  unstable_createFileUploadHandler,
  unstable_parseMultipartFormData,
  useActionData,
  json
} from "remix";
import type { ActionFunction } from "remix";
import { cloudinary } from "~/utils/utils.server";

type ActionData = {
  errorMsg?: string;
  imgSrc?: string;
};

export const action: ActionFunction = async ({ request }) => {
  const uploadHandler = unstable_createFileUploadHandler({
    maxFileSize: 30000
  });
  const formData = await unstable_parseMultipartFormData(
    request,
    uploadHandler
  );
  const image = formData.get("img");
  if (!image) {
    return json({
      error: "something wrong"
    });
  }
  const uploadedImage = await cloudinary.v2.uploader.upload(image.filepath, {
    folder: "/my-site/avatars"
  });
  return json({
    imgSrc: uploadedImage.secure_url
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
