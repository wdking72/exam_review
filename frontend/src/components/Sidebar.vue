<script setup lang="ts">
</script>

<template>
  <div class="bg-background-secondary border-r border-gray-200 p-4 flex flex-col">
    <div class="mb-6">
      <h2 class="text-lg font-semibold text-text-primary font-display">对话列表</h2>
      <p class="text-sm text-text-secondary mt-1">管理你的学习会话</p>
    </div>
    
    <div class="flex-1 space-y-2">
      <div class="p-3 bg-white rounded-lg border border-gray-200 cursor-pointer hover:border-accent-primary hover:shadow-sm transition-all duration-200">
        <div class="font-medium text-text-primary">新对话</div>
        <div class="text-sm text-text-secondary mt-1">开始新的学习会话</div>
      </div>
    </div>
    
    <div class="mt-4 pt-4 border-t border-gray-200">
      <div class="text-xs text-text-secondary">
        <div class="flex items-center space-x-2">
          <div class="w-2 h-2 bg-accent-secondary rounded-full"></div>
          <span>专注模式已启用</span>
        </div>
      </div>
    </div>
  </div>
</template>