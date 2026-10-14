"""Puts (or replaces) the Ebano block in the shared Nginx config, before its last "}".

    python3 deploy/nginx-put-ebano.py deploy/nginx-ebanocontrol-http.conf

Only the lines between the Ebano begin/end markers are touched; the other sites stay as they are.
"""
import re
import sys

CONF = '/home/odoo/credinorte/nginx/nginx.conf'
block = open(sys.argv[1]).read().rstrip('\n') + '\n'
text = open(CONF).read()
marked = re.compile(r'\n?[ \t]*# ── Ebano Control \(ebanocontrol\.total-net\.net\) · begin.*?# ── Ebano Control · end[^\n]*\n', re.S)
text = marked.sub('\n', text)
end = text.rstrip().rfind('}')
if end < 0:
    sys.exit('No encontré el cierre del bloque http')
text = text[:end].rstrip('\n') + '\n\n' + block + text[end:]
open(CONF, 'w').write(text)
print('Bloque de Ebano puesto en', CONF)
