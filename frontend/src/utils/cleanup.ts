// 清理脚本：移除旧版本残留的 localStorage 数据
// 在浏览器控制台中运行此脚本，或在前端代码中调用一次

export function cleanupOldLocalStorageData() {
  const keysToRemove = [
    'pendingRecords',  // 旧版本的待处理记录
  ];
  
  let removedCount = 0;
  
  keysToRemove.forEach(key => {
    if (localStorage.getItem(key)) {
      localStorage.removeItem(key);
      removedCount++;
      console.log(`✓ 已移除旧数据: ${key}`);
    }
  });
  
  if (removedCount > 0) {
    console.log(`\n🧹 清理完成！已移除 ${removedCount} 个旧数据项`);
    console.log('请刷新页面以查看效果');
  } else {
    console.log('✓ 无需清理，localStorage 中没有旧数据');
  }
}

// 可以在浏览器控制台手动调用：cleanupOldLocalStorageData()
// 或在应用启动时自动调用一次
