import pathlib
import sys

# Make the backend package modules (config, routing, hydrology, ...) importable
# when pytest is invoked from the repository root.
BACKEND_ROOT = pathlib.Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))
