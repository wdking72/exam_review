<script setup lang="ts">
defineProps<{
  message: {
    role: 'user' | 'assistant' | 'tool'
    content: string
  }
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
      <div class="whitespace-pre-wrap leading-relaxed">{{ message.content }}</div>
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