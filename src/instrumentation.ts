/** 服务启动时注册定时任务（仅 Node.js 运行时） */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./instrumentation-node');
  }
}
