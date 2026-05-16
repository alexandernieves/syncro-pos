import os
import re

def final_cleanup():
    root_dir = '/Users/alexandernieves/Desktop/pos/frontend'
    
    for root, dirs, files in os.walk(root_dir):
        if any(d in root for d in ['node_modules', '.next', 'out', 'scratch']):
            continue
            
        for file in files:
            if file.endswith(('.tsx', '.ts')):
                file_path = os.path.join(root, file)
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                # Replace: const API = process.env.NEXT_PUBLIC_API_URL || `${API_URL}`;
                # with: const API = API_URL;
                new_content = re.sub(
                    r'const API = process\.env\.NEXT_PUBLIC_API_URL \|\| `\$\{API_URL\}`;?',
                    'const API = API_URL;',
                    content
                )
                
                if new_content != content:
                    print(f"Cleaning up {file_path}")
                    with open(file_path, 'w', encoding='utf-8') as f:
                        f.write(new_content)

if __name__ == "__main__":
    final_cleanup()
