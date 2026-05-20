import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { FeatureTransition } from "../_components/feature-transition";
import { FEATURES, getFeatureBySlug } from "../_data/features";

type RouteParams = { slug: string };

export function generateStaticParams(): RouteParams[] {
  return FEATURES.map((feature) => ({ slug: feature.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>;
}): Promise<Metadata> {
  const { slug } = await params;
  const feature = getFeatureBySlug(slug);
  if (!feature) {
    return { title: "Feature not found — Fluxora" };
  }
  return {
    title: `${feature.title} — see it on Fluxora`,
    description: feature.body,
  };
}

export default async function FeatureTransitionPage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { slug } = await params;
  const feature = getFeatureBySlug(slug);
  if (!feature) notFound();

  // Surface the previous/next slug in the registry order so visitors can flip
  // through every feature like a deck — no jumping back to the index between
  // cards. Edges wrap around so the reel loops.
  const total = FEATURES.length;
  const position = FEATURES.findIndex((f) => f.slug === feature.slug);
  const prevSlug = FEATURES[(position - 1 + total) % total]?.slug;
  const nextSlug = FEATURES[(position + 1) % total]?.slug;

  return (
    <FeatureTransition
      feature={feature}
      total={total}
      prevSlug={prevSlug}
      nextSlug={nextSlug}
    />
  );
}
