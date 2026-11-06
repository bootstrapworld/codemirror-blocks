import React from "react";

/**
 * The small icons of the toolbar, drawn as inline SVG so that no icon font (and
 * no network, or bundler, to load it from) is needed. They take the color of
 * the text around them, and are hidden from assistive technology: whatever
 * holds one carries the label.
 */
const Icon = ({ path }: { path: string }) => (
  <svg
    className="icon"
    viewBox="0 0 16 16"
    aria-hidden="true"
    focusable="false"
  >
    <path d={path} />
  </svg>
);

export const PlusIcon = () => <Icon path="M8 2v12M2 8h12" />;
export const MinusIcon = () => <Icon path="M2 8h12" />;
export const RemoveIcon = () => <Icon path="M3 3l10 10M13 3L3 13" />;
