export function shortAddress(address) {
  if (!address) return "";
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function decodeTokenUri(uri) {
  if (!uri?.startsWith("data:application/json;base64,")) {
    throw new Error("Unsupported tokenURI format");
  }

  const encoded = uri.replace("data:application/json;base64,", "");
  const json = JSON.parse(decodeBase64(encoded));
  return {
    ...json,
    imageSvg: imageToSvg(json.image)
  };
}

function imageToSvg(image) {
  if (!image?.startsWith("data:image/svg+xml;base64,")) return "";
  return decodeBase64(image.replace("data:image/svg+xml;base64,", ""));
}

function decodeBase64(value) {
  const binary = window.atob(value);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}
