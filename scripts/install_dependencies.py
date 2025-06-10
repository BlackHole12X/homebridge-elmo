
#!/usr/bin/env python3
import subprocess
import sys

def install_package(package):
    try:
        subprocess.check_call([sys.executable, "-m", "pip", "install", package, "--break-system-packages"])
        print(f"Installato {package}")
        return True
    except subprocess.CalledProcessError:
        print(f"Errore durante l'installazione di {package}")
        return False

if __name__ == "__main__":
    packages = ["requests", "econnect-python", "elmo"]
    success = True
    
    for package in packages:
        if not install_package(package):
            success = False
    
    sys.exit(0 if success else 1)
