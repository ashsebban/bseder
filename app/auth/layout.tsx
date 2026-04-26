import { PageShell } from "@/components/ui/page-shell";
import { StarOfDavid } from "@/components/ui/star-of-david";
import { siteConfig } from "@/config/site";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <PageShell>
      <div className="flex min-h-screen flex-col items-center justify-center px-4 py-12">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-2">
          <StarOfDavid className="h-10 w-10 text-brand" />
          <span className="text-2xl font-bold tracking-tight text-text">{siteConfig.name}</span>
        </div>

        {/* Auth card */}
        <div className="w-full max-w-sm">
          {children}
        </div>
      </div>
    </PageShell>
  );
}
