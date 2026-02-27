<script setup lang="ts">

type Props = {
  open: boolean;
  title: string;
  message: string;
  loading?: boolean;
};

defineProps<Props>();

defineEmits<{
  (e: "confirm"): void;
  (e: "cancel"): void;
}>();
</script>

<template>
  <div v-if="open" class="mask">
    <div class="dialog">
      <div class="dialog-header">
        <h3 class="dialog-title">{{ title }}</h3>
      </div>
      <div class="dialog-body">
        <p class="dialog-message">{{ message }}</p>
      </div>
      <div class="dialog-footer">
        <button class="btn-ghost" :disabled="loading" @click="$emit('cancel')">
          取消
        </button>
        <button class="btn-danger" :disabled="loading" @click="$emit('confirm')">
          {{ loading ? "处理中..." : "确认删除" }}
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
  z-index: 50;
  backdrop-filter: blur(2px);
}

.dialog {
  width: 340px;
  background: #FFFFFF;
  border-radius: 12px;
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.14);
  overflow: hidden;
}

.dialog-header {
  padding: 20px 20px 0;
}

.dialog-title {
  font-size: 15px;
  font-weight: 600;
  color: #18181B;
}

.dialog-body {
  padding: 8px 20px 16px;
}

.dialog-message {
  font-size: 13px;
  color: #71717A;
  line-height: 1.6;
}

.dialog-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 8px;
  padding: 0 20px 20px;
}

.btn-ghost {
  height: 34px;
  padding: 0 14px;
  background: transparent;
  color: #52525B;
  border: 1px solid #E4E4E7;
  border-radius: 6px;
  font-size: 13px;
  font-family: inherit;
  cursor: pointer;
  transition: background 150ms ease, border-color 150ms ease, color 150ms ease;
}

.btn-ghost:hover:not(:disabled) {
  background: #FAFAFA;
  border-color: #D4D4D8;
  color: #18181B;
}

.btn-ghost:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-danger {
  height: 34px;
  padding: 0 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #DC2626;
  color: #FFFFFF;
  border: none;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  font-family: inherit;
  cursor: pointer;
  transition: background 150ms ease, opacity 150ms ease;
}

.btn-danger:hover:not(:disabled) {
  background: #B91C1C;
}

.btn-danger:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
