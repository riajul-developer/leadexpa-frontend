// Generates messages/en-XA.json: accented, ~40 % longer, bracketed strings.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const ACCENTS = {
  a: "á",
  b: "ƀ",
  c: "ç",
  d: "đ",
  e: "é",
  f: "ƒ",
  g: "ĝ",
  h: "ĥ",
  i: "í",
  j: "ĵ",
  k: "ķ",
  l: "ĺ",
  m: "ɱ",
  n: "ñ",
  o: "ó",
  p: "þ",
  q: "ǫ",
  r: "ŕ",
  s: "ş",
  t: "ţ",
  u: "ú",
  v: "ṽ",
  w: "ŵ",
  x: "ẋ",
  y: "ý",
  z: "ž",
  A: "Á",
  B: "Ɓ",
  C: "Ç",
  D: "Đ",
  E: "É",
  F: "Ƒ",
  G: "Ĝ",
  H: "Ĥ",
  I: "Í",
  J: "Ĵ",
  K: "Ķ",
  L: "Ĺ",
  M: "Ṁ",
  N: "Ñ",
  O: "Ó",
  P: "Þ",
  Q: "Ǫ",
  R: "Ŕ",
  S: "Ş",
  T: "Ţ",
  U: "Ú",
  V: "Ṽ",
  W: "Ŵ",
  X: "Ẋ",
  Y: "Ý",
  Z: "Ž",
};
const accent = (text) => [...text].map((c) => ACCENTS[c] ?? c).join("");

function pseudo(msg) {
  let i = 0;
  const literal = (stop) => {
    let out = "";
    while (i < msg.length && !stop.includes(msg[i])) {
      if (msg[i] === "{") out += argument();
      else if (msg[i] === "'" && msg[i + 1] === "'") {
        out += "''";
        i += 2;
      } else out += accent(msg[i++]);
    }
    return out;
  };
  const argument = () => {
    const start = i;
    i++;
    while (i < msg.length && msg[i] !== "," && msg[i] !== "}") i++;
    if (msg[i] === "}") {
      i++;
      return msg.slice(start, i);
    }
    i++;
    const typeStart = i;
    while (i < msg.length && msg[i] !== "," && msg[i] !== "}") i++;
    const type = msg.slice(typeStart, i).trim();
    if (msg[i] === "}" || !["plural", "select", "selectordinal"].includes(type)) {
      let depth = 1; // {n, number} etc.: copy verbatim
      while (i < msg.length && depth > 0) {
        if (msg[i] === "{") depth++;
        if (msg[i] === "}") depth--;
        i++;
      }
      return msg.slice(start, i);
    }
    let out = msg.slice(start, ++i);
    while (i < msg.length && msg[i] !== "}") {
      const keyStart = i;
      while (i < msg.length && msg[i] !== "{") i++;
      out += msg.slice(keyStart, i) + "{";
      i++;
      out += literal("}") + "}";
      i++;
    }
    i++;
    return out + "}";
  };
  const body = literal("");
  const pad = "~".repeat(Math.ceil(msg.replace(/\{[^}]*\}/g, "").length * 0.4));
  return `[${body}${pad ? " " + pad : ""}]`;
}

function walk(node) {
  if (typeof node === "string") return pseudo(node);
  return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, walk(v)]));
}

const en = JSON.parse(readFileSync(join(ROOT, "messages", "en.json"), "utf8"));
writeFileSync(join(ROOT, "messages", "en-XA.json"), JSON.stringify(walk(en), null, 2) + "\n");
console.log("messages/en-XA.json generated");
