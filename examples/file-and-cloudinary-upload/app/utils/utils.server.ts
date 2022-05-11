import { PassThrough } from "node:stream";
import cloudinary from "cloudinary";

cloudinary.v2.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET,
});

async function uploadImage(data: AsyncIterable<Uint8Array>) {
  const dataStream = new PassThrough();
  const uploadPromise = new Promise((resolve, reject) => {
    const uploadStream = cloudinary.v2.uploader.upload_stream(
      {
        folder: "remix",
      },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(result);
      }
    );
    dataStream.pipe(uploadStream);
  });

  let errored = false;
  try {
    for await (let chunk of data) {
      dataStream.write(chunk);
    }
  } catch (error: any) {
    errored = true;
    dataStream.destroy(error);
  }
  if (!errored) {
    dataStream.end();
  }

  return uploadPromise;
}

console.log("configs", cloudinary.v2.config());
export { uploadImage };
