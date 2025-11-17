import re
import os

pages_dir = r'D:\Coding\Proj\ScoreManagerForSchoolNext-v1.1.1\frontend\src\pages'

# 需要处理的页面列表
pages_to_fix = [
    'ScoresPageEnhanced.tsx',  # 已处理，但再次确认
    'SettingsPage.tsx',
    'StudentsPage.tsx',
    'TeachersPage.tsx',
    'ScoresPage.tsx',
    'LectureRecordsPage.tsx',
    'PendingRecordsPage.tsx',
    'BackupPage.tsx',
    'DataImportPage.tsx',
    'FirstLoginSetupPage.tsx',
    'ImportExportPage.tsx',
    'ImportExportPageEnhanced.tsx',
    'StudentsPageEnhanced.tsx',
    'TeachersPageEnhanced.tsx'
]

def fix_page(file_path):
    """修复单个页面文件"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original_content = content
        
        # 1. 移除 MessageBar imports
        content = re.sub(r',?\s*MessageBar,?', '', content)
        content = re.sub(r',?\s*MessageBarBody,?', '', content)
        
        # 2. 添加 useToast import (如果还没有)
        if 'useToast' not in content and 'MessageBar' in original_content:
            # 找到 services/api import
            content = re.sub(
                r"(import.*from\s+['\"]\.\.\/services\/api['\"];)",
                r"\1\nimport { useToast } from '../utils/toast';",
                content
            )
        
        # 3. 在组件中添加 showToast hook
        if 'const { showToast } = useToast()' not in content and 'MessageBar' in original_content:
            # 查找组件定义后的第一个 const
            content = re.sub(
                r"(const\s+\w+:\s*React\.FC.*?=.*?\{\s*)(const styles)",
                r"\1const { showToast } = useToast();\n  \2",
                content,
                count=1
            )
        
        # 4. 移除 error 和 success state
        content = re.sub(r"const \[error, setError\] = useState\(''\);?\s*", '', content)
        content = re.sub(r"const \[success, setSuccess\] = useState\(''\);?\s*", '', content)
        
        # 5. 替换 setError 调用
        content = re.sub(r"setError\(''\);?\s*", '', content)
        content = re.sub(r"setError\('([^']+)'\);", r"showToast({ title: '错误', body: '\1', intent: 'error' });", content)
        content = re.sub(r"setError\(err\.response\?\.data\?\.error \|\| '([^']+)'\);", r"showToast({ title: '错误', body: err.response?.data?.error || '\1', intent: 'error' });", content)
        content = re.sub(r'setError\("([^"]+)" \+ err\.message\);', r"showToast({ title: '错误', body: '\1' + err.message, intent: 'error' });", content)
        
        # 6. 替换 setSuccess 调用
        content = re.sub(r"setSuccess\(''\);?\s*", '', content)
        content = re.sub(r"setSuccess\('([^']+)'\);", r"showToast({ title: '成功', body: '\1', intent: 'success' });", content)
        content = re.sub(r'setSuccess\(successMsg\);', r"showToast({ title: '成功', body: successMsg, intent: 'success' });", content)
        content = re.sub(r'setSuccess\(`([^`]+)`\);', r'showToast({ title: "成功", body: `\1`, intent: "success" });', content)
        
        # 7. 移除 MessageBar 显示代码
        content = re.sub(r'\{error && \(\s*<MessageBar[^>]*>.*?</MessageBar>\s*\)\}', '', content, flags=re.DOTALL)
        content = re.sub(r'\{success && \(\s*<MessageBar[^>]*>.*?</MessageBar>\s*\)\}', '', content, flags=re.DOTALL)
        
        # 8. 替换静态 MessageBar 为 div
        content = re.sub(r'<MessageBar intent="error">\s*<MessageBarBody>', '<div style={{ padding: "12px", backgroundColor: "var(--colorPaletteRedBackground2)", borderRadius: "4px", marginBottom: "16px" }}>', content)
        content = re.sub(r'<MessageBar intent="info"[^>]*>\s*<MessageBarBody>', '<div style={{ padding: "12px", backgroundColor: "var(--colorNeutralBackground3)", borderRadius: "4px", marginTop: "12px" }}>', content)
        content = re.sub(r'<MessageBar intent="warning"[^>]*>\s*<MessageBarBody>', '<div style={{ padding: "12px", backgroundColor: "var(--colorPaletteYellowBackground2)", borderRadius: "4px", marginBottom: "16px" }}>', content)
        content = re.sub(r'<MessageBar intent="success"[^>]*>\s*<MessageBarBody>', '<div style={{ padding: "12px", backgroundColor: "var(--colorPaletteGreenBackground2)", borderRadius: "4px", marginTop: "16px" }}>', content)
        content = re.sub(r'</MessageBarBody>\s*</MessageBar>', '</div>', content)
        
        # 9. 删除 setTimeout setError
        content = re.sub(r'setTimeout\(\(\) => setError\([^)]*\), \d+\);?\s*', '', content)
        
        # 仅在内容有变化时写入
        if content != original_content:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            return True
        return False
        
    except Exception as e:
        print(f'✗ Error processing {os.path.basename(file_path)}: {e}')
        return False

# 处理所有页面
fixed_count = 0
for page in pages_to_fix:
    file_path = os.path.join(pages_dir, page)
    if os.path.exists(file_path):
        print(f'Processing {page}...', end=' ')
        if fix_page(file_path):
            print('✓ Fixed')
            fixed_count += 1
        else:
            print('- No changes needed')
    else:
        print(f'✗ {page} not found')

print(f'\n✓ Fixed {fixed_count} page(s)')
