"use client";

import Image from "next/image";
import { useState } from "react";

/** Rendered over the site's default avatar; hide it if the CDN link expires. */
export function WechatAvatarImage({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  return failed ? null : (
    <Image src={src} alt="" fill unoptimized referrerPolicy="no-referrer" className="object-cover" onError={() => setFailed(true)} />
  );
}
