"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type { EditorShell as EditorShellType } from "./EditorShell";

const EditorShellDynamic = dynamic(
  () => import("./EditorShell").then((m) => m.EditorShell),
  { ssr: false }
);

export function EditorShellClient(props: ComponentProps<typeof EditorShellType>) {
  return <EditorShellDynamic {...props} />;
}
