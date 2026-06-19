const requiredEnvVars = ["API_BASE_URL", "API_KEY", "MODEL", "SYSTEM_PROMPT"] as const

export interface AppConfig {
  API_BASE_URL: string
  API_KEY: string
  MODEL: string
  SYSTEM_PROMPT: string
}

export function loadConfig(): AppConfig {
  const missing= requiredEnvVars.filter(key => !process.env[key])
  if (missing.length > 0) {
    console.error(`[Fatal]缺少环境变量：${missing.join(', ')}`)
    console.error('请检查.env.local文件')
    process.exit(1) // 退出程序，返回非0状态码
  }
  return {
    API_BASE_URL: process.env.API_BASE_URL!,
    API_KEY: process.env.API_KEY!,
    MODEL: process.env.MODEL!,
    SYSTEM_PROMPT: process.env.SYSTEM_PROMPT!,
  }
}
