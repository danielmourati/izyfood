import * as React from "react";

const MOBILE_BREAKPOINT = 768;

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.innerWidth < MOBILE_BREAKPOINT;
  });

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const checkMobile = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
    };

    mql.addEventListener("change", checkMobile);
    window.addEventListener("resize", checkMobile);
    checkMobile();

    return () => {
      mql.removeEventListener("change", checkMobile);
      window.removeEventListener("resize", checkMobile);
    };
  }, []);

  return isMobile;
}

export function useMobileOrientation() {
  const [isPortrait, setIsPortrait] = React.useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return window.innerHeight >= window.innerWidth;
  });

  React.useEffect(() => {
    const checkOrientation = () => {
      setIsPortrait(window.innerHeight >= window.innerWidth);
    };
    window.addEventListener("resize", checkOrientation);
    window.addEventListener("orientationchange", checkOrientation);
    return () => {
      window.removeEventListener("resize", checkOrientation);
      window.removeEventListener("orientationchange", checkOrientation);
    };
  }, []);

  return { isPortrait };
}
