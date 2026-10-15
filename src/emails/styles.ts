import type { CSSProperties } from "react";

export const colors = {
  canvas: "#F2F2F2",
  paper: "#FFFFFF",
  ink: "#111111",
  body: "#444444",
  muted: "#777777",
  line: "#D8D8D8",
  softLine: "#E6E6E6"
} as const;

export const fontSans = "-apple-system,BlinkMacSystemFont,'Segoe UI','Microsoft YaHei',Arial,sans-serif";
export const fontEditorial = "Georgia,'Songti SC','STSong','Times New Roman',serif";

export const responsiveCss = `
  body > table { width: 100% !important; max-width: 100% !important; table-layout: fixed !important; }
  @media only screen and (max-width: 480px) {
    .cy-container { width: 100% !important; max-width: 100% !important; table-layout: fixed !important; }
    .cy-content { width: 100% !important; max-width: 100% !important; table-layout: fixed !important; padding-left: 24px !important; padding-right: 24px !important; }
    .cy-title { font-size: 28px !important; line-height: 35px !important; }
    .cy-title-en { font-size: 20px !important; line-height: 27px !important; }
    .cy-detail-column { display: block !important; width: 100% !important; padding: 0 0 18px !important; }
    .cy-action { display: block !important; box-sizing: border-box !important; width: 100% !important; text-align: center !important; }
  }
`;

export const bodyStyle: CSSProperties = { margin: 0, backgroundColor: colors.canvas, color: colors.ink, fontFamily: fontSans };
export const containerStyle: CSSProperties = { margin: "0 auto", maxWidth: "640px", width: "100%", backgroundColor: colors.paper };
