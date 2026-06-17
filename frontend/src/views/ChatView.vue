<script setup lang="ts">
import ChatInput from '../components/ChatInput.vue'
import ChatMessage from '../components/ChatMessage.vue'
import Sidebar from '../components/Sidebar.vue'
import { useChat } from '../composables/useChat'
import { computed } from 'vue'

const { messages, isLoading, error, sendMessage, cancelMessage } = useChat()

const handleSendMessage = (message: string) => {
  sendMessage(message)
}

const progress = computed(() => {
  const userMessages = messages.value.filter(m => m.role === 'user').length
  return Math.min(userMessages * 10, 100)
})

const progressColor = computed(() => {
  if (progress.value < 30) return 'bg-accent-secondary'
  if (progress.value < 70) return 'bg-accent-primary'
  return 'bg-green-500'
})
</script>

<template>
  <div class="flex h-full w-full">
    <Sidebar class="w-72 flex-shrink-0" />
    <div class="flex flex-col flex-1 max-w-4xl mx-auto">
      <!-- 头部区域 -->
      <div class="p-4 border-b border-gray-200">
        <div class="flex items-center justify-between">
          <div>
            <h1 class="text-xl font-semibold text-text-primary font-display">学习助手</h1>
            <p class="text-sm text-text-secondary">专注于你的学习目标</p>
          </div>
          <div class="flex items-center space-x-4">
            <!-- 学习进度指示器 -->
            <div class="flex items-center space-x-2">
              <div class="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  :class="[progressColor, 'h-full rounded-full transition-all duration-500']"
                  :style="{ width: progress + '%' }"
                ></div>
              </div>
              <span class="text-xs text-text-secondary">{{ progress }}%</span>
            </div>
            <div class="flex items-center space-x-2">
              <div class="w-3 h-3 bg-accent-secondary rounded-full animate-pulse"></div>
              <span class="text-sm text-text-secondary">在线</span>
            </div>
          </div>
        </div>
      </div>
      
      <!-- 消息区域 -->
      <div class="flex-1 overflow-y-auto p-4 space-y-6">
        <ChatMessage
          v-for="(msg, index) in messages"
          :key="index"
          :message="msg"
        />
        <div v-if="isLoading" class="flex items-center justify-between text-text-secondary">
          <div class="flex items-center space-x-2">
            <div class="flex space-x-1">
              <div class="w-2 h-2 bg-accent-primary rounded-full animate-bounce"></div>
              <div class="w-2 h-2 bg-accent-primary rounded-full animate-bounce" style="animation-delay: 0.1s"></div>
              <div class="w-2 h-2 bg-accent-primary rounded-full animate-bounce" style="animation-delay: 0.2s"></div>
            </div>
            <span class="text-sm">正在思考...</span>
          </div>
          <button
            @click="cancelMessage"
            class="text-xs px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
          >
            停止
          </button>
        </div>
        <div v-if="error" class="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
          {{ error }}
        </div>
      </div>
      
      <!-- 输入区域 -->
      <ChatInput @send="handleSendMessage" :disabled="isLoading" />
    </div>
  </div>
</template>