"""Immutable GitHub archive fetch; sanctioned gh authentication, no token argv."""
import io
from pathlib import Path
import re
import subprocess
import tarfile

def fetch(repo, sha, target, prefix=''):
    if not re.fullmatch(r'CultureReset/[A-Za-z0-9_.-]+', repo) or not re.fullmatch(r'[0-9a-f]{40}', sha):
        raise ValueError('Repository/immutable commit not approved')
    result = subprocess.run(['gh', 'api', f'repos/{repo}/tarball/{sha}'], capture_output=True)
    if result.returncode:
        raise RuntimeError('Authenticated GitHub source fetch failed (credentials not printed)')
    target = Path(target)
    target.mkdir(parents=True, exist_ok=True)
    count = 0
    with tarfile.open(fileobj=io.BytesIO(result.stdout), mode='r:gz') as archive:
        for member in archive.getmembers():
            parts = Path(member.name).parts[1:]
            if '..' in parts or not parts:
                raise ValueError('Unsafe archive path')
            path = '/'.join(parts)
            if prefix:
                if not path.startswith(prefix.rstrip('/')+'/'):
                    continue
                path = path[len(prefix.rstrip('/'))+1:]
            if not member.isfile():
                if member.issym() or member.islnk():
                    raise ValueError('Source archive symlinks are not installed')
                continue
            if member.size > 4_000_000:
                raise ValueError('Unexpected oversized source file')
            dest = target / path
            dest.parent.mkdir(parents=True, exist_ok=True)
            dest.write_bytes(archive.extractfile(member).read())
            dest.chmod(0o755 if member.mode & 0o111 else 0o644)
            count += 1
    if not count:
        raise ValueError('Expected source payload absent')
    return count

if __name__ == '__main__':
    import tempfile,sys,shutil,importlib.util
    with tempfile.TemporaryDirectory(prefix='node-component-install-') as temporary:
        runtime=Path(temporary)
        fetch('CultureReset/node-kit-runtime','22b20a47c9592adc19af82f1e1bf3dd35a92c431',runtime)
        target=runtime/'components'/'boxes'
        target.parent.mkdir(parents=True,exist_ok=True)
        shutil.copytree(Path(__file__).parent/'payload',target)
        sys.path.insert(0,str(runtime))
        spec=importlib.util.spec_from_file_location('node_kit_runtime',runtime/'kit.py')
        module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
        try:sys.exit(module.main(['boxes',*sys.argv[1:]]))
        except module.GateError as exc:
            print(str(exc),file=sys.stderr);sys.exit(2)
