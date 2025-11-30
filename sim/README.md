Tildagon badge simulator
===

This is a little simulator that allows quicker development iteration on Python code.

It's a (C)Python application which sets up its environment so that it appears similar enough to the Badge's micropython environment.

All C-implemented functions are implemented (or maybe just stubbed out) by 'fakes' in the fakes directory. Please try to keep this in sync with the real usermodule implementation.

Of particular interest is how we provide a `ctx`-compatible API: we compile it using emscripten to a WebAssembly bundle, which we then execute using wasmtime.

Setting up
---

You need Python 3.11 or later and Pipenv installed.

Run:
```
pipenv install
```

Running
---

### Desktop Simulator (Python)

From the main firmware code:

```
cd sim
pipenv run python run.py
```

### Web Simulator (Browser)

A proof-of-concept HTML5 Canvas version is available that runs entirely in the browser:

```
cd sim/web
python3 serve.py
```

Then open http://localhost:8000 in your browser.

See `web/README.md` for more details on the web version.

Known Issues
---

## ModuleNotFoundError: No module named '_contextvars'

Try using non-precompiled Python.

Support
---

No support for most things.

Acknowledgements
---

Thank you to the flow3r team, whose simulator this is forked from.
