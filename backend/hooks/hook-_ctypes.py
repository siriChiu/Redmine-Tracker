"""Bundle the native libffi dependency required by Python's _ctypes module."""

from pathlib import Path
import sys


DLL_NAMES = ("libffi-8.dll", "libffi-7.dll", "libffi-6.dll", "ffi.dll")


def candidate_directories() -> list[Path]:
    roots = {Path(sys.prefix), Path(sys.base_prefix)}
    directories: list[Path] = []
    for root in roots:
        directories.extend((root / "DLLs", root / "Library" / "bin", root))
    return directories


runtime_dll = next(
    (
        directory / name
        for directory in candidate_directories()
        for name in DLL_NAMES
        if (directory / name).is_file()
    ),
    None,
)

if runtime_dll is None:
    searched = ", ".join(str(path) for path in candidate_directories())
    raise RuntimeError(
        "Unable to locate the libffi runtime required by _ctypes. "
        f"Searched: {searched}"
    )

binaries = [(str(runtime_dll), ".")]
