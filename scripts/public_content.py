"""只遍历公开 Markdown，不进入 Obsidian 配置、插件或数据库目录。"""
import os


def is_link(path):
    return os.path.islink(path) or (hasattr(os.path, 'isjunction') and os.path.isjunction(path))


def markdown_files(directory):
    if is_link(directory):
        raise ValueError('公开内容根目录不能是符号链接或联接')
    for root, dirs, files in os.walk(directory, followlinks=False):
        dirs[:] = [name for name in dirs if not name.startswith('.')
                   and name.lower() != 'node_modules'
                   and not is_link(os.path.join(root, name))]
        for name in files:
            full_path = os.path.join(root, name)
            if not name.startswith('.') and name.lower().endswith('.md') and not is_link(full_path):
                yield full_path
