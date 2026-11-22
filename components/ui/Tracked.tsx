"use client";
// Links que avisam o analytics ao clicar (para usar dentro de componentes de servidor).
import Link from "next/link";
import { track, type TrackProps } from "@/lib/analytics";

type Ev = { event: string; props?: TrackProps };

export function TrackedLink({ event, props, onClick, ...rest }: Ev & React.ComponentProps<typeof Link>) {
  return <Link {...rest} onClick={(e) => { track(event, props); onClick?.(e); }} />;
}

export function TrackedA({ event, props, onClick, ...rest }: Ev & React.ComponentProps<"a">) {
  return <a {...rest} onClick={(e) => { track(event, props); onClick?.(e); }} />;
}
