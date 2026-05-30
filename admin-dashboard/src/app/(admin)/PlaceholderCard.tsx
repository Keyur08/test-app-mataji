import type { ReactNode } from "react";

type Props = {
  icon: ReactNode;
  title: string;
  description: string;
};

export function PlaceholderCard({ icon, title, description }: Props) {
  return (
    <div className="rounded-2xl border border-saffron/30 bg-white p-8 shadow-sm">
      <div className="mb-4 flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-white">
          {icon}
        </span>
        <h1 className="text-2xl font-semibold text-primary">{title}</h1>
      </div>
      <p className="max-w-2xl text-sm leading-relaxed text-neutral-600">
        {description}
      </p>
      <div className="mt-6 inline-flex items-center rounded-full bg-saffron/15 px-3 py-1 text-xs font-medium text-saffron">
        Coming soon
      </div>
    </div>
  );
}
