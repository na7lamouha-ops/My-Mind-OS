#!/bin/bash
# installer-mac.sh — installe le bureau « ecom manita » sur un Mac (macOS 13 ou plus récent), SANS sudo.
# v0.3 (03/10/2026). Écrit pour le bash 3.2 de macOS.
# Ce qu'il installe, chacun VÉRIFIÉ (empreinte SHA-256) avant d'être utilisé, tout dans le dossier du pack (runtime/) :
#   Node.js (officiel nodejs.org)                       — empreinte de SHASUMS256.txt
#   Python 3.13 portable (python-build-standalone)      — empreinte publiée par GitHub
#   les bibliothèques Python des outils                 — numpy, pillow, gdown, arabic-reshaper, python-bidi
#   FFmpeg + FFprobe (builds macOS de martin-riedl.de)  — empreinte .sha256 publiée à côté
#   cloudflared (GitHub Cloudflare)                     — empreinte publiée par GitHub
#   Claude Code (l'installateur officiel)               — puis la connexion au compte Claude du client
# Puis : les réglages (config.local.json, ceux du client ne sont jamais écrasés), le démarrage automatique
# (launchd, sans sudo), le bureau démarré, sa santé lue, l'épreuve verifier.mjs, la page ouverte.
# Chaque étape écrit PASSE / ECHEC dans _ETAT-INSTALLATION.txt ; la dernière ligne dit le VERDICT.
# Relancer l'installateur ne casse rien : ce qui est déjà là et sain est gardé.
#   options : --sans-connexion (ne lance pas la connexion à Claude) · --sans-demarrage (ni launchd ni page)
set -u

INSTALLEUR_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BUREAU="$(cd "$INSTALLEUR_DIR/.." && pwd)"
PACK="$(cd "$BUREAU/.." && pwd)"
RUNTIME="$PACK/runtime"
MAISON="${MANITA_MAISON:-$HOME/ecom-manita-maison}"
ETAT="$PACK/_ETAT-INSTALLATION.txt"
PORT="${MANITA_PORT:-4620}"
LABEL="${MANITA_LABEL:-com.ecom-manita.bureau}"   # MANITA_LABEL, MANITA_PORT, MANITA_MAISON : pour un essai isole
AGENTS="$HOME/Library/LaunchAgents"
PLIST="$AGENTS/$LABEL.plist"
UA="ecom-manita-installer"
SANS_CONNEXION=0; SANS_DEMARRAGE=0
for a in "$@"; do case "$a" in --sans-connexion) SANS_CONNEXION=1 ;; --sans-demarrage) SANS_DEMARRAGE=1 ;; esac; done
MANQUES=""
# lancé depuis une session Claude Code (le Claude du client) : on retire ses variables, sinon `claude` refuse de démarrer « dans » une autre session
unset CLAUDECODE CLAUDE_CODE_ENTRYPOINT
for v in $(env | sed -n 's/^\(CLAUDE_CODE_SESSION[A-Za-z0-9_]*\)=.*/\1/p'); do unset "$v"; done
TMPD="$(mktemp -d "${TMPDIR:-/tmp}/ecom-manita-installer.XXXXXX")"
trap 'rm -rf "$TMPD"' EXIT

ecrire() { printf '%s\n' "$1"; }
etat() {   # etat <cle> <PASSE|ECHEC> <detail>
  printf '%-14s %-7s %s\n' "$1:" "$2" "$3" >> "$ETAT"
  if [ "$2" = "PASSE" ]; then printf '  \033[32mOK\033[0m      %s  %s\n' "$1" "$3"
  elif [ "$2" = "A-FAIRE" ]; then printf '  \033[33mA FAIRE\033[0m %s  %s\n' "$1" "$3"
  else printf '  \033[31mECHEC\033[0m   %s  %s\n' "$1" "$3"; MANQUES="$MANQUES${MANQUES:+, }$1"; fi
}
arret() {  # arret <cle> <raison> : on s'arrête proprement, rien n'est cassé
  etat "$1" "ECHEC" "$2"
  printf 'VERDICT: INCOMPLET %s - %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$2" >> "$ETAT"
  printf '\n\033[31m########  ARRET : %s  ########\033[0m\n' "$2"
  printf 'Corrige ce point, puis relance l installateur (rien ne sera casse).\n'
  exit 1
}
telecharger() {  # telecharger <url> <destination>
  mkdir -p "$(dirname "$2")"
  curl -fL --retry 3 --retry-delay 3 --connect-timeout 30 --max-time 1800 -sS -A "$UA" -o "$2" "$1" && [ -s "$2" ]
}
lire_texte() { curl -fsSL --retry 3 --retry-delay 3 --connect-timeout 30 --max-time 300 -A "$UA" "$1"; }
empreinte() { shasum -a 256 "$1" | awk '{print tolower($1)}'; }
architecture() {  # le PROCESSEUR, pas le shell : un terminal sous Rosetta répond x86_64 sur un Mac Apple
  if [ "$(sysctl -n hw.optional.arm64 2>/dev/null)" = "1" ]; then echo arm64; else echo x64; fi
}
version_macos() { sw_vers -productVersion 2>/dev/null; }
NODE=""
actif_github() {  # actif_github <depot> <regex du nom> -> « nom url digest » (digest = sha256:… ou vide)
  local f; f="$TMPD/rel-$(echo "$1" | tr '/' '-').json"
  lire_texte "https://api.github.com/repos/$1/releases/latest" > "$f" || return 1
  "$NODE" -e '
    const d=JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"));const re=new RegExp(process.argv[2]);
    const a=(d.assets||[]).find(x=>re.test(x.name)); if(!a){process.exit(2)}
    console.log([a.name,a.browser_download_url,a.digest||"",d.tag_name||""].join(" "))' "$f" "$2"
}

# ------------------------------------------------------------------------------------------------ les étapes
etape_systeme() {
  local v maj; v="$(version_macos)"; maj="${v%%.*}"
  [ -n "$v" ] || arret "macos" "ce n est pas un Mac (sw_vers absent)"
  [ "$maj" -ge 13 ] 2>/dev/null || arret "macos" "macOS 13 (Ventura) ou plus recent est necessaire (trouve $v)"
  etat "macos" "PASSE" "macOS $v, $(architecture)"
  [ -f "$BUREAU/serveur.mjs" ] || arret "dossier" "dossier incomplet : serveur.mjs absent dans $BUREAU"
  # un zip téléchargé par le navigateur marque ses fichiers « venus d'internet » : on enlève la marque du pack
  xattr -dr com.apple.quarantine "$PACK" 2>/dev/null || true
  etat "dossier" "PASSE" "$PACK"
}

node_sain() { [ -x "$1" ] && "$1" -e 'process.exit(+process.versions.node.split(".")[0]>=20?0:1)' 2>/dev/null; }
etape_node() {
  local n="$RUNTIME/node/bin/node"
  if node_sain "$n"; then NODE="$n"; etat "node" "PASSE" "deja la : $("$n" --version)"; return; fi
  local arch plateforme ligne fichier attendu vu majeure
  arch="$(architecture)"; plateforme="darwin-$arch"
  ecrire "  Node.js : je cherche la derniere version LTS..."
  for majeure in 24 22; do
    ligne="$(lire_texte "https://nodejs.org/dist/latest-v$majeure.x/SHASUMS256.txt" 2>/dev/null | grep -E " node-v$majeure\.[0-9]+\.[0-9]+-$plateforme\.tar\.gz\$" | head -1)"
    [ -n "$ligne" ] && break
  done
  [ -n "$ligne" ] || arret "node" "aucune version LTS de Node pour $plateforme (reseau ?)"
  attendu="$(echo "$ligne" | awk '{print tolower($1)}')"; fichier="$(echo "$ligne" | awk '{print $2}')"
  telecharger "https://nodejs.org/dist/latest-v$majeure.x/$fichier" "$TMPD/$fichier" || arret "node" "telechargement impossible : $fichier"
  vu="$(empreinte "$TMPD/$fichier")"
  [ "$vu" = "$attendu" ] || arret "node" "empreinte fausse : $vu au lieu de $attendu"
  rm -rf "$RUNTIME/node.tmp" && mkdir -p "$RUNTIME/node.tmp"
  tar -xzf "$TMPD/$fichier" -C "$RUNTIME/node.tmp" --strip-components=1 || arret "node" "extraction impossible"
  rm -rf "$RUNTIME/node" && mv "$RUNTIME/node.tmp" "$RUNTIME/node"
  node_sain "$n" || arret "node" "node ne repond pas apres installation"
  NODE="$n"; etat "node" "PASSE" "$("$n" --version) (empreinte SHA-256 verifiee)"
}

PY=""
etape_python() {
  local p="$RUNTIME/python/bin/python3"
  if ! { [ -x "$p" ] && "$p" -c 'import sys;sys.exit(0 if sys.version_info>=(3,10) else 1)' 2>/dev/null; }; then
    local arch triple info nom url digest attendu vu
    arch="$(architecture)"; triple="aarch64-apple-darwin"; [ "$arch" = "x64" ] && triple="x86_64-apple-darwin"
    ecrire "  Python 3.13 : je cherche la version portable (python-build-standalone)..."
    info="$(actif_github "astral-sh/python-build-standalone" "^cpython-3\\.13\\.[0-9]+\\+[0-9]+-$triple-install_only\\.tar\\.gz\$")" || arret "python" "version portable introuvable sur GitHub (reseau ?)"
    nom="$(echo "$info" | awk '{print $1}')"; url="$(echo "$info" | awk '{print $2}')"; digest="$(echo "$info" | awk '{print $3}')"
    case "$digest" in sha256:*) attendu="$(echo "${digest#sha256:}" | tr 'A-F' 'a-f')" ;; *) arret "python" "GitHub ne publie pas d empreinte pour $nom" ;; esac
    telecharger "$url" "$TMPD/$nom" || arret "python" "telechargement impossible : $nom"
    vu="$(empreinte "$TMPD/$nom")"
    [ "$vu" = "$attendu" ] || arret "python" "empreinte fausse : $vu au lieu de $attendu"
    rm -rf "$RUNTIME/python.tmp" && mkdir -p "$RUNTIME/python.tmp"
    tar -xzf "$TMPD/$nom" -C "$RUNTIME/python.tmp" || arret "python" "extraction impossible"
    [ -x "$RUNTIME/python.tmp/python/bin/python3" ] || arret "python" "python3 absent de l archive"
    rm -rf "$RUNTIME/python" && mv "$RUNTIME/python.tmp/python" "$RUNTIME/python" && rm -rf "$RUNTIME/python.tmp"
    "$p" -c 'import sys' 2>/dev/null || arret "python" "python ne demarre pas apres installation"
  fi
  PY="$p"
  etat "python" "PASSE" "$("$p" --version 2>&1) $p"
  ecrire "  Python : les bibliotheques des outils (numpy, pillow, gdown...)..."
  "$p" -m pip --version >/dev/null 2>&1 || "$p" -m ensurepip --upgrade >/dev/null 2>&1
  "$p" -m pip install --disable-pip-version-check --no-warn-script-location --upgrade numpy pillow gdown arabic-reshaper python-bidi > "$TMPD/pip.log" 2>&1
  local test; test="$("$p" -X utf8 -c 'import numpy, PIL, gdown, arabic_reshaper, bidi; print("OK")' 2>&1)"
  [ "$test" = "OK" ] || arret "bibliotheques" "import impossible : $(echo "$test" | tail -1) (pip : $(tail -2 "$TMPD/pip.log" | tr '\n' ' '))"
  etat "bibliotheques" "PASSE" "numpy, pillow, gdown, arabic-reshaper, python-bidi"
}

FFDIR=""
etape_ffmpeg() {
  local d="$RUNTIME/ffmpeg"
  if ! { [ -x "$d/ffmpeg" ] && [ -x "$d/ffprobe" ] && "$d/ffmpeg" -version >/dev/null 2>&1 && "$d/ffprobe" -version >/dev/null 2>&1; }; then
    local arch outil final attendu vu
    arch="$(architecture)"; [ "$arch" = "x64" ] && arch="amd64"
    rm -rf "$d.tmp" && mkdir -p "$d.tmp"
    for outil in ffmpeg ffprobe; do
      ecrire "  FFmpeg : telechargement de $outil..."
      final="$(curl -fsSL -A "$UA" --retry 3 --connect-timeout 30 --max-time 1800 -o "$TMPD/$outil.zip" -w '%{url_effective}' "https://ffmpeg.martin-riedl.de/redirect/latest/macos/$arch/release/$outil.zip")" || arret "ffmpeg" "telechargement impossible : $outil"
      attendu="$(lire_texte "$final.sha256" | grep -Eo '[0-9a-fA-F]{64}' | head -1 | tr 'A-F' 'a-f')"
      [ -n "$attendu" ] || arret "ffmpeg" "empreinte introuvable : $final.sha256"
      vu="$(empreinte "$TMPD/$outil.zip")"
      [ "$vu" = "$attendu" ] || arret "ffmpeg" "empreinte fausse pour $outil : $vu au lieu de $attendu"
      rm -rf "$TMPD/z-$outil" && mkdir -p "$TMPD/z-$outil"
      unzip -o -q "$TMPD/$outil.zip" -d "$TMPD/z-$outil" || arret "ffmpeg" "extraction impossible : $outil"
      local trouve; trouve="$(find "$TMPD/z-$outil" -type f -name "$outil" | head -1)"
      [ -n "$trouve" ] || arret "ffmpeg" "$outil absent du zip"
      mv -f "$trouve" "$d.tmp/$outil"
      chmod +x "$d.tmp/$outil"
    done
    rm -rf "$d" && mv "$d.tmp" "$d"
    xattr -dr com.apple.quarantine "$d" 2>/dev/null || true
    "$d/ffmpeg" -version >/dev/null 2>&1 || arret "ffmpeg" "ffmpeg ne demarre pas"
    "$d/ffprobe" -version >/dev/null 2>&1 || arret "ffmpeg" "ffprobe ne demarre pas"
  fi
  FFDIR="$d"
  etat "ffmpeg" "PASSE" "$("$d/ffmpeg" -version 2>&1 | head -1 | cut -c1-60)"
}

CF=""
etape_cloudflared() {
  local exe="$RUNTIME/cloudflared"
  if ! { [ -x "$exe" ] && "$exe" --version >/dev/null 2>&1; }; then
    local arch info nom url digest attendu vu
    arch="$(architecture)"; [ "$arch" = "x64" ] && arch="amd64"
    info="$(actif_github "cloudflare/cloudflared" "^cloudflared-darwin-$arch\\.tgz\$")" || { etat "cloudflared" "ECHEC" "introuvable sur GitHub -- les videos peuvent passer par R2 a la place (onglet de preparation du bureau)"; return; }
    nom="$(echo "$info" | awk '{print $1}')"; url="$(echo "$info" | awk '{print $2}')"; digest="$(echo "$info" | awk '{print $3}')"
    case "$digest" in sha256:*) attendu="$(echo "${digest#sha256:}" | tr 'A-F' 'a-f')" ;; *) etat "cloudflared" "ECHEC" "pas d empreinte publiee pour $nom"; return ;; esac
    telecharger "$url" "$TMPD/$nom" || { etat "cloudflared" "ECHEC" "telechargement impossible"; return; }
    vu="$(empreinte "$TMPD/$nom")"
    [ "$vu" = "$attendu" ] || { etat "cloudflared" "ECHEC" "empreinte fausse : $vu au lieu de $attendu"; return; }
    rm -rf "$TMPD/cf" && mkdir -p "$TMPD/cf" && tar -xzf "$TMPD/$nom" -C "$TMPD/cf" || { etat "cloudflared" "ECHEC" "extraction impossible"; return; }
    [ -f "$TMPD/cf/cloudflared" ] || { etat "cloudflared" "ECHEC" "cloudflared absent de l archive"; return; }
    mv -f "$TMPD/cf/cloudflared" "$exe" && chmod +x "$exe"
  fi
  CF="$exe"
  etat "cloudflared" "PASSE" "$("$exe" --version 2>&1 | head -1)"
}

CLAUDE=""
trouver_claude() {
  if [ -x "$HOME/.local/bin/claude" ]; then echo "$HOME/.local/bin/claude"; return; fi
  command -v claude 2>/dev/null || true
}
etape_claude() {
  CLAUDE="$(trouver_claude)"
  if [ -z "$CLAUDE" ]; then
    ecrire "  Claude Code : installateur officiel (https://claude.ai/install.sh)..."
    curl -fsSL https://claude.ai/install.sh | bash > "$TMPD/claude-install.log" 2>&1
    CLAUDE="$(trouver_claude)"
    [ -n "$CLAUDE" ] || arret "claude" "Claude Code introuvable apres l installateur officiel ($(tail -1 "$TMPD/claude-install.log"))"
  fi
  etat "claude" "PASSE" "$("$CLAUDE" --version 2>/dev/null | head -1) $CLAUDE"
}
connecte() { "$CLAUDE" auth status --json 2>/dev/null | grep -Eq '"loggedIn"[[:space:]]*:[[:space:]]*true'; }
etape_connexion() {
  if connecte; then etat "connexion" "PASSE" "deja connecte a Claude"; return; fi
  if [ "$SANS_CONNEXION" = "1" ]; then etat "connexion" "ECHEC" "pas connecte (lance : claude auth login)"; return; fi
  printf '\n\033[33m  ####  Connexion de Claude Code : connecte-toi avec TON compte Claude (Pro), clique AUTORISER.  ####\033[0m\n\n'
  if [ -t 0 ] && [ -t 1 ]; then
    "$CLAUDE" auth login
  else
    # lancé par Claude (pas de clavier ici) : la connexion se fait dans une fenêtre Terminal à part
    local c="$RUNTIME/connexion-claude.command"
    printf '#!/bin/bash\necho "Connexion de Claude Code au compte Claude du bureau ecom manita"\n"%s" auth login\necho\necho "C est fait : tu peux fermer cette fenetre."\n' "$CLAUDE" > "$c"
    chmod +x "$c"; open -a Terminal "$c" 2>/dev/null || open "$c"
    ecrire "  une fenetre Terminal s est ouverte : connecte-toi dedans (et colle le code dans CETTE fenetre si on te le demande)."
    local i=0; while [ $i -lt 300 ] && ! connecte; do sleep 3; i=$((i + 1)); done
  fi
  connecte && etat "connexion" "PASSE" "connecte a Claude" || arret "connexion" "Claude Code n est pas connecte (relance l installateur apres t etre connecte)"
}

etape_reglages() {
  mkdir -p "$MAISON/musiques" "$MAISON/bureau-data"
  local f="$BUREAU/config.local.json"
  # les chemins des outils sont posés par l'installateur ; les réglages du client ne sont JAMAIS écrasés
  "$NODE" -e '
    const fs=require("fs"),[f,py,ff,cf,maison]=process.argv.slice(1);
    let c={}; try{c=JSON.parse(fs.readFileSync(f,"utf8"))}catch{}
    c.python=py; c.ffmpegDossier=ff; if(cf)c.cloudflared=cf;
    if(!c.musiques||!fs.existsSync(c.musiques))c.musiques=maison+"/musiques";
    if(!c.maison)c.maison=maison;
    fs.writeFileSync(f,JSON.stringify(c,null,2))' "$f" "$PY" "$FFDIR" "$CF" "$MAISON" || arret "reglages" "config.local.json impossible a ecrire"
  printf '%s\n' "$PACK" > "$MAISON/paquet.txt"   # le chemin reel du paquet, pour les agents du mode manuel
  # les agents du mode manuel le lisent dans la maison par defaut ; une maison deplacee (MANITA_MAISON, essais) ne touche pas a celle-ci
  etat "reglages" "PASSE" "config.local.json - maison $MAISON"
}

etape_agents() {   # les agents en mode manuel : un plugin Claude Code (une discussion par agent : /ecom-manita:editeur ...)
  local place="$PACK/plugin" s1 s2
  [ -f "$place/.claude-plugin/marketplace.json" ] || { etat "agents" "ECHEC" "dossier plugin absent dans $PACK"; return; }
  s1="$("$CLAUDE" plugin marketplace add "$place" 2>&1 | tail -1)"
  s2="$("$CLAUDE" plugin install ecom-manita@ecom-manita 2>&1 | tail -1)"
  if "$CLAUDE" plugin list --json 2>/dev/null | grep -q '"id": *"ecom-manita@ecom-manita"'; then
    etat "agents" "PASSE" "plugin ecom-manita installe : /ecom-manita:manager, editeur, page, testing, scaling, coach, spy, engagement"
  else etat "agents" "ECHEC" "plugin non installe : $s1 / $s2"; fi
}

sante() { curl -fsS -m 3 -H 'x-manita: 1' "http://127.0.0.1:$PORT/api/sante" 2>/dev/null; }
etape_demarrage() {
  mkdir -p "$AGENTS" "$MAISON/bureau-data"
  cat > "$PLIST" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>$LABEL</string>
  <key>ProgramArguments</key><array><string>$NODE</string><string>serveur.mjs</string></array>
  <key>WorkingDirectory</key><string>$BUREAU</string>
  <key>EnvironmentVariables</key><dict>
    <key>PATH</key><string>$RUNTIME/node/bin:$RUNTIME/python/bin:$RUNTIME/ffmpeg:$RUNTIME:$HOME/.local/bin:/usr/bin:/bin:/usr/sbin:/sbin</string>
    <key>HOME</key><string>$HOME</string>
    <key>MANITA_MAISON</key><string>$MAISON</string>
    <key>MANITA_PYTHON</key><string>$PY</string>
    <key>PORT</key><string>$PORT</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><dict><key>SuccessfulExit</key><false/></dict>
  <key>ThrottleInterval</key><integer>10</integer>
  <key>StandardOutPath</key><string>$MAISON/bureau-data/serveur.log</string>
  <key>StandardErrorPath</key><string>$MAISON/bureau-data/serveur.log</string>
</dict></plist>
EOF
  plutil -lint "$PLIST" >/dev/null 2>&1 || arret "demarrage" "le fichier launchd est mal forme"
  cat > "$PACK/DEMARRER-ECOM-MANITA.command" <<EOF
#!/bin/bash
# (re)démarre le bureau ecom manita et ouvre sa page
launchctl bootout "gui/\$(id -u)/$LABEL" >/dev/null 2>&1; sleep 1
launchctl bootstrap "gui/\$(id -u)" "$PLIST" && echo "le bureau demarre..."
for i in \$(seq 1 30); do curl -fsS -m 2 "http://127.0.0.1:$PORT/api/sante" >/dev/null 2>&1 && break; sleep 1; done
open "http://localhost:$PORT/"
EOF
  cat > "$PACK/ARRETER-ECOM-MANITA.command" <<EOF
#!/bin/bash
# arrête le bureau ecom manita (il redémarrera à la prochaine ouverture de session, ou avec DEMARRER-ECOM-MANITA.command)
launchctl bootout "gui/\$(id -u)/$LABEL" >/dev/null 2>&1 && echo "le bureau est arrete" || echo "le bureau ne tournait pas"
EOF
  chmod +x "$PACK/DEMARRER-ECOM-MANITA.command" "$PACK/ARRETER-ECOM-MANITA.command"
  etat "demarrage" "PASSE" "launchd ($PLIST), DEMARRER et ARRETER dans $PACK"
}

etape_lancer() {
  local uid; uid="$(id -u)"
  if [ -n "$(sante)" ]; then
    ecrire "  un ancien bureau tourne : je l arrete d abord..."
    launchctl bootout "gui/$uid/$LABEL" >/dev/null 2>&1 || true
    curl -fsS -m 5 -X POST -H 'x-manita: 1' "http://127.0.0.1:$PORT/api/arreter" >/dev/null 2>&1 || true
    local i=0; while [ $i -lt 20 ] && [ -n "$(sante)" ]; do sleep 1; i=$((i + 1)); done
    [ -z "$(sante)" ] || arret "lancement" "le port $PORT reste pris par l ancien bureau : redemarre le Mac et relance"
  else
    launchctl bootout "gui/$uid/$LABEL" >/dev/null 2>&1 || true
  fi
  if lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then arret "lancement" "le port $PORT est pris par un autre programme"; fi
  sleep 1
  launchctl bootstrap "gui/$uid" "$PLIST" 2>"$TMPD/launchctl.log" || arret "lancement" "launchctl refuse le service : $(tr '\n' ' ' < "$TMPD/launchctl.log")"
  local s="" i=0
  while [ $i -lt 60 ] && [ -z "$s" ]; do sleep 1; s="$(sante)"; i=$((i + 1)); done
  [ -n "$s" ] || arret "sante" "le bureau ne repond pas sur le port $PORT (voir $MAISON/bureau-data/serveur.log)"
  etat "sante" "PASSE" "$(echo "$s" | "$NODE" -e 'let t="";process.stdin.on("data",d=>t+=d).on("end",()=>{const j=JSON.parse(t);console.log(j.nom+" "+j.version)})') sur http://localhost:$PORT"
}

etape_epreuve() {
  ecrire "  l epreuve du bureau (verifier.mjs, aucun token depense)..."
  local sortie code fin
  sortie="$(cd "$BUREAU" && MANITA_PYTHON="$PY" PATH="$RUNTIME/ffmpeg:$PATH" "$NODE" verifier.mjs 2>&1)"; code=$?
  fin="$(printf '%s\n' "$sortie" | grep -E 'contr.{1,2}les pass' | tail -1)"
  if [ $code -eq 0 ]; then etat "epreuve" "PASSE" "$fin"
  else printf '%s\n' "$sortie" > "$MAISON/bureau-data/epreuve.log"; etat "epreuve" "ECHEC" "$fin -- detail dans $MAISON/bureau-data/epreuve.log"; fi
}

etape_connecteurs() {   # informatif : le bureau (lancé par launchd) voit-il les connecteurs Tassyir et Meta du compte Claude ?
  local r; r="$(curl -fsS -m 200 -X POST -H 'x-manita: 1' "http://127.0.0.1:$PORT/api/connecteurs/sonder" 2>/dev/null)"
  if [ -z "$r" ]; then etat "connecteurs" "A-FAIRE" "le bureau n a pas repondu a la sonde"; return; fi
  local lu; lu="$(printf '%s' "$r" | "$NODE" -e 'let t="";process.stdin.on("data",d=>t+=d).on("end",()=>{const j=JSON.parse(t);console.log((j.tassyir&&j.meta?"OK ":"NON ")+"tassyir "+(j.tassyir||"manque")+" · meta "+(j.meta||"manque")+((j.manque||[]).length?" · "+j.manque.join(", "):""))})' 2>/dev/null)"
  case "$lu" in OK*) etat "connecteurs" "PASSE" "${lu#OK }" ;; *) etat "connecteurs" "A-FAIRE" "${lu#NON } -- ajoute Tassyir et Meta dans claude.ai, puis « افحص الكونيكتورات »" ;; esac
}

installer() {
  printf 'ecom manita - installation du %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" > "$ETAT"
  printf '\n\033[36m=== ecom manita : installation du bureau ===\033[0m\n\n'
  mkdir -p "$RUNTIME"
  etape_systeme
  etape_node
  etape_python
  etape_ffmpeg
  etape_cloudflared
  etape_claude
  etape_connexion
  etape_reglages
  etape_agents
  etape_demarrage
  if [ "$SANS_DEMARRAGE" != "1" ]; then etape_lancer; fi
  etape_epreuve
  if [ "$SANS_DEMARRAGE" != "1" ]; then etape_connecteurs; fi
  if [ -n "$MANQUES" ]; then
    printf 'VERDICT: INSTALLE AVEC MANQUES %s - %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$MANQUES" >> "$ETAT"
    printf '\n\033[33mINSTALLE, mais il manque : %s\033[0m\n' "$MANQUES"
  else
    printf 'VERDICT: INSTALLE %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" >> "$ETAT"
    printf '\n\033[32m####  C EST INSTALLE.  Le bureau : http://localhost:%s  ####\033[0m\n' "$PORT"
  fi
  if [ "$SANS_DEMARRAGE" != "1" ]; then open "http://localhost:$PORT/" 2>/dev/null || true; fi
}

if [ "${MANITA_INSTALL_ESSAI:-}" != "1" ]; then installer; fi
