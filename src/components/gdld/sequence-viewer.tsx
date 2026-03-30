"use client";

import { useMemo } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { GdldModel, SequenceElement, Participant } from "@/lib/parsers/gdld-parser";

const CFG = {
  participantWidth: 120,
  participantHeight: 36,
  messageHeight: 40,
  blockHeaderHeight: 25,
  activationWidth: 10,
  leftMargin: 40,
  topMargin: 60,
  noteWidth: 150,
  noteHeight: 40,
  blockPadding: 10,
  fontSize: 12,
  smallFontSize: 10,
};

interface SequenceViewerProps {
  model: GdldModel;
}

export function SequenceViewer({ model }: SequenceViewerProps) {
  const { svgContent, width, height } = useMemo(() => {
    return renderSequenceSvg(model.participants, model.sequenceElements);
  }, [model.participants, model.sequenceElements]);

  return (
    <ScrollArea className="h-full">
      <div className="p-4">
        <svg
          width={width}
          height={height}
          viewBox={`0 0 ${width} ${height}`}
          className="sequence-diagram"
          xmlns="http://www.w3.org/2000/svg"
        >
          <defs>
            <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
              <polygon points="0 0, 10 3.5, 0 7" fill="#666" />
            </marker>
            <marker id="arrowhead-dashed" markerWidth="10" markerHeight="7" refX="10" refY="3.5" orient="auto">
              <polygon points="0 0, 10 3.5, 0 7" fill="#999" />
            </marker>
          </defs>
          <g dangerouslySetInnerHTML={{ __html: svgContent }} />
        </svg>
      </div>
    </ScrollArea>
  );
}

function renderSequenceSvg(
  participants: Participant[],
  elements: SequenceElement[]
): { svgContent: string; width: number; height: number } {
  const participantXMap = new Map<string, number>();
  let xCursor = CFG.leftMargin;

  for (const p of participants) {
    participantXMap.set(p.id, xCursor + CFG.participantWidth / 2);
    xCursor += CFG.participantWidth + 20;
  }

  const totalWidth = xCursor + CFG.leftMargin;
  let yCursor = CFG.topMargin + CFG.participantHeight + 20;
  const parts: string[] = [];

  // Draw participant boxes at top
  for (const p of participants) {
    const cx = participantXMap.get(p.id)!;
    const x = cx - CFG.participantWidth / 2;
    parts.push(
      `<rect x="${x}" y="${CFG.topMargin}" width="${CFG.participantWidth}" height="${CFG.participantHeight}" ` +
      `rx="4" fill="#f8f9fa" stroke="#333" stroke-width="1.5" />` +
      `<text x="${cx}" y="${CFG.topMargin + CFG.participantHeight / 2 + 4}" ` +
      `text-anchor="middle" font-size="${CFG.fontSize}" fill="#333">${escSvg(p.label)}</text>`
    );
  }

  // Draw lifelines
  const estimatedHeight = CFG.topMargin + CFG.participantHeight + 20 +
    elements.length * CFG.messageHeight + 100;

  for (const p of participants) {
    const cx = participantXMap.get(p.id)!;
    parts.push(
      `<line x1="${cx}" y1="${CFG.topMargin + CFG.participantHeight}" ` +
      `x2="${cx}" y2="${estimatedHeight}" stroke="#ccc" stroke-dasharray="4,4" />`
    );
  }

  // Draw elements
  const blockStack: { type: string; label: string; startY: number }[] = [];

  for (const el of elements) {
    switch (el.type) {
      case "msg": {
        const fromX = participantXMap.get(el.from!) || 0;
        const toX = participantXMap.get(el.to!) || 0;
        const isSelf = el.from === el.to;
        const isResponse = el.msgType === "response";
        const isAsync = el.msgType === "async";

        if (isSelf) {
          // Self-message: curved arrow
          parts.push(
            `<path d="M ${fromX} ${yCursor} C ${fromX + 60} ${yCursor}, ` +
            `${fromX + 60} ${yCursor + 25}, ${fromX} ${yCursor + 25}" ` +
            `fill="none" stroke="#666" stroke-width="1.5" marker-end="url(#arrowhead)" />`
          );
          if (el.label) {
            parts.push(
              `<text x="${fromX + 65}" y="${yCursor + 15}" font-size="${CFG.smallFontSize}" fill="#666">${escSvg(el.label)}</text>`
            );
          }
          yCursor += CFG.messageHeight;
        } else {
          const dashArray = isResponse ? 'stroke-dasharray="6,3"' : isAsync ? 'stroke-dasharray="3,3"' : "";
          const marker = isResponse ? "arrowhead-dashed" : "arrowhead";
          parts.push(
            `<line x1="${fromX}" y1="${yCursor}" x2="${toX}" y2="${yCursor}" ` +
            `stroke="#666" stroke-width="1.5" ${dashArray} marker-end="url(#${marker})" />`
          );
          if (el.label) {
            const midX = (fromX + toX) / 2;
            parts.push(
              `<text x="${midX}" y="${yCursor - 6}" text-anchor="middle" ` +
              `font-size="${CFG.smallFontSize}" fill="#666">${escSvg(el.label)}</text>`
            );
          }
          yCursor += CFG.messageHeight;
        }
        break;
      }
      case "block": {
        blockStack.push({
          type: el.blockType || "opt",
          label: el.label || "",
          startY: yCursor - 10,
        });
        // Block header
        parts.push(
          `<text x="${CFG.leftMargin + 5}" y="${yCursor + 3}" ` +
          `font-size="${CFG.smallFontSize}" font-weight="bold" fill="#444">` +
          `[${(el.blockType || "opt").toUpperCase()}] ${escSvg(el.label || "")}</text>`
        );
        yCursor += CFG.blockHeaderHeight;
        break;
      }
      case "else":
      case "and": {
        // Divider line
        parts.push(
          `<line x1="${CFG.leftMargin}" y1="${yCursor}" x2="${totalWidth - CFG.leftMargin}" y2="${yCursor}" ` +
          `stroke="#999" stroke-dasharray="4,4" />`
        );
        if (el.label) {
          parts.push(
            `<text x="${CFG.leftMargin + 5}" y="${yCursor + 14}" ` +
            `font-size="${CFG.smallFontSize}" fill="#666">[${el.type === "else" ? "else" : "and"}] ${escSvg(el.label)}</text>`
          );
        }
        yCursor += CFG.blockHeaderHeight;
        break;
      }
      case "endblock": {
        const block = blockStack.pop();
        if (block) {
          parts.push(
            `<rect x="${CFG.leftMargin - 5}" y="${block.startY}" ` +
            `width="${totalWidth - 2 * CFG.leftMargin + 10}" height="${yCursor - block.startY + 5}" ` +
            `rx="2" fill="none" stroke="#999" stroke-width="1" />`
          );
        }
        yCursor += 10;
        break;
      }
      case "seq-note": {
        const overX = participantXMap.get(el.over!) || CFG.leftMargin;
        const noteX = overX + 20;
        parts.push(
          `<rect x="${noteX}" y="${yCursor - 15}" width="${CFG.noteWidth}" height="${CFG.noteHeight}" ` +
          `rx="2" fill="#fffde7" stroke="#f9a825" stroke-width="1" />` +
          `<text x="${noteX + 8}" y="${yCursor + 5}" font-size="${CFG.smallFontSize}" fill="#666">${escSvg(el.text || "")}</text>`
        );
        yCursor += CFG.messageHeight;
        break;
      }
    }
  }

  // Draw bottom participant boxes
  for (const p of participants) {
    const cx = participantXMap.get(p.id)!;
    const x = cx - CFG.participantWidth / 2;
    parts.push(
      `<rect x="${x}" y="${yCursor + 10}" width="${CFG.participantWidth}" height="${CFG.participantHeight}" ` +
      `rx="4" fill="#f8f9fa" stroke="#333" stroke-width="1.5" />` +
      `<text x="${cx}" y="${yCursor + 10 + CFG.participantHeight / 2 + 4}" ` +
      `text-anchor="middle" font-size="${CFG.fontSize}" fill="#333">${escSvg(p.label)}</text>`
    );
  }

  const finalHeight = yCursor + 10 + CFG.participantHeight + 20;

  return {
    svgContent: parts.join("\n"),
    width: totalWidth,
    height: finalHeight,
  };
}

function escSvg(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
