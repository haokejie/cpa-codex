<script setup lang="ts">
import { computed, useSlots } from "vue";

type HeaderGap = "sm" | "md" | "lg";

type HeaderAlign = "start" | "center";

const props = withDefaults(defineProps<{
  title?: string;
  description?: string;
  fullHeight?: boolean;
  headerGap?: HeaderGap;
  headerAlign?: HeaderAlign;
}>(), {
  title: undefined,
  description: undefined,
  fullHeight: false,
  headerGap: "md",
  headerAlign: "start",
});

const slots = useSlots();

const showHeader = computed(() => {
  return Boolean(
    slots.header ||
      slots.title ||
      slots.description ||
      slots.actions ||
      props.title ||
      props.description,
  );
});

const cardStyle = computed(() => {
  const gapMap: Record<HeaderGap, string> = {
    sm: "12px",
    md: "16px",
    lg: "20px",
  };
  const alignMap: Record<HeaderAlign, string> = {
    start: "flex-start",
    center: "center",
  };
  return {
    "--card-head-gap": gapMap[props.headerGap],
    "--card-head-align": alignMap[props.headerAlign],
  } as Record<string, string>;
});
</script>

<template>
  <section class="card" :class="{ 'card-full': fullHeight }" :style="cardStyle">
    <slot name="header">
      <div v-if="showHeader" class="card-head">
        <div class="card-head-main">
          <slot name="title">
            <h2 v-if="title" class="card-title">{{ title }}</h2>
          </slot>
          <slot name="description">
            <p v-if="description" class="card-desc">{{ description }}</p>
          </slot>
        </div>
        <div v-if="$slots.actions" class="card-actions">
          <slot name="actions"></slot>
        </div>
      </div>
    </slot>

    <slot></slot>
  </section>
</template>

<style scoped>
.card {
  background: #fff;
  border: 1px solid var(--zinc-200);
  border-radius: 12px;
  padding: 20px 24px;
}

.card-full {
  display: flex;
  flex-direction: column;
  height: var(--card-full-height, calc(100vh - 52px - 56px));
  min-height: 0;
}

.card-head {
  margin-bottom: var(--card-head-gap, 16px);
  display: flex;
  align-items: var(--card-head-align, flex-start);
  justify-content: space-between;
  gap: 12px;
}

.card-head-main {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.card-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--zinc-900);
  margin: 0;
}

.card-desc {
  font-size: 12px;
  color: var(--zinc-500);
  margin: 0;
}

:slotted(.card-title) {
  font-size: 15px;
  font-weight: 600;
  color: var(--zinc-900);
  margin: 0;
}

:slotted(.card-desc) {
  font-size: 12px;
  color: var(--zinc-500);
  margin: 0;
}

.card-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  justify-content: flex-end;
  flex-wrap: wrap;
}
</style>
