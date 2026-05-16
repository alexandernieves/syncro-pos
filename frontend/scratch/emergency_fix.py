import os
import re

def fix_catastrophic_urls():
    root_dir = '/Users/alexandernieves/Desktop/pos/frontend'
    
    # Files we want to check
    # We'll walk through the whole directory but skip node_modules, .next, out
    
    for root, dirs, files in os.walk(root_dir):
        if any(d in root for d in ['node_modules', '.next', 'out', 'scratch']):
            continue
            
        for file in files:
            if file.endswith(('.tsx', '.ts')):
                file_path = os.path.join(root, file)
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                # Pattern 1: Nested or broken const API definitions
                # Matches: const API = process.env.NEXT_PUBLIC_API_URL || "..."; (with various degrees of nesting)
                new_content = re.sub(
                    r'const API = process\.env\.NEXT_PUBLIC_API_URL \|\| "[^"]*process\.env\.NEXT_PUBLIC_API_URL[^"]*";?',
                    'const API = API_URL;',
                    content
                )
                
                # Pattern 2: Triple backticks or double backticks at start of fetch
                # Matches: fetch(``${API_URL} or fetch(```${API_URL}
                new_content = re.sub(
                    r'fetch\(`+?(\$\{API_URL\})',
                    r'fetch(`\1',
                    new_content
                )
                
                # Pattern 3: Broken template literals with process.env
                # Matches: `${process.env.NEXT_PUBLIC_API_URL || "...`}`
                new_content = re.sub(
                    r'\$\{process\.env\.NEXT_PUBLIC_API_URL \|\| "[^"]*?"\}',
                    r'${API_URL}',
                    new_content
                )

                # Pattern 4: Residual double backticks from previous script
                new_content = new_content.replace('|| ``', '|| `')
                
                # Pattern 5: Specific broken strings from the log
                broken_string = '"${process.env.NEXT_PUBLIC_API_URL || `${API_URL}`}"'
                new_content = new_content.replace(broken_string, '`${API_URL}`')
                
                # Pattern 6: Fix the one in register-form.tsx specifically if needed
                # await fetch(``${API_URL}/auth/register`
                new_content = new_content.replace('fetch(``${API_URL}', 'fetch(`${API_URL}')

                if new_content != content:
                    print(f"Fixing {file_path}")
                    with open(file_path, 'w', encoding='utf-8') as f:
                        f.write(new_content)

if __name__ == "__main__":
    fix_catastrophic_urls()
