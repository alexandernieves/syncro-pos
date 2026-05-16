import os
import re

def fix_files():
    root_dir = '/Users/alexandernieves/Desktop/pos/frontend'
    target_url = 'http://localhost:9000'
    
    # Regex to match "http://localhost:9000/..." or 'http://localhost:9000/...'
    # and replace with `${API_URL}/...`
    pattern = re.compile(r'["\']' + re.escape(target_url) + r'(.*?)["\']')
    
    for root, dirs, files in os.walk(root_dir):
        if any(d in root for d in ['node_modules', '.next', 'out', 'scratch']):
            continue
            
        for file in files:
            if file.endswith(('.tsx', '.ts')) and file != 'constants.ts':
                file_path = os.path.join(root, file)
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                # Check if it has the target URL or if it was partially fixed
                if target_url in content or '${API_URL}' in content:
                    print(f"Fixing {file_path}")
                    
                    # Fix partial replacements from previous run
                    # e.g. `${API_URL}/auth/login"
                    content = re.sub(r'\$\{API_URL\}(.*?)["\']', r'`${API_URL}\1`', content)
                    
                    # Fix original hardcoded ones
                    new_content = pattern.sub(r'`${API_URL}\1`', content)
                    
                    # Add import if not present
                    if 'import { API_URL }' not in new_content and 'API_URL' in new_content:
                        import_match = re.search(r'^import .*$', new_content, re.MULTILINE)
                        if import_match:
                            pos = import_match.end()
                            new_content = new_content[:pos] + '\nimport { API_URL } from "@/lib/constants"' + new_content[pos:]
                    
                    with open(file_path, 'w', encoding='utf-8') as f:
                        f.write(new_content)

if __name__ == "__main__":
    fix_files()
