import QRCode from "qrcode";

export async function generateQRCode(url: string): Promise<string> {
  return QRCode.toDataURL(url, {
    width: 512,
    margin: 2,
    color: {
      dark: "#000000",
      light: "#ffffff",
    },
  });
}

export function getRegistrationUrl(shopDomain: string, productId?: string): string {
  const baseUrl = process.env.APP_URL || "https://registerly.app";
  const url = `${baseUrl}/register/${shopDomain}`;
  if (productId) {
    return `${url}?product=${productId}`;
  }
  return url;
}
