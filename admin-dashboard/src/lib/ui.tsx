// Small set of branded form/UI primitives used across admin pages.

import { useEffect } from "react";
import { X } from "lucide-react";
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  Ref,
  TextareaHTMLAttributes,
} from "react";

type FieldProps = {
  label: string;
  hint?: string;
  required?: boolean;
  children: ReactNode;
};

export function Field({ label, hint, required, children }: FieldProps) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-neutral-700">
        {label} {required && <span className="text-primary">*</span>}
      </span>
      {children}
      {hint && (
        <span className="mt-1 block text-xs text-neutral-500">{hint}</span>
      )}
    </label>
  );
}

export function Input(
  props: InputHTMLAttributes<HTMLInputElement> & {
    ref?: Ref<HTMLInputElement>;
  }
) {
  const { className = "", ref, ...rest } = props;
  return (
    <input
      ref={ref}
      {...rest}
      className={`w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 placeholder:text-neutral-400 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 ${className}`}
    />
  );
}

export function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const { className = "", ...rest } = props;
  return (
    <textarea
      {...rest}
      className={`w-full rounded-lg border border-neutral-300 bg-white px-3 py-2 text-sm leading-relaxed text-neutral-900 placeholder:text-neutral-400 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 ${className}`}
    />
  );
}

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-white hover:bg-primary/90 disabled:opacity-60",
  secondary:
    "bg-saffron/15 text-primary hover:bg-saffron/25 disabled:opacity-60",
  danger:
    "bg-red-600 text-white hover:bg-red-700 disabled:opacity-60",
  ghost:
    "bg-transparent text-neutral-700 hover:bg-neutral-100 disabled:opacity-60",
};

export function Button({
  variant = "primary",
  className = "",
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      {...rest}
      className={`inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed ${VARIANTS[variant]} ${className}`}
    />
  );
}

export function Card({
  title,
  description,
  actions,
  children,
}: {
  title?: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-saffron/30 bg-white p-4 shadow-sm sm:p-6">
      {(title || actions) && (
        <header className="mb-4 flex flex-wrap items-start justify-between gap-3 sm:gap-4">
          <div className="min-w-0 flex-1">
            {title && (
              <h2 className="text-base font-semibold text-primary sm:text-lg">
                {title}
              </h2>
            )}
            {description && (
              <p className="mt-0.5 text-sm text-neutral-600">{description}</p>
            )}
          </div>
          {actions && (
            <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>
          )}
        </header>
      )}
      {children}
    </section>
  );
}

export function Banner({
  kind,
  children,
}: {
  kind: "error" | "success" | "info";
  children: ReactNode;
}) {
  const styles =
    kind === "error"
      ? "border-red-200 bg-red-50 text-red-700"
      : kind === "success"
      ? "border-green-200 bg-green-50 text-green-700"
      : "border-saffron/40 bg-saffron/10 text-primary";
  return (
    <div
      className={`rounded-lg border px-3 py-2 text-sm ${styles}`}
      role="status"
    >
      {children}
    </div>
  );
}

export function EmptyState({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <div className="rounded-xl border border-dashed border-neutral-300 bg-cream px-6 py-10 text-center">
      <p className="text-sm font-medium text-neutral-700">{title}</p>
      {description && (
        <p className="mt-1 text-xs text-neutral-500">{description}</p>
      )}
    </div>
  );
}

/**
 * Modal — centered overlay dialog with sticky header & footer.
 * Used for create/edit forms across the admin dashboard.
 *
 *   <Modal open={open} onClose={() => setOpen(false)} title="New text"
 *          footer={<Button onClick={save}>Save</Button>}>
 *     ...form fields...
 *   </Modal>
 */
export function Modal({
  open,
  onClose,
  title,
  description,
  footer,
  children,
  maxWidth = "max-w-2xl",
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  footer?: ReactNode;
  children: ReactNode;
  maxWidth?: string;
}) {
  // Lock background scroll while open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Esc to close
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto bg-black/50 px-0 py-0 backdrop-blur-sm sm:items-center sm:px-4 sm:py-8"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal
      aria-labelledby="modal-title"
    >
      <div
        className={`relative flex max-h-[95vh] w-full ${maxWidth} flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl ring-1 ring-black/5 sm:rounded-2xl`}
      >
        {/* Header — accent bar + title */}
        <div className="relative border-b border-saffron/30 bg-gradient-to-br from-cream via-white to-saffron/10 px-4 py-4 sm:px-6 sm:py-5">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-primary via-saffron to-primary" />
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2
                id="modal-title"
                className="text-base font-semibold text-primary sm:text-lg"
              >
                {title}
              </h2>
              {description && (
                <p className="mt-0.5 text-sm text-neutral-600">{description}</p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="shrink-0 rounded-full p-2 text-neutral-500 transition hover:bg-white hover:text-primary"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body — scrolls */}
        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-neutral-100 bg-neutral-50/60 px-4 py-3 sm:px-6 sm:py-4">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
