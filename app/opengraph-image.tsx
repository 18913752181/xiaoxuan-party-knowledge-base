import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "小宣资料库：工作资料，一站找齐";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          alignItems: "center",
          background: "linear-gradient(135deg, #fffefa 0%, #f0e4de 100%)",
          color: "#30312f",
          display: "flex",
          height: "100%",
          justifyContent: "center",
          padding: "72px",
          width: "100%"
        }}
      >
        <div style={{ alignItems: "flex-start", display: "flex", flexDirection: "column", width: "100%" }}>
          <div style={{ alignItems: "center", display: "flex", gap: "20px" }}>
            <div style={{ alignItems: "center", background: "#9a4650", borderRadius: "24px", color: "white", display: "flex", fontSize: "46px", fontWeight: 700, height: "92px", justifyContent: "center", width: "92px" }}>宣</div>
            <div style={{ display: "flex", fontSize: "34px", fontWeight: 650 }}>小宣资料库</div>
          </div>
          <div style={{ display: "flex", fontSize: "72px", fontWeight: 700, letterSpacing: "-3px", marginTop: "78px" }}>工作资料，一站找齐</div>
          <div style={{ color: "#6f706c", display: "flex", fontSize: "30px", marginTop: "28px" }}>工作模板、制度文件与填写说明，按专题快速查找</div>
        </div>
      </div>
    ),
    size
  );
}
