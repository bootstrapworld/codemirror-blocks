import { expect, test } from "@playwright/test";

/**
 * What a person sees while dragging a block, as in the old editor: a picture of
 * the block that follows the pointer, a gap that the pointer is over turns
 * lightblue (with or without a drag), and a value that a drop would replace
 * turns red.
 */
for (const lang of ["scheme", "javascript", "python"]) {
  test(`a dragged block has a picture that follows the pointer: ${lang}`, async ({
    page,
  }) => {
    await page.goto(`/index.html?lang=${lang}`);
    await page.waitForFunction(
      () => (window as unknown as { demo?: unknown }).demo
    );
    const block = page
      .locator('.cm-content [role="treeitem"]:has(> .blocks-args)')
      .nth(1);
    const box = (await block.boundingBox())!;
    await page.mouse.move(box.x + 6, box.y + 6);
    await page.mouse.down();
    await page.mouse.move(box.x + 40, box.y + 30, { steps: 5 });
    const preview = page.locator(".blocks-drag-preview");
    await expect(preview).toHaveCount(1);
    expect(await preview.getAttribute("aria-hidden")).toBe("true");
    // (a picture, not a second block: no ids, and it takes no pointer events)
    expect(await preview.locator("[id]").count()).toBe(0);
    expect(
      await preview.evaluate((e) => getComputedStyle(e).pointerEvents)
    ).toBe("none");
    const a = (await preview.boundingBox())!;
    await page.mouse.move(box.x + 140, box.y + 90, { steps: 5 });
    const b = (await preview.boundingBox())!;
    expect(b.x).toBeGreaterThan(a.x + 50);
    if (lang === "scheme")
      await page.screenshot({ path: "e2e/screens/drag-ghost-scheme.png" });
    await page.mouse.up();
    await expect(preview).toHaveCount(0);
  });
}

test("a gap is lightblue under the pointer, and a value that a drop replaces is red (scheme)", async ({
  page,
}) => {
  await page.goto("/index.html?lang=scheme");
  await page.waitForFunction(
    () => (window as unknown as { demo?: unknown }).demo
  );
  const colour = (sel: string) =>
    page.evaluate(
      (s) => getComputedStyle(document.querySelector(s)!).backgroundColor,
      sel
    );
  // hovering a gap, no drag
  const gap = page.locator(".cm-content .blocks-gap").nth(6);
  const g = (await gap.boundingBox())!;
  await page.mouse.move(g.x + g.width / 2, g.y + g.height / 2);
  await page.waitForTimeout(200);
  expect(await gap.evaluate((e) => getComputedStyle(e).backgroundColor)).toBe(
    "rgb(173, 216, 230)"
  );
  // dragging a block over a value that the drop would replace
  const block = page
    .locator('.cm-content [role="treeitem"]:has(> .blocks-args)')
    .nth(1);
  const bb = (await block.boundingBox())!;
  await page.mouse.move(bb.x + 6, bb.y + 6);
  await page.mouse.down();
  await page.mouse.move(bb.x + 40, bb.y + 30, { steps: 5 });
  // (a value on screen that is not part of the dragged block)
  const at = await page.evaluate(() => {
    for (const el of document.querySelectorAll(".cm-content .blocks-value")) {
      if (el.closest(".blocks-drag-source")) continue;
      const r = el.getBoundingClientRect();
      // (not near the top or bottom edge of its top-level block: those take a drop as an insertion)
      let root: Element = el;
      while (root.parentElement?.closest('[role="treeitem"]'))
        root = root.parentElement.closest('[role="treeitem"]')!;
      const rr = root.getBoundingClientRect();
      const y = r.top + r.height / 2;
      if (
        r.top > 160 &&
        r.bottom < 700 &&
        r.width > 4 &&
        y > rr.top + rr.height * 0.4 &&
        y < rr.bottom - rr.height * 0.4
      )
        return { x: r.left + r.width / 2, y };
    }
    return null;
  });
  expect(at).not.toBeNull();
  await page.mouse.move(at!.x, at!.y, { steps: 8 });
  await page.waitForTimeout(150);
  expect(await colour(".blocks-drop-target.blocks-drop-replace")).toBe(
    "rgb(255, 0, 0)"
  );
  await page.mouse.up();
});
