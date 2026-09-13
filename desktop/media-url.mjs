export function jobIdFromUrl(url) {
  try {
    const parsed = typeof url === "string" ? new URL(url, "http://127.0.0.1") : url;
    const parts = (parsed.pathname || "").split("/").filter(Boolean);
    let raw = "";
    if (parsed.hostname === "v") raw = parts[0] || "";
    else if (parts[0] === "v") raw = parts[1] || "";
    else raw = parts[0] || "";
    return String(raw).replace(/\.(mp4|m4v|ts)$/i, "");
  } catch {
    return "";
  }
}
