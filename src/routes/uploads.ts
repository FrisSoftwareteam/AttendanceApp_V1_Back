import { Router } from "express";
import { cloudinary, isCloudinaryReady } from "../config/cloudinary";
import { requireAuth } from "../middleware/auth";

const router = Router();

router.post("/photo", requireAuth, async (req, res) => {
  try {
    const { dataUrl } = req.body ?? {};

    if (!dataUrl || typeof dataUrl !== "string") {
      res.status(400).json({ error: "Missing dataUrl" });
      return;
    }

    if (!dataUrl.startsWith("data:image/")) {
      res.status(400).json({ error: "Invalid image format" });
      return;
    }

    if (!isCloudinaryReady()) {
      res.status(503).json({ error: "Cloudinary not configured" });
      return;
    }

    const folder = process.env.CLOUDINARY_FOLDER || "attendance-app";
    const upload = await cloudinary.uploader.upload(dataUrl, {
      folder,
      resource_type: "image",
      overwrite: false
    });

    res.status(201).json({
      url: upload.secure_url,
      publicId: upload.public_id,
      width: upload.width,
      height: upload.height
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Upload failed" });
  }
});

export default router;
