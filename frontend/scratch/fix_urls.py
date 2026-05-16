import os
import re

def fix_files():
    root_dir = '/Users/alexandernieves/Desktop/pos/frontend'
    target_url = 'http://localhost:9000'
    
    for root, dirs, files in os.walk(root_dir):
        if 'node_modules' in dirs:
            dirs.remove('node_modules')
        if '.next' in dirs:
            dirs.remove('.next')
        if 'out' in dirs:
            dirs.remove('out')
            
        for file in files:
            if file.endswith(('.tsx', '.ts')):
                file_path = os.path.join(root, file)
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                if target_url in content:
                    print(f"Fixing {file_path}")
                    # Replace "http://localhost:9000" with `${API_URL}`
                    # and handle the quotes
                    new_content = content.replace(f'"{target_url}', '`${API_URL}')
                    new_content = new_content.replace(f"'{target_url}", '`${API_URL}')
                    
                    # Add import if not present
                    if 'import { API_URL }' not in new_content:
                        # Find the first import and add it after
                        import_match = re.search(r'^import .*$', new_content, re.MULTILINE)
                        if import_match:
                            pos = import_match.end()
                            # Check if the import path needs to be adjusted
                            # For simplicity, we use @/lib/constants
                            new_content = new_content[:pos] + '\nimport { API_URL } from "@/lib/constants"' + new_content[pos:]
                    
                    with open(file_path, 'w', encoding='utf-8') as f:
                        f.write(new_content)

if __name__ == "__main__":
    fix_files()
