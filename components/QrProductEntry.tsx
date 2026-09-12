"use client";

import Image from "next/image";
import { useEffect, useId, useState } from "react";

type QrProductEntryProps = {
  label: string;
  title: string;
  description: string;
  action: string;
  qrEyebrow: string;
  qrTitle: string;
  qrDescription: string;
  qrImage: string;
  qrAlt: string;
};

export function QrProductEntry({
  label,
  title,
  description,
  action,
  qrEyebrow,
  qrTitle,
  qrDescription,
  qrImage,
  qrAlt
}: QrProductEntryProps) {
  const [isOpen, setIsOpen] = useState(false);
  const titleId = useId();

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsOpen(false);
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [isOpen]);

  return (
    <>
      <button className="studio-product studio-product-button" type="button" onClick={() => setIsOpen(true)}>
        <span className="studio-product-label">{label}</span>
        <span>
          <span className="studio-h3">{title}</span>
          <p>{description}</p>
        </span>
        <span className="studio-product-action">{action}</span>
      </button>

      {isOpen ? (
        <div className="studio-qr-overlay" role="presentation" onMouseDown={() => setIsOpen(false)}>
          <section
            className="studio-qr-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button className="studio-qr-close" type="button" aria-label="关闭二维码" onClick={() => setIsOpen(false)} autoFocus>×</button>
            <span className="studio-product-label">{qrEyebrow}</span>
            <h2 id={titleId} className="studio-qr-title">{qrTitle}</h2>
            <p className="studio-qr-copy">{qrDescription}</p>
            <Image className="studio-qr-image" src={qrImage} alt={qrAlt} width={258} height={258} priority unoptimized />
            <p className="studio-qr-tip">请使用微信扫一扫</p>
          </section>
        </div>
      ) : null}
    </>
  );
}
