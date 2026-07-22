from pathlib import Path

import yaml


def main() -> None:
    files = sorted(Path(".gitea/workflows").glob("*.yml"))
    files += sorted(Path(".gitea/workflows").glob("*.yaml"))
    files.append(Path("config/settings.example.yaml"))

    for path in files:
        if not path.is_file():
            raise SystemExit(f"Required YAML file is missing: {path}")
        with path.open("r", encoding="utf-8") as stream:
            document = yaml.safe_load(stream)
        if not isinstance(document, dict):
            raise SystemExit(f"YAML root must be a mapping: {path}")
        if ".gitea" in path.parts and "jobs" not in document:
            raise SystemExit(f"Workflow has no jobs mapping: {path}")
        print(f"Validated YAML: {path}")


if __name__ == "__main__":
    main()
