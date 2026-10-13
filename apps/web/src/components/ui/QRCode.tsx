import { QRCodeSVG } from 'qrcode.react';

/** Rendered locally — never sent to a third-party QR service. */
export function QRCode({ value, size = 160, className = '' }: { value: string; size?: number; className?: string }) {
  return (
    <div className={`inline-flex items-center justify-center rounded-2xl bg-white p-3 ${className}`}>
      <QRCodeSVG value={value} size={size} level="M" bgColor="#ffffff" fgColor="#0E0B16" marginSize={0} />
    </div>
  );
}
