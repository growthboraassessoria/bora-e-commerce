import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { POLICIES, POLICY_UPDATED } from "@/lib/policies";
import JsonLd from "@/components/seo/JsonLd";
import { breadcrumbLd, pageMeta } from "@/lib/seo";

export function generateStaticParams() {
  return POLICIES.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata({ params }: PageProps<"/politicas/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const p = POLICIES.find((x) => x.slug === slug);
  return p ? pageMeta({ title: p.title, description: p.summary, path: `/politicas/${p.slug}` }) : { title: "Política não encontrada", robots: { index: false, follow: false } };
}

export default async function PolicyPage({ params }: PageProps<"/politicas/[slug]">) {
  const { slug } = await params;
  const policy = POLICIES.find((p) => p.slug === slug);
  if (!policy) notFound();
  return (
    <div className="wrap pt-10 grid grid-cols-1 [&>*]:min-w-0 lg:grid-cols-[280px_1fr] gap-10 lg:gap-20">
      <JsonLd data={breadcrumbLd([{ name: "Início", path: "/" }, { name: "Políticas", path: "/politicas" }, { name: policy.title, path: `/politicas/${policy.slug}` }])} />
      <aside className="lg:sticky lg:top-[calc(var(--header-h)+24px)] self-start">
        <p className="eyebrow">Políticas</p>
        <nav aria-label="Políticas da loja" className="mt-4 flex lg:flex-col gap-1 overflow-x-auto no-scrollbar -mx-[var(--gutter)] px-[var(--gutter)] lg:mx-0 lg:px-0">
          {POLICIES.map((p) => (
            <Link key={p.slug} href={`/politicas/${p.slug}`} className={`shrink-0 px-4 py-2.5 rounded-full lg:rounded-xl text-sm font-bold ${p.slug === slug ? "bg-ink text-white" : "hover:bg-sand"}`}>{p.title}</Link>
          ))}
        </nav>
      </aside>
      <article className="max-w-2xl">
        <h1 className="display text-[clamp(40px,5.6vw,76px)]">{policy.title}</h1>
        <p className="mt-4 text-xl text-ink-2">{policy.summary}</p>
        <p className="mt-2 text-sm text-ink-3">Atualizado em {POLICY_UPDATED}</p>
        <div className="prose-bora mt-8">{policy.body}</div>
      </article>
    </div>
  );
}
