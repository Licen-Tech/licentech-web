import { DOMParser, XMLSerializer } from "@xmldom/xmldom";
import type { Element as XmlElement, Node as XmlNode } from "@xmldom/xmldom";

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
const allowedElements = new Set([
  "svg", "g", "path", "rect", "circle", "ellipse", "line", "polyline", "polygon",
  "text", "tspan", "defs", "linearGradient", "radialGradient", "stop", "clipPath", "mask",
]);
const allowedAttributes = new Set([
  "xmlns", "viewBox", "width", "height", "x", "y", "x1", "x2", "y1", "y2",
  "cx", "cy", "r", "rx", "ry", "d", "points", "transform", "fill", "fill-rule",
  "fill-opacity", "stroke", "stroke-width", "stroke-linecap", "stroke-linejoin",
  "stroke-dasharray", "stroke-dashoffset", "stroke-opacity", "opacity", "id",
  "offset", "stop-color", "stop-opacity", "gradientUnits", "gradientTransform",
  "clip-path", "mask", "font-size", "font-family", "font-weight", "text-anchor",
  "dominant-baseline",
]);

export function sanitizeSvg(source: Buffer) {
  const errors: string[] = [];
  const document = new DOMParser({
    onError: (level, message) => {
      if (level !== "warning") errors.push(message);
    },
  }).parseFromString(source.toString("utf8"), "image/svg+xml");
  const root = document.documentElement;
  if (errors.length || !root || root.localName !== "svg" || root.namespaceURI !== SVG_NAMESPACE || document.doctype) {
    throw new Error("El archivo SVG no es válido.");
  }

  function clean(node: XmlNode) {
    for (let index = node.childNodes.length - 1; index >= 0; index--) {
      const child = node.childNodes.item(index);
      if (!child) continue;
      if (child.nodeType === 1) {
        const element = child as XmlElement;
        if (!element.localName || !allowedElements.has(element.localName)) {
          node.removeChild(child);
          continue;
        }
        for (let attributeIndex = element.attributes.length - 1; attributeIndex >= 0; attributeIndex--) {
          const attribute = element.attributes.item(attributeIndex);
          if (!attribute) continue;
          const localName = attribute.localName;
          const value = attribute.value.trim();
          const safeValue = !/url\s*\(/i.test(value) || /^url\(\s*#[\w.-]+\s*\)$/i.test(value);
          if (!localName || !allowedAttributes.has(localName) || !safeValue || localName === "xmlns" && value !== SVG_NAMESPACE) {
            element.removeAttributeNode(attribute);
          }
        }
        clean(element);
      } else if (child.nodeType !== 3 && child.nodeType !== 4) {
        node.removeChild(child);
      }
    }
  }

  clean(root);
  return Buffer.from(new XMLSerializer().serializeToString(root), "utf8");
}

export function isSupportedRaster(content: Buffer, mimeType: string) {
  if (mimeType === "image/jpeg") return content.length >= 3 && content[0] === 0xff && content[1] === 0xd8 && content[2] === 0xff;
  if (mimeType === "image/png") return content.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  if (mimeType === "image/webp") return content.toString("ascii", 0, 4) === "RIFF"
    && content.toString("ascii", 8, 12) === "WEBP";
  return false;
}
