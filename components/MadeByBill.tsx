'use client';

export default function MadeByBill() {
  return (
    <div className="fixed top-4 right-4 z-50">
      <a
        href="https://cebillhsu.xyz"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-block bg-white/90 backdrop-blur-sm rounded-full px-3 py-1.5 shadow-lg border border-gray-200 hover:bg-white hover:shadow-xl transition-all duration-200 text-xs font-medium text-gray-600 hover:text-blue-600"
      >
        made by Bill
      </a>
    </div>
  );
}