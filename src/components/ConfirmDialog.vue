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
      <h3>{{ title }}</h3>
      <p class="message">{{ message }}</p>
      <div class="actions">
        <button class="ghost" :disabled="loading" @click="$emit('cancel')">
          取消
        </button>
        <button class="danger" :disabled="loading" @click="$emit('confirm')">
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
  background: rgba(15, 23, 42, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 20;
}

.dialog {
  width: 360px;
  background: #fff;
  border-radius: 14px;
  padding: 20px 22px;
  box-shadow: 0 20px 40px rgba(15, 23, 42, 0.2);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

h3 {
  margin: 0;
  font-size: 18px;
}

.message {
  margin: 0;
  color: #64748b;
  font-size: 14px;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.ghost {
  background: transparent;
  color: #0f172a;
  border: 1px solid #cbd5f5;
  border-radius: 10px;
  padding: 8px 14px;
  cursor: pointer;
}

.danger {
  background: #b91c1c;
  color: #fff;
  border: none;
  border-radius: 10px;
  padding: 8px 14px;
  cursor: pointer;
}

.ghost:disabled,
.danger:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
