import type { ReactNode } from "react";

export interface AuthShellProps {
  title: string;
  description: string;
  children: ReactNode;
}

export function AuthShell({ title, description, children }: AuthShellProps) {
  return (
    <main lang="nb" className="flex min-h-dvh items-center justify-center bg-stone-100 px-4 py-8 text-slate-900 sm:px-6 sm:py-12">
      <div className="w-full max-w-[440px] min-w-0">
        <div className="mb-5 flex items-center justify-center gap-2.5 text-lg font-semibold text-[#771816]">
          <span aria-hidden="true" className="h-5 w-1 rounded-sm bg-[#d4ad46]" />
          RoutineFlow
        </div>
        <section aria-label={title} className="overflow-hidden rounded-lg border border-stone-200 bg-white shadow-sm">
          <div aria-hidden="true" className="h-1 bg-[#771816]" />
          <div className="p-5 sm:p-8">
            <header className="mb-6">
              <h1 className="break-words text-2xl font-semibold leading-tight">{title}</h1>
              <p className="mt-2 text-sm leading-relaxed text-slate-600">{description}</p>
            </header>
            {children}
          </div>
        </section>
      </div>
    </main>
  );
}

export default AuthShell;
