import { ImageResponse } from "next/og";

import { brandIconElement } from "@/lib/brand-icon";

export async function GET(_request: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size: sizeParam } = await params;
  const size = Number(sizeParam) === 512 ? 512 : 192;
  return new ImageResponse(brandIconElement(size), { width: size, height: size });
}
