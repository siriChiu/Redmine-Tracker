import re
import sys
from pathlib import Path, PurePosixPath

from PyInstaller.archive.readers import CArchiveReader


FFI_DLL_PATTERN = re.compile(r"^(?:lib)?ffi(?:-\d+)?\.dll$", re.IGNORECASE)


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("Usage: verify_pyinstaller_runtime.py <backend.exe>")

    executable = Path(sys.argv[1]).resolve()
    if not executable.is_file():
        raise SystemExit(f"PyInstaller executable not found: {executable}")

    archive = CArchiveReader(str(executable))
    names = [PurePosixPath(name.replace("\\", "/")).name for name in archive.toc]

    if "_ctypes.pyd" not in {name.lower() for name in names}:
        raise SystemExit("PyInstaller archive is missing _ctypes.pyd")

    ffi_dlls = sorted(name for name in names if FFI_DLL_PATTERN.match(name))
    if not ffi_dlls:
        raise SystemExit(
            "PyInstaller archive contains _ctypes.pyd but no libffi runtime DLL"
        )

    print(f"Verified PyInstaller ctypes runtime: {', '.join(ffi_dlls)}")


if __name__ == "__main__":
    main()
