import { useContext } from "react";
import { LanguageContext } from "./components/Context";
import { AppContext } from "./ui/ToggleEditor";

export function useLanguageOrThrow() {
  const language = useContext(LanguageContext);
  if (!language) {
    throw new Error("Must render inside a language context");
  }
  return language;
}

export function useSearchOrThrow() {
  const { search } = useContext(AppContext);
  if (!search) {
    throw new Error("Must render inside a search context");
  }
  return search;
}
