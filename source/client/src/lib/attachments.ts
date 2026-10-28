import type { Attachment } from "./models";

/** Remove legacy Firebase download URLs, which act as bearer tokens, from newly saved metadata. */
export function stripDownloadUrlToken(attachment: Attachment): Attachment {
  const safeAttachment = { ...attachment };
  delete safeAttachment.downloadUrl;
  return safeAttachment;
}
