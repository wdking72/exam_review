<script setup lang="ts">
import MarkdownRenderer from './MarkdownRenderer.vue'

// FIX: 助手消息被 max_tokens 截断时,显示"继续生成"按钮
// emits('continue') 让 ChatView 调用 sendMessage('继续')
defineProps<{
  message: {
    role: 'user' | 'assistant' | 'tool'
    content: string
    truncated?: boolean
  }
}>()

const emit = defineEmits<{
  (e: 'continue'): void
}>()
</script>

<template>
  <div
    :class="[
      'flex',
      message.role === 'user' ? 'justify-end' : 'justify-start',
    ]"
  >
    <div
      :class="[
        'max-w-[80%] rounded-2xl px-5 py-3 shadow-sm',
        message.role === 'user'
          ? 'bg-accent-primary text-white'
          : message.role === 'tool'
          ? 'bg-gray-100 text-text-primary font-mono text-sm border border-gray-200'
          : 'bg-white text-text-primary border border-gray-200',
      ]"
    >
      <!-- 助手消息：使用 Markdown 渲染器解析格式化内容 -->
      <MarkdownRenderer v-if="message.role === 'assistant'" :content="message.content" />
      <!-- 用户/工具消息：纯文本展示 -->
      <div v-else class="whitespace-pre-wrap leading-relaxed">{{ message.content }}</div>

      <!-- FIX: 内容被 max_tokens 截断时,显示友好提示 + 继续生成按钮 -->
      <div
        v-if="message.role === 'assistant' && message.truncated"
        class="mt-3 pt-3 border-t border-amber-200"
      >
        <div class="flex items-center justify-between gap-3">
          <div class="text-sm text-amber-700 flex items-center gap-1">
            <span>⚠️</span>
            <span>已超过最大文字限制，请点击下方"继续生成"以接着获取后续内容。</span>
          </div>
          <button
            @click="emit('continue')"
            class="flex-shrink-0 text-sm px-4 py-1.5 bg-accent-primary text-white rounded-lg hover:opacity-90 transition-opacity font-medium"
          >
            继续生成
          </button>
        </div>
      </div>

      <div
        :class="[
          'text-xs mt-2 opacity-70',
          message.role === 'user' ? 'text-blue-100' : 'text-text-secondary'
        ]"
      >
        {{ message.role === 'user' ? '你' : message.role === 'tool' ? '工具' : '助手' }}
      </div>
    </div>
  </div>
</template>