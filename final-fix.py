import re

files_to_fix = {
    r'D:\Coding\Proj\ScoreManagerForSchoolNext-v1.1.1\frontend\src\pages\LectureRecordsPage.tsx': [
        (r'  MessageBarTitle,\s*\n', ''),
        (r'const { showToast } = useToast\(\);', 'const { showToast } = useToast();'),
        (r'  const \[error, setError\] = useState<string \| null>\(null\);', '')
    ],
    r'D:\Coding\Proj\ScoreManagerForSchoolNext-v1.1.1\frontend\src\pages\PendingRecordsPage.tsx': [
        (r'setError\(err\.message \|\| \'批量添加失败\'\);', "showToast({ title: '错误', body: err.message || '批量添加失败', intent: 'error' });")
    ],
    r'D:\Coding\Proj\ScoreManagerForSchoolNext-v1.1.1\frontend\src\pages\StudentsPage.tsx': [
        (r'setError\(errorMessage\);', "showToast({ title: '错误', body: errorMessage, intent: 'error' });")
    ],
    r'D:\Coding\Proj\ScoreManagerForSchoolNext-v1.1.1\frontend\src\pages\TeachersPage.tsx': [
        (r'setError\(errorMessage\);', "showToast({ title: '错误', body: errorMessage, intent: 'error' });")
    ],
    r'D:\Coding\Proj\ScoreManagerForSchoolNext-v1.1.1\frontend\src\pages\ScoresPageEnhanced.tsx': [
        (r'setError\(\'读取Excel文件失败: \' \+ err\.message\);', "showToast({ title: '错误', body: '读取Excel文件失败: ' + err.message, intent: 'error' });"),
        (r'<div style="([^"]+)">', lambda m: '<div style={{ ' + ', '.join([f'{k.strip()}: "{v.strip()}"' for k, v in [p.split(':') for p in m.group(1).split(';') if ':' in p]]) + ' }}>') 
    ]
}

for file_path, replacements in files_to_fix.items():
    try:
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        for pattern, repl in replacements:
            if callable(repl):
                content = re.sub(pattern, repl, content)
            else:
                content = re.sub(pattern, repl, content)
        
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        
        print(f'✓ Fixed {file_path.split(chr(92))[-1]}')
    except Exception as e:
        print(f'✗ Error fixing {file_path.split(chr(92))[-1]}: {e}')

# 特殊处理 ScoresPageEnhanced 的 style 属性
file_path = r'D:\Coding\Proj\ScoreManagerForSchoolNext-v1.1.1\frontend\src\pages\ScoresPageEnhanced.tsx'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 将所有 style="..." 改为 style={{...}}
def fix_style(match):
    style_str = match.group(1)
    props = [p.strip() for p in style_str.split(';') if p.strip() and ':' in p]
    style_obj = ', '.join([f'{k.strip()}: "{v.strip()}"' for p in props for k, v in [p.split(':', 1)]])
    return f'style={{{{ {style_obj} }}}}'

content = re.sub(r'style="([^"]+)"', fix_style, content)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print('✓ Fixed all style attributes in ScoresPageEnhanced.tsx')
