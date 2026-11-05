import { useEffect, useState } from 'react';

/**
 * A bottom sheet with a typing field on a phone. When the keyboard opens, iPhones push the page up,
 * which cuts off the sheet's top. While it is open, this keeps the sheet exactly in the visible part
 * above the keyboard (its content scrolls inside). Pass the returned ref to the sheet.
 */
export function useSheetAboveKeyboard() {
  const [node, setNode] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!node || !viewport) return;

    const apply = () => {
      // A much smaller visible area = keyboard open (not when zoomed in with two fingers)
      const keyboardOpen = viewport.scale < 1.01 && window.innerHeight - viewport.height > 120;
      if (!keyboardOpen) {
        node.style.bottom = '';
        node.style.maxHeight = '';
        return;
      }
      const hiddenBelow = window.innerHeight - viewport.height - viewport.offsetTop;
      node.style.bottom = `${Math.max(0, hiddenBelow)}px`;
      node.style.maxHeight = `${viewport.height - 16}px`;
      // The sheet got smaller: keep the field being typed in on screen
      const active = document.activeElement;
      if (active instanceof HTMLElement && node.contains(active)) {
        requestAnimationFrame(() => active.scrollIntoView({ block: 'nearest' }));
      }
    };

    apply();
    viewport.addEventListener('resize', apply);
    viewport.addEventListener('scroll', apply);
    return () => {
      viewport.removeEventListener('resize', apply);
      viewport.removeEventListener('scroll', apply);
      node.style.bottom = '';
      node.style.maxHeight = '';
    };
  }, [node]);

  return setNode;
}
