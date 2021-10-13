import { useContext } from "react";
import { LanguageContext, SearchContext } from "./components/Context";

export function useLanguageOrThrow() {
  const language = useContext(LanguageContext);
  if (!language) {
    throw new Error("Must render inside a language context");
  }
  return language;
}

export function useSearchOrThrow() {
  const search = useContext(SearchContext);
  if (!search) {
    throw new Error("Must render inside a search context");
  }
  return search;
}
