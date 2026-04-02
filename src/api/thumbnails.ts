import { getBearerToken, validateJWT } from "../auth";
import { respondWithJSON } from "./json";
import { getVideo, updateVideo } from "../db/videos";
import type { ApiConfig } from "../config";
import type { BunRequest } from "bun";
import { BadRequestError, NotFoundError, UserForbiddenError } from "./errors";
import { getInMemoryURL } from "./assets";
import path from "path";

type Thumbnail = {
  data: ArrayBuffer;
  mediaType: string;
};

export async function handlerUploadThumbnail(cfg: ApiConfig, req: BunRequest) {
  const { videoId } = req.params as { videoId?: string };
  if (!videoId) {
    throw new BadRequestError("Invalid video ID");
  }

  const token = getBearerToken(req.headers);
  const userID = validateJWT(token, cfg.jwtSecret);

  console.log("uploading thumbnail for video", videoId, "by user", userID);

  const formData = await req.formData();
  const imageData = formData.get("thumbnail");
  if (!imageData || !(imageData instanceof File)) {
    throw new BadRequestError("Invalid thumbnail file");
  }

  const MAX_UPLOAD_SIZE = 10 << 20;
  if (imageData.size > MAX_UPLOAD_SIZE) {
    throw new BadRequestError("Thumbnail file is too large");
  }

  const mediaType = imageData.type.split("/")[1];
  const data = await imageData.arrayBuffer();
  const fileName = `${videoId}.${mediaType}`;
  const video = getVideo(cfg.db, videoId);

  if (!video) {
    throw new NotFoundError("Video not found");
  }
  if (video.userID !== userID) {
    throw new UserForbiddenError("Forbidden Thumbnail Upload");
  }

  const assetDiskPath = (cfg: ApiConfig, assetPath: string) => {
    return path.join(cfg.assetsRoot, assetPath);
  }

  const assetURL = (cfg: ApiConfig, assetPath: string) => {
    return `http://localhost:${cfg.port}/assets/${assetPath}`;
  }

  const fileDiskPath = assetDiskPath(cfg, fileName);
  const fileURL = assetURL(cfg, fileName);

  await Bun.write(fileDiskPath, data);

  updateVideo(cfg.db, { ...video, thumbnailURL: fileURL });
  return respondWithJSON(200, video);
}
