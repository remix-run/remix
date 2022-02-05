import dotenv from "dotenv";
import cloudinary from "cloudinary";
dotenv.config();
cloudinary.v2.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.API_KEY,
  api_secret: process.env.API_SECRET
});
console.log("configs", cloudinary.v2.config());
export { cloudinary };
