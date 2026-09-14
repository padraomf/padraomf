"""Local-only preview for macOS/Linux or Windows with Python installed."""
from pathlib import Path
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from functools import partial
import webbrowser
root=Path(__file__).resolve().parents[1]
folder=root if (root/'index.html').is_file() else root/'dist'
server=ThreadingHTTPServer(('127.0.0.1',0),partial(SimpleHTTPRequestHandler,directory=str(folder)))
url=f'http://127.0.0.1:{server.server_port}/'
print(f'Padrão MF — {url}\nMantenha esta janela aberta. Ctrl+C encerra o site.')
webbrowser.open(url)
try:server.serve_forever()
except KeyboardInterrupt:server.server_close()
