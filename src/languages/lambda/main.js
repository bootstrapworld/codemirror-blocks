import Parser from "./code";

export default function main(code) {
  var ast = Parser.parse(Parser.TokenStream(Parser.InputStream(code)));
  return ast;
}