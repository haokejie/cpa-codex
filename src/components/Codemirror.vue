<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from "vue";
import { Compartment, EditorState, type Extension } from "@codemirror/state";
import { EditorView } from "@codemirror/view";

const props = defineProps<{
  modelValue: string;
  extensions?: Extension[];
  editable?: boolean;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: string): void;
  (e: "ready", payload: { view: EditorView }): void;
}>();

const host = ref<HTMLDivElement | null>(null);
let view: EditorView | null = null;

const extensionsCompartment = new Compartment();
const editableCompartment = new Compartment();

const buildExtensions = (extensions: Extension[] = [], editable = true) => [
  extensionsCompartment.of(extensions),
  editableCompartment.of(EditorView.editable.of(editable)),
  EditorView.updateListener.of((update) => {
    if (update.docChanged) {
      emit("update:modelValue", update.state.doc.toString());
    }
  }),
];

const createView = () => {
  if (!host.value) return;
  const state = EditorState.create({
    doc: props.modelValue ?? "",
    extensions: buildExtensions(props.extensions ?? [], props.editable !== false),
  });
  view = new EditorView({
    state,
    parent: host.value,
  });
  emit("ready", { view });
};

const replaceContent = (nextValue: string) => {
  if (!view) return;
  const current = view.state.doc.toString();
  if (current === nextValue) return;
  view.dispatch({
    changes: { from: 0, to: current.length, insert: nextValue },
  });
};

onMounted(() => {
  createView();
});

watch(
  () => props.modelValue,
  (value) => {
    replaceContent(value ?? "");
  },
);

watch(
  () => props.extensions,
  (value) => {
    if (!view) return;
    view.dispatch({
      effects: extensionsCompartment.reconfigure(value ?? []),
    });
  },
  { deep: true },
);

watch(
  () => props.editable,
  (value) => {
    if (!view) return;
    view.dispatch({
      effects: editableCompartment.reconfigure(EditorView.editable.of(value !== false)),
    });
  },
);

onBeforeUnmount(() => {
  if (view) {
    view.destroy();
    view = null;
  }
});
</script>

<template>
  <div ref="host" class="codemirror-host"></div>
</template>

<style scoped>
.codemirror-host {
  width: 100%;
  height: 100%;
}
</style>
