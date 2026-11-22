"use client";
import { useEffect } from "react";
import { track, type TrackProps } from "@/lib/analytics";

/** Dispara um evento quando a página abre (ex.: page_not_found na página 404). */
export default function TrackOnMount({ name, props = {} }: { name: string; props?: TrackProps }) {
  useEffect(() => {
    track(name, { path: location.pathname, ...props });
    // Uma vez por página aberta.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name]);
  return null;
}
