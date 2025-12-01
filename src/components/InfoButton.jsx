import { useState, useRef, useEffect } from "react";

export default function InfoButton({ children, title = null, size = "normal" }) {
  const [isOpen, setIsOpen] = useState(false);
  const popupRef = useRef(null);
  const buttonRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(e) {
      if (
        popupRef.current &&
        !popupRef.current.contains(e.target) &&
        buttonRef.current &&
        !buttonRef.current.contains(e.target)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    function handleEscape(e) {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    }

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen]);

  const sizeClass = size === "small" ? "info-button-small" : "";

  return (
    <span className="info-button-wrapper">
      <button
        ref={buttonRef}
        className={`info-button ${sizeClass}`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        type="button"
        aria-label="More information"
      >
        <span role="img" aria-hidden="true">&#x2753;</span>
      </button>

      {isOpen && (
        <>
          <div className="info-popup-backdrop" onClick={() => setIsOpen(false)} />
          <div ref={popupRef} className="info-popup">
            {title && <div className="info-popup-title">{title}</div>}
            <div className="info-popup-content">{children}</div>
            <button
              className="info-popup-close"
              onClick={() => setIsOpen(false)}
              type="button"
            >
              Got it
            </button>
          </div>
        </>
      )}
    </span>
  );
}