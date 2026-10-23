"""Start local inference with a hidden key prompt and optional auto reload."""

import argparse
from getpass import getpass
import os
from pathlib import Path

import uvicorn

from . import main as inference


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--reload', action='store_true', help='Reload after backend source edits')
    args = parser.parse_args(argv)
    key = getpass('Paste API key (input hidden): ').strip()
    if not key:
        parser.error('API key cannot be empty')
    os.environ['GEMINI_API_KEY'] = key
    print(f'Inference revision: {inference.INFERENCE_REVISION}', flush=True)
    print(f'Source: {Path(inference.__file__).resolve()}', flush=True)
    uvicorn.run(
        'backend.src.api.main:app', host='127.0.0.1', port=8001,
        reload=args.reload,
        reload_dirs=[str(inference.ROOT / 'src')] if args.reload else None,
    )


if __name__ == '__main__':
    main()
