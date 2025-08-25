// src/components/ConfirmButton.tsx
"use client";

type Props = {
  children: React.ReactNode;
  className?: string;
  message?: string;
};

export default function ConfirmButton({ children, className, message = "Delete this? This cannot be undone." }: Props) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(e) => {
        if (!confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
