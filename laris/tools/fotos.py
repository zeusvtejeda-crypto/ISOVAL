#!/usr/bin/env python3
"""Prepara fotos para el sitio de Lari's Bakehouse.

Toma las fotos de una carpeta (por defecto fotos-nuevas/), las endereza según
el EXIF, las recorta a la proporción del lugar donde van, las reduce y las
guarda como .webp ligeras en assets/img/. También puede listar las imágenes
del sitio y decir cuáles no se usan.

Solo necesita Python 3 y Pillow (python3 -m pip install Pillow).
"""

import argparse
import io
import re
import sys
import unicodedata
from pathlib import Path

# --- textos de argparse en español (uso, errores, ayuda) ----------------------
_ES = {
    'usage: ': 'uso: ',
    'options': 'opciones',
    'optional arguments': 'opciones',
    'positional arguments': 'argumentos',
    'show this help message and exit': 'muestra esta ayuda y termina',
    'unrecognized arguments: %s': 'no reconozco estos argumentos: %s',
    'expected one argument': 'falta el valor',
    'invalid choice: %(value)r (choose from %(choices)s)':
        'opción no válida: %(value)r (elige entre %(choices)s)',
    'argument %(argument_name)s: %(message)s': '%(argument_name)s: %(message)s',
    'ambiguous option: %(option)s could match %(matches)s':
        'opción ambigua: %(option)s puede ser %(matches)s',
    'not allowed with argument %s': 'no se puede usar junto con %s',
}
argparse._ = lambda texto: _ES.get(texto, texto)

try:
    from PIL import Image, ImageOps, UnidentifiedImageError
except ImportError:  # pragma: no cover - mensaje para quien no tiene Pillow
    sys.stderr.write(
        'Falta Pillow. Instálalo con:\n'
        '    python3 -m pip install Pillow\n'
    )
    sys.exit(2)

try:  # opcional: solo si alguien instaló pillow-heif por su cuenta
    import pillow_heif  # type: ignore
    pillow_heif.register_heif_opener()
    HEIC_OK = True
except Exception:
    HEIC_OK = False

try:
    from PIL import ImageCms
except Exception:  # Pillow compilado sin littlecms
    ImageCms = None

# Que los acentos y flechas no truenen en consolas que no son UTF-8 (Windows).
for _flujo in (sys.stdout, sys.stderr):
    try:
        _flujo.reconfigure(errors='replace')
    except Exception:
        pass

# --- configuración -------------------------------------------------------------
SITIO = Path(__file__).resolve().parent.parent
ENTRADA = SITIO / 'fotos-nuevas'
SALIDA = SITIO / 'assets' / 'img'

PERFILES = {
    # tipo: (ancho, alto, proporción, dónde se usa)
    'producto': (900, 900, '1:1', 'productos de la carta'),
    'hero': (1200, 1600, '3:4', 'portada (index.html)'),
    'cuaderno': (1000, 1250, '4:5', 'notas del cuaderno'),
    'casa': (1400, 1000, '7:5', 'fotos de visitanos.html'),
}

# (x, y) de 0 a 1: qué parte de la foto se conserva al recortar.
FOCOS = {
    'centro': (0.5, 0.5),
    'arriba': (0.5, 0.0),
    'abajo': (0.5, 1.0),
    'izquierda': (0.0, 0.5),
    'derecha': (1.0, 0.5),
}

EXTENSIONES = {'.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif', '.avif', '.tif', '.tiff'}
HEIC = {'.heic', '.heif'}

CALIDAD = 80
CALIDAD_MIN = 70
PASO_CALIDAD = 2
LIMITE_KB = 180

# Archivos de texto donde se buscan referencias a las imágenes (--listar).
TEXTO_SITIO = {'.html', '.css', '.js', '.webmanifest', '.json', '.xml'}
NO_BUSCAR = {'tools', 'fotos-nuevas', '.git', 'node_modules', '.vercel'}


# --- utilidades ----------------------------------------------------------------
def slug(texto):
    """'Croissant de Mañana (1).JPG' -> 'croissant-de-manana-1'."""
    texto = unicodedata.normalize('NFKD', texto)
    texto = ''.join(c for c in texto if not unicodedata.combining(c))
    texto = re.sub(r'[^a-z0-9]+', '-', texto.lower()).strip('-')
    return re.sub(r'-{2,}', '-', texto)


def kb(n_bytes):
    return n_bytes / 1024


def ruta_corta(ruta):
    """Ruta relativa al sitio si se puede (más legible en la tabla)."""
    try:
        return str(Path(ruta).resolve().relative_to(SITIO))
    except ValueError:
        return str(ruta)


def tabla(filas, encabezado, alinear_derecha=()):
    """Imprime una tabla simple con columnas alineadas."""
    filas = [[str(c) for c in f] for f in filas]
    anchos = [len(h) for h in encabezado]
    for f in filas:
        for i, c in enumerate(f):
            anchos[i] = max(anchos[i], len(c))

    def linea(celdas):
        partes = []
        for i, c in enumerate(celdas):
            if i == len(celdas) - 1:
                partes.append(c)  # la última columna sin relleno
            elif i in alinear_derecha:
                partes.append(c.rjust(anchos[i]))
            else:
                partes.append(c.ljust(anchos[i]))
        return '  ' + '  '.join(partes).rstrip()

    print(linea(encabezado))
    print('  ' + '  '.join('-' * a for a in anchos))
    for f in filas:
        print(linea(f))


# --- procesamiento -------------------------------------------------------------
def a_srgb(img, icc):
    """Convierte la foto a sRGB si trae otro perfil de color (p. ej. Display P3
    de iPhone). Devuelve (imagen, perfil_que_hay_que_conservar_o_None)."""
    if not icc:
        return img, None
    # Si no se puede convertir, el perfil solo se conserva cuando es de color
    # (RGB); uno de gris o CMYK no sirve para el .webp, que siempre sale en RGB.
    conservar = icc if img.mode in ('RGB', 'RGBA') else None
    if ImageCms is None:
        return img, conservar
    try:
        origen = ImageCms.ImageCmsProfile(io.BytesIO(icc))
    except Exception:
        return img, None  # perfil dañado: mejor no incrustarlo
    if img.mode not in ('RGB', 'RGBA', 'CMYK', 'L'):
        return img, conservar
    try:
        destino = ImageCms.createProfile('sRGB')
        modo = 'RGBA' if img.mode == 'RGBA' else 'RGB'
        return ImageCms.profileToProfile(img, origen, destino, outputMode=modo), None
    except Exception:
        return img, conservar


def aplanar(img, fondo):
    """Quita la transparencia poniendo la foto sobre un fondo liso."""
    if img.mode in ('P', 'PA', 'LA', 'La', 'RGBa'):
        img = img.convert('RGBA')
    if img.mode == 'RGBA':
        base = Image.new('RGB', img.size, fondo)
        base.paste(img, mask=img.getchannel('A'))
        return base
    if img.mode != 'RGB':
        img = img.convert('RGB')
    return img


def caja_recorte(ancho, alto, proporcion, foco):
    """Caja (x0, y0, x1, y1) más grande con la proporción pedida."""
    fx, fy = foco
    if ancho / alto > proporcion:          # sobra a los lados
        w, h = alto * proporcion, alto
    else:                                  # sobra arriba/abajo
        w, h = ancho, ancho / proporcion
    w, h = min(w, ancho), min(h, alto)     # redondeo de flotantes: 2000.0000000002
    x0 = max(0.0, (ancho - w) * fx)
    y0 = max(0.0, (alto - h) * fy)
    return (x0, y0, x0 + w, y0 + h)


def codificar(img, icc):
    """Guarda en WebP; si pasa de LIMITE_KB baja la calidad hasta CALIDAD_MIN."""
    calidad = CALIDAD
    while True:
        buf = io.BytesIO()
        opciones = {'quality': calidad, 'method': 6}
        if icc:
            opciones['icc_profile'] = icc
        img.save(buf, 'WEBP', **opciones)
        datos = buf.getvalue()
        if kb(len(datos)) <= LIMITE_KB or calidad <= CALIDAD_MIN:
            return datos, calidad
        calidad = max(CALIDAD_MIN, calidad - PASO_CALIDAD)


def procesar(origen, destino, perfil, foco, fondo):
    """Procesa una foto. Devuelve dict con medidas, peso, calidad y avisos."""
    ancho_obj, alto_obj = perfil[0], perfil[1]
    avisos = []
    with Image.open(origen) as img:
        icc = img.info.get('icc_profile')
        img = ImageOps.exif_transpose(img)      # endereza según el EXIF
        img, icc = a_srgb(img, icc)
        img = aplanar(img, fondo)

        caja = caja_recorte(img.width, img.height, ancho_obj / alto_obj, foco)
        ancho_caja = caja[2] - caja[0]
        escala = min(1.0, ancho_caja / ancho_obj)   # nunca agranda
        final = (max(1, round(ancho_obj * escala)), max(1, round(alto_obj * escala)))
        if escala < 1.0:
            avisos.append('foto chica: queda en %d×%d (mejor una de al menos %d×%d)'
                          % (final[0], final[1], ancho_obj, alto_obj))
        img = img.resize(final, Image.Resampling.LANCZOS, box=caja, reducing_gap=3.0)

    datos, calidad = codificar(img, icc)
    if kb(len(datos)) > LIMITE_KB:
        avisos.append('pesa más de %d KB aun con calidad %d' % (LIMITE_KB, CALIDAD_MIN))
    if icc:
        avisos.append('perfil de color conservado (no se pudo pasar a sRGB)')
    destino.parent.mkdir(parents=True, exist_ok=True)
    destino.write_bytes(datos)
    return {'medidas': final, 'bytes': len(datos), 'calidad': calidad, 'avisos': avisos}


def buscar_entradas(rutas):
    """Expande carpetas a la lista de archivos de imagen (sin subcarpetas)."""
    archivos, ignorados = [], []
    for ruta in rutas:
        ruta = Path(ruta)
        if ruta.is_dir():
            for f in sorted(ruta.iterdir(), key=lambda p: p.name.lower()):
                if f.name.startswith('.') or not f.is_file():
                    continue
                (archivos if f.suffix.lower() in EXTENSIONES else ignorados).append(f)
        elif ruta.is_file():
            archivos.append(ruta)
        else:
            raise FileNotFoundError(ruta)
    return archivos, ignorados


def color_hex(texto):
    texto = texto.strip().lstrip('#')
    if not re.fullmatch(r'[0-9a-fA-F]{6}', texto):
        raise argparse.ArgumentTypeError('usa un color como ffffff o faf6f1')
    return tuple(int(texto[i:i + 2], 16) for i in (0, 2, 4))


def nombre_valido(texto):
    texto = re.sub(r'\.webp$', '', texto.strip(), flags=re.I)
    limpio = slug(texto)
    if not limpio:
        raise argparse.ArgumentTypeError('el nombre debe tener letras o números')
    return limpio


def cmd_procesar(args):
    perfil = PERFILES[args.tipo]
    salida = Path(args.salida)
    rutas = args.fotos or [args.entrada]

    try:
        archivos, ignorados = buscar_entradas(rutas)
    except FileNotFoundError as e:
        print('No encuentro %s' % e.args[0], file=sys.stderr)
        if Path(e.args[0]).resolve() == ENTRADA:
            print('Crea la carpeta fotos-nuevas/ y pon ahí las fotos.', file=sys.stderr)
        return 1

    if args.nombre and len(archivos) > 1:
        print('--nombre solo sirve con una foto, y hay %d. Deja una sola en la '
              'carpeta o indica el archivo: tools/fotos.py fotos-nuevas/foto.jpg '
              '--nombre %s' % (len(archivos), args.nombre), file=sys.stderr)
        return 1

    print('Perfil %s (%s, %d×%d) · foco %s · salida %s/'
          % (args.tipo, perfil[2], perfil[0], perfil[1], args.foco, ruta_corta(salida)))
    if not archivos:
        print('\nNo hay fotos que procesar en %s. Copia ahí las fotos '
              '(jpg, png, webp o heic) y vuelve a correr el script.'
              % ', '.join(ruta_corta(r) + ('/' if Path(r).is_dir() else '') for r in rutas))
        return 0
    print()

    filas, notas = [], []
    hechas = omitidas = errores = 0
    usados = set()
    foco = FOCOS[args.foco]

    for origen in archivos:
        nombre = args.nombre or slug(origen.stem) or 'foto'
        destino = salida / (nombre + '.webp')
        entrada = origen.name

        if origen.suffix.lower() in HEIC and not HEIC_OK:
            filas.append([entrada, '→', '—', '', '', 'no procesada: HEIC no soportado'])
            notas.append('HEIC: este Pillow no abre fotos HEIC de iPhone. Exporta la foto '
                         'como JPG (en el iPhone: Ajustes › Cámara › Formatos › Más compatible, '
                         'o compártela por WhatsApp/correo) o instala pillow-heif: '
                         'python3 -m pip install pillow-heif')
            errores += 1
            continue
        if nombre in usados:
            filas.append([entrada, '→', destino.name, '', '',
                          'omitida: otra foto de esta tanda ya usa ese nombre'])
            omitidas += 1
            continue
        if destino.exists() and not args.forzar:
            filas.append([entrada, '→', destino.name, '', '',
                          'omitida: ya existe (usa --forzar para reemplazarla)'])
            omitidas += 1
            usados.add(nombre)
            continue

        try:
            r = procesar(origen, destino, perfil, foco, args.fondo)
        except Exception as e:  # una foto rota no detiene a las demás
            if isinstance(e, UnidentifiedImageError):
                motivo = 'no se reconoce como imagen'
            else:
                motivo = 'no se pudo leer (%s)' % ((str(e).split('\n')[0] or e.__class__.__name__)[:60])
            filas.append([entrada, '→', '—', '', '', 'error: %s' % motivo])
            errores += 1
            continue

        usados.add(nombre)
        hechas += 1
        nota = 'calidad %d' % r['calidad']
        if r['avisos']:
            nota += ' · ' + ' · '.join(r['avisos'])
        filas.append([entrada, '→', destino.name, '%.0f' % kb(r['bytes']),
                      '%d×%d' % r['medidas'], nota])

    tabla(filas, ['entrada', '', 'salida', 'KB', 'medidas', 'nota'], alinear_derecha={3})

    resumen = '\n%d lista%s' % (hechas, '' if hechas == 1 else 's')
    if omitidas:
        resumen += ' · %d omitida%s' % (omitidas, '' if omitidas == 1 else 's')
    if errores:
        resumen += ' · %d con error' % errores
    if ignorados:
        resumen += ' · ignorados (no son imagen): ' + ', '.join(f.name for f in ignorados)
    print(resumen)
    for n in dict.fromkeys(notas):
        print('\n' + n)

    if hechas and salida.resolve() == SALIDA.resolve():
        print('\nEn el HTML: src="assets/img/<nombre>.webp" width="%d" height="%d".'
              % (perfil[0], perfil[1]))
        print('Si reemplazaste una foto que ya existía, sube el ?v= de su src '
              '(p. ej. pan-02.webp?v=2) para que nadie vea la anterior guardada en caché.')
        print('Ya puedes borrar los originales de fotos-nuevas/ (no los subas al repo).')
    return 1 if errores else 0


# --- --listar --------------------------------------------------------------------
def textos_del_sitio():
    textos = {}
    for f in SITIO.rglob('*'):
        partes = f.relative_to(SITIO).parts
        if any(p in NO_BUSCAR for p in partes[:-1]):
            continue
        if f.is_file() and f.suffix.lower() in TEXTO_SITIO:
            try:
                textos[ruta_corta(f)] = f.read_text(encoding='utf-8', errors='replace')
            except OSError:
                pass
    return textos


def perfil_de(ancho, alto):
    for nombre, (w, h, _, _) in PERFILES.items():
        if abs(ancho / alto - w / h) < 0.01 and ancho >= w / 2:  # íconos chicos no cuentan
            return nombre
    return '—'


def cmd_listar(args):
    carpeta = Path(args.salida)
    if not carpeta.is_dir():
        print('No encuentro la carpeta %s' % carpeta, file=sys.stderr)
        return 1
    textos = textos_del_sitio()
    imagenes = sorted((f for f in carpeta.iterdir() if f.is_file() and not f.name.startswith('.')),
                      key=lambda p: p.name.lower())

    filas, sin_uso, pesadas, total = [], [], [], 0
    for f in imagenes:
        peso = f.stat().st_size
        total += peso
        try:
            with Image.open(f) as img:
                medidas = '%d×%d' % img.size
                perfil = perfil_de(*img.size)
        except Exception:
            medidas, perfil = '—', '—'

        patron = re.compile(r'(?<![A-Za-z0-9_.-])' + re.escape(f.name) + r'(?![A-Za-z0-9_-])')
        donde = [nombre for nombre, texto in sorted(textos.items()) if patron.search(texto)]
        if donde:
            uso = ', '.join(donde[:3]) + (' +%d' % (len(donde) - 3) if len(donde) > 3 else '')
        else:
            uso = 'SIN USO'
            sin_uso.append(f.name)
        if kb(peso) > LIMITE_KB:
            pesadas.append(f.name)
            uso += '  (pesa más de %d KB)' % LIMITE_KB
        filas.append([f.name, medidas, '%.0f' % kb(peso), perfil, uso])

    print('%s/ · %d archivos · %.1f MB\n' % (ruta_corta(carpeta), len(imagenes), total / 1024 / 1024))
    tabla(filas, ['archivo', 'medidas', 'KB', 'perfil', 'usada en'], alinear_derecha={2})
    print('\nSe buscó cada nombre en los .html, .css, .js, .json, .xml y .webmanifest del sitio.')
    if sin_uso:
        print('Sin uso (%d): %s' % (len(sin_uso), ', '.join(sin_uso)))
    else:
        print('Todas las imágenes se usan en alguna página.')
    if pesadas:
        print('Pesadas (%d): %s — puedes volver a procesarlas con este script.'
              % (len(pesadas), ', '.join(pesadas)))
    return 0


# --- línea de comandos -----------------------------------------------------------
def main(argv=None):
    tipos = '\n'.join('  %-9s %s  %4d×%-5d %s' % (t, p[2], p[0], p[1], p[3])
                      for t, p in PERFILES.items())
    parser = argparse.ArgumentParser(
        prog='tools/fotos.py',
        add_help=False,
        formatter_class=argparse.RawDescriptionHelpFormatter,
        description=(
            'Convierte fotos a .webp listas para el sitio: endereza según el EXIF,\n'
            'quita metadatos (incluida la ubicación GPS), recorta a la proporción\n'
            'del lugar donde van y las deja ligeras (calidad 80; si pasan de %d KB\n'
            'baja hasta %d). Por defecto toma todo lo que haya en fotos-nuevas/ y\n'
            'escribe en assets/img/. No reemplaza archivos salvo con --forzar.\n\n'
            'Tipos (--tipo):\n%s' % (LIMITE_KB, CALIDAD_MIN, tipos)
        ),
        epilog=(
            'ejemplos:\n'
            '  python3 tools/fotos.py\n'
            '      procesa todo fotos-nuevas/ como producto (900×900)\n'
            '  python3 tools/fotos.py fotos-nuevas/IMG_2041.jpg --nombre pan-02 --forzar\n'
            '      reemplaza la foto del croissant de mantequilla\n'
            '  python3 tools/fotos.py --tipo hero --foco arriba\n'
            '      fotos verticales para la portada, conservando la parte de arriba\n'
            '  python3 tools/fotos.py --salida /tmp/pruebas\n'
            '      prueba sin tocar assets/img/\n'
            '  python3 tools/fotos.py --listar\n'
            '      lista assets/img/ con medidas, peso y en qué página se usa cada una'
        ),
    )
    parser.add_argument('fotos', nargs='*', metavar='FOTO',
                        help='fotos o carpetas a procesar (por defecto: --entrada)')
    parser.add_argument('-t', '--tipo', choices=list(PERFILES), default='producto',
                        help='dónde va la foto; define recorte y medidas (por defecto: producto)')
    parser.add_argument('--foco', choices=list(FOCOS), default='centro',
                        help='qué parte conservar al recortar (por defecto: centro)')
    parser.add_argument('-n', '--nombre', type=nombre_valido,
                        help='nombre del .webp de salida, p. ej. pan-02 (solo con una foto); '
                             'si no se da, se usa el nombre del archivo sin acentos ni espacios')
    parser.add_argument('--forzar', action='store_true',
                        help='reemplaza el .webp si ya existe')
    parser.add_argument('-e', '--entrada', default=str(ENTRADA), metavar='CARPETA',
                        help='carpeta con las fotos (por defecto: fotos-nuevas/)')
    parser.add_argument('-s', '--salida', default=str(SALIDA), metavar='CARPETA',
                        help='dónde escribir los .webp (por defecto: assets/img/)')
    parser.add_argument('--fondo', type=color_hex, default=(255, 255, 255), metavar='HEX',
                        help='color que reemplaza la transparencia de un PNG (por defecto: ffffff)')
    parser.add_argument('--listar', action='store_true',
                        help='en vez de procesar, lista las imágenes de --salida con medidas y KB '
                             'y marca las que no se usan en el sitio')
    parser.add_argument('-h', '--help', action='help', default=argparse.SUPPRESS,
                        help='muestra esta ayuda y termina')
    args = parser.parse_args(argv)

    if args.listar:
        return cmd_listar(args)
    return cmd_procesar(args)


if __name__ == '__main__':
    try:
        sys.exit(main())
    except KeyboardInterrupt:
        sys.exit(130)
