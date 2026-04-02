import { getBearerToken, validateJWT } from "../auth";
import { respondWithJSON } from "./json";
import { getVideo, updateVideo } from "../db/videos";
import type { ApiConfig } from "../config";
import type { BunRequest } from "bun";
import { BadRequestError, NotFoundError, UserForbiddenError } from "./errors";
import { getInMemoryURL } from "./assets";

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

  const mediaType = imageData.type;
  const data = await imageData.arrayBuffer();
  const encodedData = Buffer.from(data).toString("base64");
  const dataURL = `data:${mediaType};base64,${encodedData}`;
  const video = getVideo(cfg.db, videoId);
  if (!video) {
    throw new NotFoundError("Video not found");
  }
  if (video.userID !== userID) {
    throw new UserForbiddenError("Forbidden Thumbnail Upload");
  }

  video.thumbnailURL = dataURL;

  updateVideo(cfg.db, video);
  return respondWithJSON(200, video);
}
