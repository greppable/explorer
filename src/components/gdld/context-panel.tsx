"use client";

import { useState } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ContextData, DeployEnv, DeployNode, DeployInstance, InfraNode } from "@/lib/parsers/gdld-parser";

export interface DeploymentOpts {
  deployEnvs?: DeployEnv[];
  deployNodes?: DeployNode[];
  deployInstances?: DeployInstance[];
  infraNodes?: InfraNode[];
}

export function hasContextContent(context: ContextData, opts?: DeploymentOpts): boolean {
  return (
    context.useWhen.length > 0 || context.useNot.length > 0 ||
    context.components.length > 0 || context.config.length > 0 ||
    context.gotchas.length > 0 || context.recovery.length > 0 ||
    context.entries.length > 0 || context.decisions.length > 0 ||
    context.notes.length > 0 || context.patterns.length > 0 ||
    (opts?.deployEnvs?.length ?? 0) > 0 || (opts?.deployNodes?.length ?? 0) > 0 ||
    (opts?.deployInstances?.length ?? 0) > 0 || (opts?.infraNodes?.length ?? 0) > 0
  );
}

interface ContextPanelProps {
  context: ContextData;
  deployEnvs?: DeployEnv[];
  deployNodes?: DeployNode[];
  deployInstances?: DeployInstance[];
  infraNodes?: InfraNode[];
}

export function ContextPanel({ context, deployEnvs, deployNodes, deployInstances, infraNodes }: ContextPanelProps) {
  if (!hasContextContent(context, { deployEnvs, deployNodes, deployInstances, infraNodes })) return null;

  return (
    <ScrollArea className="h-full">
      <div className="p-3 space-y-3 text-xs">
        {context.gotchas.length > 0 && (
          <Section title="Gotchas" className="text-destructive" defaultOpen={false}>
            {context.gotchas.map((g, i) => (
              <div key={`gotcha-${g.issue}-${i}`} className="space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="font-medium text-foreground">{g.issue}</span>
                  {g.severity && (
                    <span className={`text-[9px] px-1 py-0.5 rounded-sm font-mono ${
                      g.severity === "high" ? "bg-red-400/15 text-red-600"
                        : g.severity === "medium" ? "bg-amber-400/15 text-amber-600"
                        : "bg-muted text-muted-foreground"
                    }`}>{g.severity}</span>
                  )}
                </div>
                {g.detail && <div className="text-muted-foreground">{g.detail}</div>}
                {g.fix && <div className="text-primary">Fix: {g.fix}</div>}
              </div>
            ))}
          </Section>
        )}

        {context.useWhen.length > 0 && (
          <Section title="Use When">
            {context.useWhen.map((u, i) => (
              <div key={`usewhen-${u.condition}-${i}`}>
                <span className="text-foreground">{u.condition}</span>
                {u.threshold && (
                  <span className="ml-2 text-[10px] px-1 py-0.5 rounded-sm border border-border/50 text-muted-foreground">{u.threshold}</span>
                )}
              </div>
            ))}
          </Section>
        )}

        {context.useNot.length > 0 && (
          <Section title="Don't Use When">
            {context.useNot.map((u, i) => (
              <div key={`usenot-${u.condition}-${i}`}>
                <span className="text-foreground">{u.condition}</span>
                {u.reason && <span className="text-muted-foreground"> — {u.reason}</span>}
              </div>
            ))}
          </Section>
        )}

        {context.components.length > 0 && (
          <Section title="Components">
            {context.components.map((c, i) => (
              <div key={`comp-${c.name}-${i}`} className="flex justify-between">
                <span className="font-mono text-foreground">{c.name}</span>
                {c.file && <span className="text-muted-foreground/60">{c.file}</span>}
              </div>
            ))}
          </Section>
        )}

        {context.decisions.length > 0 && (
          <Section title="Decisions">
            {context.decisions.map((d, i) => (
              <div key={`decision-${d.id}-${i}`} className="space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-mono px-1 py-0.5 rounded border border-border/50 text-muted-foreground">{d.id}</span>
                  <span className="font-medium text-foreground">{d.title}</span>
                </div>
                {d.reason && <div className="text-muted-foreground">{d.reason}</div>}
              </div>
            ))}
          </Section>
        )}

        {context.config.length > 0 && (
          <Section title="Config">
            {context.config.map((c, i) => (
              <div key={`config-${c.param}-${i}`} className="font-mono">
                <span className="text-foreground">{c.param}</span>
                <span className="text-muted-foreground/50"> = </span>
                <span className="text-primary">{c.value}</span>
                {c.note && <span className="text-muted-foreground/50"> ({c.note})</span>}
              </div>
            ))}
          </Section>
        )}

        {context.entries.length > 0 && (
          <Section title="Entry Points">
            {context.entries.map((e, i) => (
              <div key={`entry-${e.useCase}-${i}`}>
                <div className="text-foreground">{e.useCase}</div>
                {e.command && <div className="font-mono text-muted-foreground/60">{e.command}</div>}
              </div>
            ))}
          </Section>
        )}

        {context.recovery.length > 0 && (
          <Section title="Recovery" defaultOpen={false}>
            {context.recovery.map((r, i) => (
              <div key={`recovery-${r.issue}-${i}`} className="space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="font-medium text-foreground">{r.issue}</span>
                  {r.severity && (
                    <span className={`text-[9px] px-1 py-0.5 rounded-sm font-mono ${
                      r.severity === "high" ? "bg-red-400/15 text-red-600"
                        : r.severity === "medium" ? "bg-amber-400/15 text-amber-600"
                        : "bg-muted text-muted-foreground"
                    }`}>{r.severity}</span>
                  )}
                </div>
                {r.means && <div className="text-muted-foreground">Means: {r.means}</div>}
                {r.fix && <div className="text-primary">Fix: {r.fix}</div>}
              </div>
            ))}
          </Section>
        )}

        {context.patterns.length > 0 && (
          <Section title="Patterns">
            {context.patterns.map((p, i) => (
              <div key={`pattern-${p.name}-${i}`}>
                <span className="font-mono text-foreground">{p.name}</span>
                {p.file && <span className="text-muted-foreground/60 ml-2">{p.file}</span>}
              </div>
            ))}
          </Section>
        )}

        {context.notes.length > 0 && (
          <Section title="Notes">
            {context.notes.map((n, i) => (
              <div key={`note-${n.context}-${i}`}>
                {n.context && <span className="text-[10px] font-mono px-1 py-0.5 rounded border border-border/50 text-muted-foreground mr-2">{n.context}</span>}
                <span className="text-foreground">{n.text}</span>
              </div>
            ))}
          </Section>
        )}

        {deployEnvs && deployEnvs.length > 0 && (
          <Section title="Deployment Environments">
            {deployEnvs.map((env, i) => (
              <div key={`env-${env.label}-${i}`} className="space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="font-medium text-foreground">{env.label}</span>
                  {env.provider && (
                    <span className="text-[9px] px-1 py-0.5 rounded-sm font-mono bg-muted text-muted-foreground">{env.provider}</span>
                  )}
                </div>
              </div>
            ))}
          </Section>
        )}

        {deployNodes && deployNodes.length > 0 && (
          <Section title="Deploy Nodes">
            {deployNodes.map((node, i) => (
              <div key={`dnode-${node.label}-${i}`} className="space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <span className="font-medium text-foreground">{node.label}</span>
                  {node.technology && (
                    <span className="text-[9px] px-1 py-0.5 rounded-sm font-mono bg-muted text-muted-foreground">{node.technology}</span>
                  )}
                </div>
                {node.tags && node.tags.length > 0 && (
                  <div className="flex gap-1 flex-wrap">
                    {node.tags.map((t) => <span key={t} className="text-[9px] font-mono px-1 py-0.5 rounded bg-muted text-muted-foreground">{t}</span>)}
                  </div>
                )}
              </div>
            ))}
          </Section>
        )}

        {deployInstances && deployInstances.length > 0 && (
          <Section title="Deployed Instances">
            {deployInstances.map((inst, i) => (
              <div key={`dinst-${inst.component}-${inst.node}-${i}`} className="flex items-center gap-1.5">
                <span className="font-mono text-foreground">{inst.component}</span>
                <span className="text-muted-foreground/50">→</span>
                <span className="font-mono text-foreground">{inst.node}</span>
                {inst.instances && (
                  <span className="text-[9px] px-1 py-0.5 rounded-sm font-mono bg-muted text-muted-foreground">×{inst.instances}</span>
                )}
              </div>
            ))}
          </Section>
        )}

        {infraNodes && infraNodes.length > 0 && (
          <Section title="Infrastructure">
            {infraNodes.map((node, i) => (
              <div key={`infra-${node.label}-${i}`} className="flex items-center gap-1.5">
                <span className="font-medium text-foreground">{node.label}</span>
                {node.technology && (
                  <span className="text-[9px] px-1 py-0.5 rounded-sm font-mono bg-muted text-muted-foreground">{node.technology}</span>
                )}
              </div>
            ))}
          </Section>
        )}
      </div>
    </ScrollArea>
  );
}

function Section({
  title,
  className,
  children,
  defaultOpen = true,
}: {
  title: string;
  className?: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider mb-1.5 hover:opacity-80 transition-opacity ${className || "text-muted-foreground"}`}
      >
        <span className={`text-[8px] transition-transform ${open ? "rotate-90" : ""}`}>&#9654;</span>
        {title}
      </button>
      {open && <div className="space-y-1.5">{children}</div>}
    </div>
  );
}
