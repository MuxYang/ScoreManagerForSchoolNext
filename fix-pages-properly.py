import re
import os
import sys

pages_dir = r'D:\Coding\Proj\ScoreManagerForSchoolNext-v1.1.1\frontend\src\pages'

# 需要修复的页面列表
pages_to_fix = [
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
    'ImportExportPageEnhanced.tsx'
]

def fix_page_properly(file_path):
    """正确修复单个页面文件"""
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        original_content = content
        
        # 1. 移除 MessageBar imports (更精确的匹配)
        content = re.sub(r',\s*MessageBar\s*,', ',', content)
        content = re.sub(r',\s*MessageBarBody\s*,', ',', content)
        content = re.sub(r'MessageBar\s*,\s*', '', content)
        content = re.sub(r'MessageBarBody\s*,\s*', '', content)
        content = re.sub(r',\s*MessageBar\s*}', '}', content)
        content = re.sub(r',\s*MessageBarBody\s*}', '}', content)
        
        # 2. 添加 useToast import (如果还没有)
        if 'useToast' not in content:
            # 找到最后一个 from '../services/api' 或类似的 import
            content = re.sub(
                r"(import.*from\s+['\"]\.\.\/services\/api['\"];)",
                r"\1\nimport { useToast } from '../utils/toast';",
                content,
                count=1
            )
        
        # 3. 在组件中添加 showToast hook (如果还没有)
        if 'const { showToast } = useToast()' not in content:
            # 查找组件定义后的位置
            content = re.sub(
                r"(const\s+\w+:\s*React\.FC.*?=.*?\(\).*?\{\s*)(const)",
                r"\1const { showToast } = useToast();\n  \2",
                content,
                count=1,
                flags=re.DOTALL
            )
        
        # 4. 移除 error 和 success state
        content = re.sub(r"\s*const \[error, setError\] = useState<string>\(''\);", '', content)
        content = re.sub(r"\s*const \[error, setError\] = useState\(''\);", '', content)
        content = re.sub(r"\s*const \[success, setSuccess\] = useState<string>\(''\);", '', content)
        content = re.sub(r"\s*const \[success, setSuccess\] = useState\(''\);", '', content)
        
        # 5. 替换 setError 调用
        content = re.sub(r"setError\(''\);?\s*\n?", '', content)
        content = re.sub(r"setError\('([^']+)'\);", r"showToast({ title: '错误', body: '\1', intent: 'error' });", content)
        content = re.sub(r"setError\(err\.response\?\.data\?\.error \|\| '([^']+)'\);", r"showToast({ title: '错误', body: err.response?.data?.error || '\1', intent: 'error' });", content)
        content = re.sub(r'setError\((["\'])(.+?)\1 \+ err\.message\);', r"showToast({ title: '错误', body: \1\2\1 + err.message, intent: 'error' });", content)
        
        # 6. 替换 setSuccess 调用
        content = re.sub(r"setSuccess\(''\);?\s*\n?", '', content)
        content = re.sub(r"setSuccess\('([^']+)'\);", r"showToast({ title: '成功', body: '\1', intent: 'success' });", content)
        content = re.sub(r'setSuccess\(`([^`]+)`\);', r'showToast({ title: "成功", body: `\1`, intent: "success" });', content)
        
        # 7. 删除 setTimeout setError/setSuccess (保留完整语句)
        content = re.sub(r'setTimeout\(\(\) => setError\([^)]*\), \d+\);\s*\n?', '', content)
        content = re.sub(r'setTimeout\(\(\) => setSuccess\([^)]*\), \d+\);\s*\n?', '', content)
        
        # 8. 移除顶部的 MessageBar 显示代码 (条件渲染)
        content = re.sub(
            r'\{error && \(\s*<MessageBar[^>]*>.*?</MessageBar>\s*\)\}\s*\n?',
            '',
            content,
            flags=re.DOTALL
        )
        content = re.sub(
            r'\{success && \(\s*<MessageBar[^>]*>.*?</MessageBar>\s*\)\}\s*\n?',
            '',
            content,
            flags=re.DOTALL
        )
        
        # 9. 替换静态 MessageBar 为 styled div (保留内容)
        # 匹配 <MessageBar ...><MessageBarBody>内容</MessageBarBody></MessageBar>
        def replace_messagebar(match):
            intent = match.group(1) or 'info'
            inner_content = match.group(2)
            
            color_map = {
                'error': 'var(--colorPaletteRedBackground2)',
                'success': 'var(--colorPaletteGreenBackground2)',
                'warning': 'var(--colorPaletteYellowBackground2)',
                'info': 'var(--colorNeutralBackground3)'
            }
            
            bg_color = color_map.get(intent, 'var(--colorNeutralBackground3)')
            
            return f'<div style={{{{ padding: "12px", backgroundColor: "{bg_color}", borderRadius: "4px", marginTop: "12px" }}}}>{inner_content}</div>'
        
        # 匹配各种 MessageBar 模式
        content = re.sub(
            r'<MessageBar\s+intent="(error|success|warning|info)"[^>]*>\s*<MessageBarBody>\s*(.*?)\s*</MessageBarBody>\s*</MessageBar>',
            replace_messagebar,
            content,
            flags=re.DOTALL
        )
        
        # 仅在内容有变化时写入
        if content != original_content:
            with open(file_path, 'w', encoding='utf-8', newline='\n') as f:
                f.write(content)
            return True
        return False
        
    except Exception as e:
        print(f'✗ Error processing {os.path.basename(file_path)}: {e}')
        import traceback
        traceback.print_exc()
        return False

# 处理所有页面
fixed_count = 0
for page in pages_to_fix:
    file_path = os.path.join(pages_dir, page)
    if os.path.exists(file_path):
        print(f'Processing {page}...', end=' ')
        if fix_page_properly(file_path):
            print('✓ Fixed')
            fixed_count += 1
        else:
            print('- No changes needed')
    else:
        print(f'✗ {page} not found')

print(f'\n✓ Fixed {fixed_count} page(s)')
