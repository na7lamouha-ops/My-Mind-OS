#!/bin/bash
# INSTALLER-MAC.command — installe le bureau « ecom manita » sur ce Mac (sans sudo). Relancer ne casse rien.
cd "$(dirname "$0")" || exit 1
bash "./bureau/installer/installer-mac.sh" "$@"
code=$?
if [ -t 0 ]; then echo; read -r -p "Appuie sur Entree pour fermer cette fenetre..." _; fi
exit $code
