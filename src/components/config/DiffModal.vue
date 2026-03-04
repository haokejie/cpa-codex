<script setup lang="ts">
import { computed } from "vue";
import { Text } from "@codemirror/state";
import { Chunk } from "@codemirror/merge";

type DiffModalProps = {
  open: boolean;
  original: string;
  modified: string;
  loading?: boolean;
};

const props = withDefaults(defineProps<DiffModalProps>(), {
  loading: false,
});

defineEmits<{
  (e: "confirm"): void;
  (e: "cancel"): void;
}>();

type UnifiedLineType = "context" | "addition" | "deletion";

type UnifiedLine = {
  type: UnifiedLineType;
  oldNum: number | null;
  newNum: number | null;
  text: string;
};

type Hunk = {
  oldStart: number;
  oldCount: number;
  newStart: number;
  newCount: number;
  lines: UnifiedLine[];
};

type DiffResult = {
  hunks: Hunk[];
  additions: number;
  deletions: number;
};

const DIFF_CONTEXT_LINES = 3;

const clampPos = (doc: Text, pos: number) => Math.max(0, Math.min(pos, doc.length));

function computeUnifiedDiff(original: string, modified: string): DiffResult {
  const oldDoc = Text.of(original.split("\n"));
  const newDoc = Text.of(modified.split("\n"));
  const chunks = Chunk.build(oldDoc, newDoc);

  let totalAdditions = 0;
  let totalDeletions = 0;

  const hunks: Hunk[] = chunks.map((chunk: Chunk) => {
    const lines: UnifiedLine[] = [];

    const hasDel = chunk.fromA < chunk.toA;
    const hasAdd = chunk.fromB < chunk.toB;

    const delLines: { num: number; text: string }[] = [];
    if (hasDel) {
      const startLine = oldDoc.lineAt(chunk.fromA).number;
      const endLine = oldDoc.lineAt(chunk.toA - 1).number;
      for (let i = startLine; i <= endLine; i++) {
        delLines.push({ num: i, text: oldDoc.line(i).text });
      }
    }

    const addLines: { num: number; text: string }[] = [];
    if (hasAdd) {
      const startLine = newDoc.lineAt(chunk.fromB).number;
      const endLine = newDoc.lineAt(chunk.toB - 1).number;
      for (let i = startLine; i <= endLine; i++) {
        addLines.push({ num: i, text: newDoc.line(i).text });
      }
    }

    totalDeletions += delLines.length;
    totalAdditions += addLines.length;

    let ctxBeforeEndOld: number;
    let ctxAfterStartOld: number;
    let ctxBeforeEndNew: number;
    let ctxAfterStartNew: number;

    if (hasDel) {
      ctxBeforeEndOld = delLines[0].num - 1;
      ctxAfterStartOld = delLines[delLines.length - 1].num + 1;
    } else {
      const anchorPos = clampPos(oldDoc, chunk.fromA);
      const lineInfo = oldDoc.lineAt(anchorPos);
      if (chunk.fromA === lineInfo.from) {
        ctxBeforeEndOld = lineInfo.number - 1;
        ctxAfterStartOld = lineInfo.number;
      } else {
        ctxBeforeEndOld = lineInfo.number;
        ctxAfterStartOld = lineInfo.number + 1;
      }
    }

    if (hasAdd) {
      ctxBeforeEndNew = addLines[0].num - 1;
      ctxAfterStartNew = addLines[addLines.length - 1].num + 1;
    } else {
      const anchorPos = clampPos(newDoc, chunk.fromB);
      const lineInfo = newDoc.lineAt(anchorPos);
      if (chunk.fromB === lineInfo.from) {
        ctxBeforeEndNew = lineInfo.number - 1;
        ctxAfterStartNew = lineInfo.number;
      } else {
        ctxBeforeEndNew = lineInfo.number;
        ctxAfterStartNew = lineInfo.number + 1;
      }
    }

    const ctxBeforeCount = Math.min(
      DIFF_CONTEXT_LINES,
      Math.max(0, ctxBeforeEndOld),
      Math.max(0, ctxBeforeEndNew),
    );

    for (let i = ctxBeforeCount; i > 0; i--) {
      const oldNum = ctxBeforeEndOld - i + 1;
      const newNum = ctxBeforeEndNew - i + 1;
      if (oldNum >= 1 && newNum >= 1 && oldNum <= oldDoc.lines) {
        lines.push({
          type: "context",
          oldNum,
          newNum,
          text: oldDoc.line(oldNum).text,
        });
      }
    }

    for (const del of delLines) {
      lines.push({ type: "deletion", oldNum: del.num, newNum: null, text: del.text });
    }

    for (const add of addLines) {
      lines.push({ type: "addition", oldNum: null, newNum: add.num, text: add.text });
    }

    const ctxAfterCountOld = Math.max(
      0,
      Math.min(DIFF_CONTEXT_LINES, oldDoc.lines - ctxAfterStartOld + 1),
    );
    const ctxAfterCountNew = Math.max(
      0,
      Math.min(DIFF_CONTEXT_LINES, newDoc.lines - ctxAfterStartNew + 1),
    );
    const ctxAfterCount = Math.min(ctxAfterCountOld, ctxAfterCountNew);

    for (let i = 0; i < ctxAfterCount; i++) {
      const oldNum = ctxAfterStartOld + i;
      const newNum = ctxAfterStartNew + i;
      if (oldNum >= 1 && oldNum <= oldDoc.lines && newNum >= 1 && newNum <= newDoc.lines) {
        lines.push({
          type: "context",
          oldNum,
          newNum,
          text: oldDoc.line(oldNum).text,
        });
      }
    }

    const firstOld = lines.find((l) => l.oldNum !== null)?.oldNum ?? 1;
    const firstNew = lines.find((l) => l.newNum !== null)?.newNum ?? 1;
    const oldCount = lines.filter((l) => l.type !== "addition").length;
    const newCount = lines.filter((l) => l.type !== "deletion").length;

    return { oldStart: firstOld, oldCount, newStart: firstNew, newCount, lines };
  });

  return { hunks, additions: totalAdditions, deletions: totalDeletions };
}

const diff = computed(() => computeUnifiedDiff(props.original, props.modified));
</script>

<template>
  <div v-if="open" class="mask">
    <div class="dialog">
      <div class="dialog-header">
        <h3 class="dialog-title">配置变更预览</h3>
        <div class="dialog-meta">
          <span class="meta-add">+{{ diff.additions }}</span>
          <span class="meta-del">-{{ diff.deletions }}</span>
        </div>
      </div>
      <div class="dialog-body">
        <div v-if="diff.hunks.length === 0" class="empty-state">没有检测到差异</div>
        <div v-else class="diff-list">
          <div v-for="(hunk, idx) in diff.hunks" :key="idx" class="hunk">
            <div class="hunk-header">
              @@ -{{ hunk.oldStart }},{{ hunk.oldCount }} +{{ hunk.newStart }},{{ hunk.newCount }} @@
            </div>
            <div v-for="(line, lineIdx) in hunk.lines" :key="`${idx}-${lineIdx}`" class="diff-line" :class="line.type">
              <span class="line-num">{{ line.oldNum ?? "" }}</span>
              <span class="line-num">{{ line.newNum ?? "" }}</span>
              <span class="line-prefix">{{ line.type === "addition" ? "+" : line.type === "deletion" ? "-" : " " }}</span>
              <code class="line-text">{{ line.text || " " }}</code>
            </div>
          </div>
        </div>
      </div>
      <div class="dialog-footer">
        <button class="btn-ghost" :disabled="loading" @click="$emit('cancel')">取消</button>
        <button class="btn-action" :disabled="loading" @click="$emit('confirm')">
          {{ loading ? "保存中..." : "确认保存" }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mask {
  position: fixed;
  inset: 0;
  background: rgba(9, 9, 11, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 70;
  backdrop-filter: blur(2px);
}
.dialog {
  width: min(1100px, 92vw);
  max-height: 80vh;
  background: #FFFFFF;
  border-radius: 12px;
  box-shadow: 0 12px 40px rgba(15, 23, 42, 0.2);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}
.dialog-header {
  padding: 18px 20px 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.dialog-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--zinc-900);
}
.dialog-meta {
  display: flex;
  gap: 8px;
  font-size: 12px;
}
.meta-add { color: var(--green-600); }
.meta-del { color: var(--red-600); }
.dialog-body {
  padding: 0 20px 16px;
  overflow: auto;
}
.diff-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.hunk-header {
  font-size: 12px;
  color: var(--zinc-500);
  background: var(--zinc-100);
  padding: 6px 8px;
  border-radius: 6px;
}
.diff-line {
  display: grid;
  grid-template-columns: 50px 50px 16px 1fr;
  gap: 6px;
  font-size: 12px;
  padding: 2px 6px;
  align-items: center;
  border-radius: 4px;
  font-family: "SFMono-Regular", Menlo, Monaco, Consolas, "Liberation Mono", monospace;
}
.diff-line.addition {
  background: #ECFDF3;
  color: #166534;
}
.diff-line.deletion {
  background: #FEF2F2;
  color: #991B1B;
}
.line-num {
  text-align: right;
  color: var(--zinc-400);
}
.line-prefix {
  text-align: center;
}
.line-text {
  white-space: pre-wrap;
}
.empty-state {
  font-size: 12px;
  color: var(--zinc-400);
  padding: 20px 0;
}
.dialog-footer {
  padding: 0 20px 18px;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
}
.btn-ghost {
  height: 32px;
  padding: 0 12px;
  background: transparent;
  color: var(--zinc-600);
  border: 1px solid var(--zinc-200);
  border-radius: 7px;
  font-size: 12px;
  font-family: inherit;
  cursor: pointer;
}
.btn-action {
  height: 32px;
  padding: 0 14px;
  background: var(--zinc-900);
  color: #FFFFFF;
  border: 1px solid var(--zinc-900);
  border-radius: 7px;
  font-size: 12px;
  font-family: inherit;
  cursor: pointer;
}
.btn-ghost:disabled,
.btn-action:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
