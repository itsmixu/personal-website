import { useEffect } from 'react';

export const SECTION_CHANGE_EVENT = 'sectionchange';

const SCROLL_LOCK_MS = 900;
const WHEEL_TRIGGER = 80;
const TOUCH_TRIGGER = 70;
const WHEEL_RESET_MS = 220;

const SectionObserver = () => {
  useEffect(() => {
    const sections = Array.from(
      document.querySelectorAll<HTMLElement>('[data-section-id]')
    );

    if (!sections.length) {
      return;
    }

    let activeIndex = 0;
    let isAnimating = false;
    let wheelDelta = 0;
    let wheelResetTimer: number | null = null;
    let releaseTimer: number | null = null;
    let touchStartY: number | null = null;
    let activeSide: 'left' | 'right' = 'left';

    const resetWheel = () => {
      if (wheelResetTimer !== null) {
        window.clearTimeout(wheelResetTimer);
        wheelResetTimer = null;
      }
      wheelDelta = 0;
    };

    const unlockScroll = () => {
      if (releaseTimer !== null) {
        window.clearTimeout(releaseTimer);
        releaseTimer = null;
      }
      isAnimating = false;
    };

    const scheduleWheelReset = () => {
      if (wheelResetTimer !== null) {
        window.clearTimeout(wheelResetTimer);
      }
      wheelResetTimer = window.setTimeout(() => {
        wheelDelta = 0;
        wheelResetTimer = null;
      }, WHEEL_RESET_MS);
    };

    const scrollToIndex = (index: number) => {
      if (index < 0 || index >= sections.length) return;
      resetWheel();
      isAnimating = true;
      sections[index].scrollIntoView({ behavior: 'smooth', block: 'start' });
      if (releaseTimer !== null) {
        window.clearTimeout(releaseTimer);
      }
      releaseTimer = window.setTimeout(() => {
        unlockScroll();
      }, SCROLL_LOCK_MS);
    };

    const setActive = (element: HTMLElement) => {
      const id = element.dataset.sectionId;
      if (!id) return;

      sections.forEach((section, idx) => {
        const isCurrent = section === element;
        section.classList.toggle('is-active', isCurrent);
        if (isCurrent) {
          activeIndex = idx;
          const sectionSide = section.dataset.sectionSide;
          activeSide = sectionSide === 'right' ? 'right' : 'left';
        }
      });

      window.dispatchEvent(
        new CustomEvent<{ id: string; side: 'left' | 'right' }>(SECTION_CHANGE_EVENT, {
          detail: { id, side: activeSide }
        })
      );
    };

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];

        if (visible && visible.target instanceof HTMLElement) {
          setActive(visible.target);
        }
      },
      {
        root: null,
        threshold: [0.5, 0.75, 0.9]
      }
    );

    sections.forEach((section) => observer.observe(section));

    const handleWheel = (event: WheelEvent) => {
      if (isAnimating) {
        event.preventDefault();
        return;
      }

      wheelDelta += event.deltaY;
      scheduleWheelReset();

      if (Math.abs(wheelDelta) < WHEEL_TRIGGER) {
        return;
      }

      event.preventDefault();

      const direction = wheelDelta > 0 ? 1 : -1;
      const targetIndex = activeIndex + direction;

      if (targetIndex >= 0 && targetIndex < sections.length) {
        scrollToIndex(targetIndex);
      }

      resetWheel();
    };

    const handleTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) return;
      touchStartY = event.touches[0].clientY;
      resetWheel();
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (touchStartY === null || isAnimating) return;

      const currentY = event.touches[0].clientY;
      const delta = touchStartY - currentY;

      if (Math.abs(delta) < TOUCH_TRIGGER) {
        return;
      }

      event.preventDefault();

      const direction = delta > 0 ? 1 : -1;
      const targetIndex = activeIndex + direction;

      if (targetIndex >= 0 && targetIndex < sections.length) {
        scrollToIndex(targetIndex);
      }

      touchStartY = null;
    };

    const handleTouchEnd = () => {
      touchStartY = null;
    };

    window.addEventListener('wheel', handleWheel, { passive: false });
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);
    window.addEventListener('touchcancel', handleTouchEnd);

    // Activate the first section by default to sync background on load.
    const rafId = requestAnimationFrame(() => {
      setActive(sections[0]);
    });

    return () => {
      observer.disconnect();
      cancelAnimationFrame(rafId);
      window.removeEventListener('wheel', handleWheel);
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
      window.removeEventListener('touchcancel', handleTouchEnd);
      resetWheel();
      if (releaseTimer !== null) {
        window.clearTimeout(releaseTimer);
      }
    };
  }, []);

  return null;
};

export default SectionObserver;


