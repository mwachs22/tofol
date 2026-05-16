import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    resolveAlias: {
      // y-prosemirror's createDecorations has no null guard on ystate.doc,
      // causing crashes when the cursor plugin initialises before the sync
      // plugin state is set. @tiptap/y-tiptap is a drop-in fork with the fix.
      "y-prosemirror": "@tiptap/y-tiptap",
    },
  },
};

export default nextConfig;
