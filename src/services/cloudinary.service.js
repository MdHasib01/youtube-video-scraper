import cloudinary from "cloudinary";
import dotenv from "dotenv";
dotenv.config();
import fs from "fs";

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

//Upload image to cloudinary through generated url from openai
export const uploadImageUrlToCloudinary = async (imageUrl, publicId) => {
  try {
    console.log(`Uploading image to Cloudinary: ${publicId}`);

    const result = await cloudinary.uploader.upload(imageUrl, {
      public_id: publicId,
      folder: "blog-images",
      resource_type: "image",
      transformation: [
        {
          width: 1200,
          height: 630,
          crop: "fill",
          gravity: "center",
          quality: "auto:good",
        },
      ],
    });

    console.log(`✅ Image uploaded to Cloudinary: ${result.secure_url}`);
    return {
      url: result.secure_url,
      publicId: result.public_id,
    };
  } catch (error) {
    console.error("Error uploading to Cloudinary:", error);
    return null;
  }
};

//upload image file to cloudinary
export const uploadImageFileToCloudinary = async (localFilePath) => {
  console.log(`Uploading image to Cloudinary: ${localFilePath}`);
  if (!localFilePath) {
    return res.status(400).json({ error: "No file uploaded" });
  }
  try {
    const result = await cloudinary.uploader.upload(localFilePath, {
      folder: "blog-images",
      resource_type: "image",
      transformation: [
        {
          width: 1200,
          height: 630,
          crop: "fill",
          gravity: "center",
          quality: "auto:good",
        },
      ],
    });
    console.log(`✅ Image uploaded to Cloudinary: ${result.secure_url}`);
    fs.unlinkSync(localFilePath);
    return {
      url: result.secure_url,
      publicId: result.public_id,
    };
  } catch (error) {
    console.error("Error uploading to Cloudinary:", error);
    fs.unlinkSync(localFilePath);
    return null;
  }
};

export const deleteOnCloudinary = async (
  public_id,
  resource_type = "image"
) => {
  try {
    if (!public_id) return null;

    //delete file from cloudinary
    const result = await cloudinary.uploader.destroy(public_id, {
      resource_type: `${resource_type}`,
    });
  } catch (error) {
    console.log("delete on cloudinary failed", error);
    return error;
  }
};
