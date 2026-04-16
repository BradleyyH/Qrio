# QR Code Generator

Generates stylish QR codes made of circle dots with an optional logo in the centre.

## Requirements

Python 3 and two packages:

```bash
pip3 install qrcode Pillow
```

> **Note:** If your logo is a PDF, convert it to PNG first using the macOS built-in `sips` tool:
> ```bash
> sips -s format png "Logos/your_logo.pdf" --out "Logos/your_logo.png"
> ```

## Usage

```bash
python3 qr_generator.py --url "https://yourwebsite.com" --logo "Logos/your_logo.png"
```

The output is saved as `qr_output.png` in the same directory by default.

## Options

| Flag | Description | Default |
|------|-------------|---------|
| `--url` | URL or text to encode | `https://example.com` |
| `--logo` | Path to logo image (PNG) | *(none)* |
| `--output` | Output filename | `qr_output.png` |
| `--cell` | Pixels per QR cell — higher = larger image | `20` |
| `--fg` | Foreground (dot) colour as hex | `#1a1a2e` |
| `--bg` | Background colour as hex | `#ffffff` |

## Examples

**Basic — no logo:**
```bash
python3 qr_generator.py --url "https://momentmuse.co.uk"
```

**With a logo:**
```bash
python3 qr_generator.py --url "https://momentmuse.co.uk" --logo "Logos/logo.png"
```

**Custom output filename:**
```bash
python3 qr_generator.py --url "https://momentmuse.co.uk" --logo "Logos/logo.png" --output momentmuse_qr.png
```

**Custom brand colours:**
```bash
python3 qr_generator.py --url "https://momentmuse.co.uk" --logo "Logos/logo.png" --fg "#2d1b69" --bg "#ffffff"
```

**Higher resolution (larger file):**
```bash
python3 qr_generator.py --url "https://momentmuse.co.uk" --logo "Logos/logo.png" --cell 30
```

## Hardcoded defaults

If you prefer not to use command-line flags, you can edit the defaults at the top of `qr_generator.py`:

```python
DEFAULT_URL  = "https://example.com"
DEFAULT_LOGO = ""               # leave empty for no logo
DEFAULT_OUT  = "qr_output.png"
```

Then run without any arguments:

```bash
python3 qr_generator.py
```

## Output

The generated PNG is saved at 300 DPI, suitable for print and digital use. A typical output is around 740–820px square at the default cell size.
