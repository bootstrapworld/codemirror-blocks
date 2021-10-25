import { useContext } from "react";
import { LanguageContext } from "./components/Context";

export function useLanguageOrThrow() {
  const language = useContext(LanguageContext);
  if (!language) {
    throw new Error("Must render inside a language context");
  }
  return language;
}
