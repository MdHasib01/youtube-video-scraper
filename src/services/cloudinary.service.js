import cloudinary from "cloudinary";

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
