import os
import re

def fix_double_backticks():
    root_dir = '/Users/alexandernieves/Desktop/pos/frontend'
    
    # Correcting the mistake: || ``${API_URL}` -> || `${API_URL}`
    # and also ensuring no other syntax issues were introduced.
    
    for root, dirs, files in os.walk(root_dir):
        if any(d in root for d in ['node_modules', '.next', 'out', 'scratch']):
            continue
            
        for file in files:
            if file.endswith(('.tsx', '.ts')):
                file_path = os.path.join(root, file)
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                if '|| ``' in content or '`${API_URL}"' in content or '`${API_URL}\'' in content:
                    print(f"Fixing {file_path}")
                    
                    # Fix the double backtick typo
                    new_content = content.replace('|| ``', '|| `')
                    
                    # Fix the closing quote issue again just in case (regex to match `${API_URL}...followed by " or ')
                    new_content = re.sub(r'\$\{API_URL\}(.*?)["\']', r'${API_URL}\1`', new_content)
                    
                    # Wait, if I use `${API_URL}/auth/login` it should be balanced.
                    # My previous script did: re.sub(r'\$\{API_URL\}(.*?)["\']', r'`${API_URL}\1`', content)
                    # Which was wrong because it added a backtick at the start too.
                    
                    with open(file_path, 'w', encoding='utf-8') as f:
                        f.write(new_content)

if __name__ == "__main__":
    fix_double_backticks()
