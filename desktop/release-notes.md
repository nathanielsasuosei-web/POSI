POSI for Windows: pharmacy point of sale, stock, sales, expenses, staff and reports. It works fully offline.

### Which file do I download?

| Your Windows | Download |
| --- | --- |
| 64-bit (most computers) | **POSI-Setup-{{version}}-64-bit.exe** |
| 32-bit | **POSI-Setup-{{version}}-32-bit.exe** |

Not sure? Start with the 64-bit installer. If it says **“64-bit Windows is required”**, download the 32-bit one instead. You can also check **Control Panel → System → System type**.

Runs on **Windows 7 SP1, 8, 8.1, 10 and 11**.

### Install

1. Open the downloaded file.
2. If Windows shows **“Windows protected your PC”**, click **More info**, then **Run anyway**. POSI is not code-signed yet.
3. Follow the installer. POSI opens when it finishes, with shortcuts on the desktop and in the Start menu.

### Good to know

- Works without internet. Records are saved only on this computer (in `%APPDATA%\POSI`), separately from the POSI website in a browser.
- **Updating:** run the newer installer. Your records are kept. Uninstalling keeps them too.
- **Back up often:** Settings → Data & security → Export JSON, then copy the file to a USB drive.
- **Blank window on an older PC?** Right-click the POSI shortcut → Properties, and add ` --disable-gpu` at the end of **Target**.

To check a download, compare its SHA-256 with `SHA256SUMS.txt`. In Command Prompt: `certutil -hashfile POSI-Setup-{{version}}-64-bit.exe SHA256`
