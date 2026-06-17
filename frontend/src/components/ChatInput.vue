<script setup lang="ts">
import { ref } from 'vue'

const props = defineProps<{
  disabled?: boolean
}>()

const emit = defineEmits<{
  (e: 'send', message: string): void
}>()

const input = ref('')

const handleSend = () => {
  if (input.value.trim() && !props.disabled) {
    emit('send', input.value.trim())
    input.value = ''
  }
}

const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    handleSend()
  }
}
</script>

<template>
  <div class="p-4 border-t border-gray-200 bg-white">
    <div class="flex space-x-3 items-end">
      <textarea
        v-model="input"
        @keydown="handleKeydown"
        placeholder="输入你的问题，开始学习..."
        class="flex-1 resize-none border border-gray-300 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-accent-primary focus:border-transparent transition-all duration-200 placeholder-text-secondary"
        rows="2"
        :disabled="disabled"
      />
      <button
        @click="handleSend"
        :disabled="disabled || !input.trim()"
        class="px-5 py-3 bg-accent-primary text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-medium shadow-sm hover:shadow-md"
      >
        发送
      </button>
    </div>
    <div class="mt-2 text-xs text-text-secondary">
      按 Enter 发送，Shift + Enter 换行
    </div>
  </div>
</template>