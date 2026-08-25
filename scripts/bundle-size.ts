/**
 * Measures minified + gzipped bundle size for each core primitive, for the
 * react package's bindings (measured on top of core), and for the
 * comparison libraries quoted in the readme/docs feature matrix, all
 * through the same bundler/minifier so the numbers are directly comparable.
 * Run from the repo root:
 *
 *   deno task --cwd scripts bundle-size
 *
 * (`scripts/` keeps its own deno.json for its rolldown/comparison-library
 * imports, kept out of the packages' own dependency graphs, though it must
 * still be a workspace member for those npm: specifiers to resolve into
 * node_modules.) Each comparison library is measured
 * through its default, React-integrated entry point (with its React
 * bindings, if any, included but the "react" peer dependency itself
 * externalized), reflecting what a React app actually pays to use it.
 *
 * @module
 */

import { type OutputChunk, type Plugin, rolldown } from "rolldown";

const CORE_SPECIFIER = "@kintools/store-core";

function coreEntry(name: string): string {
  return new URL(`../core/${name}`, import.meta.url).pathname.slice(1);
}

const REACT_ENTRY = new URL("../react/index.ts", import.meta.url).pathname
  .slice(1);

/** Serves an in-memory entry so comparison subjects can be plain strings instead of temp files. */
function virtualEntryPlugin(id: string, code: string): Plugin {
  return {
    name: "virtual-entry",
    resolveId(source: string) {
      if (source === id) return id;
    },
    load(source: string) {
      if (source === id) return code;
    },
  };
}

interface Entry {
  name: string;
  input: string;
  external?: string[];
  plugins?: Plugin[];
}

function virtualEntry(name: string, code: string): Entry {
  const id = `\0${name}`;
  return {
    name,
    input: id,
    plugins: [virtualEntryPlugin(id, code)],
    // Comparison libraries are measured as used from a React app: their own
    // React bindings are included, but the "react" peer dependency itself
    // is externalized, matching how @kintools/store-react's own row excludes it.
    external: ["react"],
  };
}

const entries: Entry[] = [
  { name: "createStore", input: coreEntry("create-store.ts") },
  { name: "withPlugins", input: coreEntry("with-plugins.ts") },
  { name: "derive", input: coreEntry("derive.ts") },
  {
    name: "@kintools/store-react (bindings only)",
    input: REACT_ENTRY,
    external: [CORE_SPECIFIER, "react"],
  },
  {
    // The number to set against the comparison libraries below: core +
    // react bindings together, "react" itself externalized the same way.
    name: "Kin Store (core + react)",
    input: REACT_ENTRY,
    external: ["react"],
  },
  virtualEntry("Zustand", `export * from "zustand";`),
  virtualEntry(
    "Redux / RTK",
    `export * from "@reduxjs/toolkit";\nexport * from "react-redux";`,
  ),
  virtualEntry("Jotai", `export * from "jotai";`),
  virtualEntry(
    "MobX",
    `export * from "mobx";\nexport * from "mobx-react-lite";`,
  ),
];

async function gzipSize(code: string): Promise<number> {
  const stream = new Blob([code]).stream().pipeThrough(
    new CompressionStream("gzip"),
  );
  const buf = await new Response(stream).arrayBuffer();
  return buf.byteLength;
}

function formatSize(bytes: number, decimals = 1): string {
  if (bytes < 1024) return `${bytes} B`;
  const pow = 10 ** decimals;
  const formatted = (Math.round((bytes / 1024) * pow) / pow).toFixed(decimals);
  return `${formatted} KB`;
}

const nameWidth = Math.max(...entries.map((e) => e.name.length));

for (const entry of entries) {
  const bundle = await rolldown({
    input: entry.input,
    external: entry.external,
    plugins: entry.plugins,
  });
  const { output } = await bundle.generate({ format: "esm", minify: true });
  await bundle.close();

  const code = output
    .filter((chunk): chunk is OutputChunk => chunk.type === "chunk")
    .map((chunk) => chunk.code)
    .join("");

  const min = new TextEncoder().encode(code).byteLength;
  const gzip = await gzipSize(code);

  console.log(
    `${entry.name.padEnd(nameWidth)}  ${formatSize(gzip).padStart(8)} gzip (${
      formatSize(min)
    } min)`,
  );
}
