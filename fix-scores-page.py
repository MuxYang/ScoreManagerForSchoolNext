import re
import sys

file_path = r'D:\Coding\Proj\ScoreManagerForSchoolNext-v1.1.1\frontend\src\pages\ScoresPageEnhanced.tsx'

try:
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # 替换各种 setError 模式
    content = re.sub(r"setError\(''\);", '', content)
    content = re.sub(r"setError\('([^']+)'\);", r"showToast({ title: '错误', body: '\1', intent: 'error' });", content)
    content = re.sub(r"setError\(err\.response\?\.data\?\.error \|\| '([^']+)'\);", r"showToast({ title: '错误', body: err.response?.data?.error || '\1', intent: 'error' });", content)
    content = re.sub(r'setError\("([^"]+)" \+ err\.message\);', r"showToast({ title: '错误', body: '\1' + err.message, intent: 'error' });", content)
    
    # 替换各种 setSuccess 模式
    content = re.sub(r"setSuccess\(''\);", '', content)
    content = re.sub(r"setSuccess\('([^']+)'\);", r"showToast({ title: '成功', body: '\1', intent: 'success' });", content)
    content = re.sub(r'setSuccess\(successMsg\);', r"showToast({ title: '成功', body: successMsg, intent: 'success' });", content)
    content = re.sub(r'setSuccess\(`([^`]+)`\);', r'showToast({ title: "成功", body: `\1`, intent: "success" });', content)
    
    # 删除 setTimeout setError
    content = re.sub(r'setTimeout\(\(\) => setError\([^)]*\), \d+\);', '', content)
    
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print(f'✓ Successfully replaced in {file_path}')
    
except Exception as e:
    print(f'✗ Error: {e}', file=sys.stderr)
    sys.exit(1)
