import "@testing-library/jest-dom";

export {};

window.focus = () => {};

// See https://github.com/jsdom/jsdom/issues/3002 for why this is necessary
document.createRange = () => {
  const range = new Range();

  range.getBoundingClientRect = jest.fn();

  range.getClientRects = () => {
    return {
      item: () => null,
      length: 0,
      [Symbol.iterator]: jest.fn(),
    };
  };

  return range;
};

class MockDataTransfer implements DataTransfer {
  dropEffect: "none" | "copy" | "link" | "move";
  effectAllowed:
    | "none"
    | "copy"
    | "link"
    | "move"
    | "copyLink"
    | "copyMove"
    | "linkMove"
    | "all"
    | "uninitialized";
  files: FileList;
  items: DataTransferItemList;
  types: readonly string[];
  clearData(_format?: string): void {
    throw new Error("Method not implemented.");
  }
  private data: string;
  getData(_format: string): string {
    return this.data;
  }
  setData(format: string, data: string): void {
    this.data = data;
  }
  setDragImage(_image: Element, _x: number, _y: number): void {
    throw new Error("Method not implemented.");
  }
}

window.DataTransfer = MockDataTransfer as typeof window.DataTransfer;

window.HTMLMediaElement.prototype.play = jest.fn();
window.HTMLMediaElement.prototype.pause = jest.fn();
