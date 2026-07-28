import os
import re

base_dir = r"C:/Users/kimmh/VibeCoding/project/SecurityArchive/src/main/java/com/example/security"

def process_file(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    orig_content = content
    filename = os.path.basename(filepath)
    classname = filename.replace('.java', '')
    
    is_dto_entity = '\\dto\\' in filepath or '\\entity\\' in filepath or '/dto/' in filepath or '/entity/' in filepath
    is_service_controller = any(x in filepath for x in ['/service/', '\\service\\', '/controller/', '\\controller\\', '/security/', '\\security\\', '/config/', '\\config\\', '/aspect/', '\\aspect\\'])
    
    if is_dto_entity:
        if '@Getter' not in content:
            # add annotations
            content = re.sub(r'(public class ' + classname + r')', r'@Getter\n@Setter\n@ToString\n\1', content)
            # add imports
            imports = 'import lombok.Getter;\nimport lombok.Setter;\nimport lombok.ToString;\n'
            content = re.sub(r'(package .*;\n)', r'\1\n' + imports, content)
            
            # remove getters
            content = re.sub(r'\s*public [\w<>\[\]]+\s+get[A-Z][a-zA-Z0-9]*\(\)\s*\{\s*return [^;]+;\s*\}', '', content)
            # remove setters
            content = re.sub(r'\s*public void\s+set[A-Z][a-zA-Z0-9]*\([\w<>\[\]]+\s+\w+\)\s*\{\s*this\.\w+\s*=\s*\w+;\s*\}', '', content)
            # multiline getters/setters (if any)
            content = re.sub(r'\s*public [\w<>\[\]]+\s+get[A-Z][a-zA-Z0-9]*\(\)\s*\{[^{}]*\}', '', content)
            content = re.sub(r'\s*public void\s+set[A-Z][a-zA-Z0-9]*\([\w<>\[\]]+\s+\w+\)\s*\{[^{}]*\}', '', content)
            # remove toString
            content = re.sub(r'\s*@Override\s*public String toString\(\)\s*\{[^{}]*\}', '', content)
            content = re.sub(r'\s*public String toString\(\)\s*\{[^{}]*\}', '', content)
            
    if is_service_controller:
        # Check for logger
        if 'LoggerFactory.getLogger' in content:
            content = re.sub(r'\s*private\s+static\s+final\s+Logger\s+\w+\s*=\s*LoggerFactory\.getLogger\([^)]+\);', '', content)
            content = re.sub(r'(public class ' + classname + r')', r'@Slf4j\n\1', content)
            content = re.sub(r'(package .*;\n)', r'\1\nimport lombok.extern.slf4j.Slf4j;\n', content)
            # remove org.slf4j.Logger imports
            content = re.sub(r'import org\.slf4j\.Logger;\n?', '', content)
            content = re.sub(r'import org\.slf4j\.LoggerFactory;\n?', '', content)
        
        # Check for constructor injection
        # usually looks like: public ClassName(Service1 s1, Service2 s2) { this.s1 = s1; this.s2 = s2; }
        # Let's see if we have private final fields
        if 'private final' in content:
            if '@RequiredArgsConstructor' not in content:
                content = re.sub(r'(public class ' + classname + r')', r'@RequiredArgsConstructor\n\1', content)
                if 'import lombok.RequiredArgsConstructor;' not in content:
                    content = re.sub(r'(package .*;\n)', r'\1\nimport lombok.RequiredArgsConstructor;\n', content)
                
                # Try to remove constructor
                # Find public ClassName(...) { ... }
                # A naive regex to match the constructor
                pattern = r'\s*public\s+' + classname + r'\s*\([^)]*\)\s*\{[^{}]*\}'
                content = re.sub(pattern, '', content)

    if content != orig_content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Refactored: {filepath}")

for root, _, files in os.walk(base_dir):
    for f in files:
        if f.endswith('.java'):
            process_file(os.path.join(root, f))
