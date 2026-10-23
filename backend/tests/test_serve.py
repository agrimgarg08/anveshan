"""Verify that interactive startup passes the key to the reload supervisor."""

from contextlib import redirect_stderr, redirect_stdout
from io import StringIO
import os
import unittest
from unittest.mock import patch

from backend.src.api.serve import main


class LauncherTests(unittest.TestCase):
    def test_key_is_present_before_reload_supervisor_starts_and_is_not_printed(self):
        output = StringIO()
        key = 'launcher-test-secret'

        def start(*args, **kwargs):
            self.assertEqual(os.environ['GEMINI_API_KEY'], key)
            self.assertEqual(args[0], 'backend.src.api.main:app')
            self.assertTrue(kwargs['reload'])
            self.assertEqual(kwargs['port'], 8001)

        with patch.dict(os.environ, {'GEMINI_API_KEY': 'old-value'}):
            with patch('backend.src.api.serve.getpass', return_value=f' {key} '):
                with patch('backend.src.api.serve.uvicorn.run', side_effect=start) as run:
                    with redirect_stdout(output):
                        main(['--reload'])
        run.assert_called_once()
        self.assertIn('Inference revision:', output.getvalue())
        self.assertNotIn(key, output.getvalue())

    def test_empty_key_stops_before_starting_server(self):
        with patch('backend.src.api.serve.getpass', return_value='  '):
            with patch('backend.src.api.serve.uvicorn.run') as run:
                with redirect_stderr(StringIO()):
                    with self.assertRaises(SystemExit):
                        main([])
        run.assert_not_called()


if __name__ == '__main__':
    unittest.main()
