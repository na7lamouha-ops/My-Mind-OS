# installer-windows.ps1 — installe le bureau « ecom manita » sur Windows 10/11, SANS droits administrateur.
# v0.3.8 (07/10/2026). v0.3.7 : pose aussi le plugin des agents en mode manuel (Etape-Agents). Compatible Windows PowerShell 5.1 (celle de Windows) et PowerShell 7.
# v0.3.5 : Python x64 aussi sur PC ARM (python-bidi n existe pas en win_arm64). Sous PowerShell 5.1, un programme qui ecrit sur stderr ne fait plus tomber l installateur (Natif),
#          et le test des bibliotheques Python n envoie plus de guillemets doubles (5.1 les perdait).
# Lance a la main (INSTALLER-WINDOWS.bat) ou par Claude (onglet Code) : sans clavier, la connexion s ouvre dans une fenetre a part.
# Ce qu'il installe, chacun VÉRIFIÉ (empreinte ou signature) avant d'être utilisé :
#   Node.js (portable, dans runtime\node)        — empreinte SHA-256 de nodejs.org
#   Python 3.13 (pour l'utilisateur seulement)   — signature « Python Software Foundation »
#   les bibliothèques Python des outils           — numpy, pillow, gdown, arabic-reshaper, python-bidi
#   FFmpeg (portable, dans runtime\ffmpeg)        — empreinte SHA-256 publiée par gyan.dev
#   cloudflared (dans runtime)                    — empreinte publiée par GitHub, sinon signature Cloudflare
#   Claude Code (l'installateur officiel)         — puis la connexion au compte Claude du client
# Puis : les réglages (config.local.json), le démarrage automatique (dossier Démarrage, sans admin), le bureau
# démarré, sa santé lue, l'épreuve verifier.mjs, et la page ouverte. Chaque étape écrit PASSE / ECHEC dans
# _ETAT-INSTALLATION.txt, et la dernière ligne dit le VERDICT. Relancer l'installateur ne casse rien.
param([switch]$SansConnexion, [switch]$SansDemarrage)

$ErrorActionPreference = 'Stop'
# lance depuis une session Claude Code (le Claude du client) : on retire ses variables, sinon claude refuse de demarrer dans une autre session
Get-ChildItem Env: | Where-Object { $_.Name -eq 'CLAUDECODE' -or $_.Name -eq 'CLAUDE_CODE_ENTRYPOINT' -or $_.Name -like 'CLAUDE_CODE_SESSION*' } | ForEach-Object { Remove-Item -Path ('Env:' + $_.Name) -ErrorAction SilentlyContinue }
$ProgressPreference = 'SilentlyContinue'   # Windows PowerShell 5.1 télécharge dix fois plus vite sans la barre
try { [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12 } catch {}

$INSTALLEUR = $MyInvocation.MyCommand.Path
$BUREAU = Split-Path -Parent (Split-Path -Parent $INSTALLEUR)
$PACK = Split-Path -Parent $BUREAU
$RUNTIME = Join-Path $PACK 'runtime'
$MAISON = Join-Path $env:USERPROFILE 'ecom-manita-maison'
$ETAT = Join-Path $PACK '_ETAT-INSTALLATION.txt'
$PORT = 4620
$PYTHON_VERSION = '3.13.16'
$script:Manques = @()

function Ecrire([string]$t, [string]$couleur = 'Gray') { Write-Host $t -ForegroundColor $couleur }
function Etat([string]$cle, [string]$verdict, [string]$detail) {
  $ligne = '{0,-14} {1,-7} {2}' -f ($cle + ':'), $verdict, $detail
  Add-Content -Path $ETAT -Value $ligne -Encoding UTF8
  if ($verdict -eq 'PASSE') { Ecrire ('  OK      ' + $cle + '  ' + $detail) 'Green' }
  elseif ($verdict -eq 'A-FAIRE') { Ecrire ('  A FAIRE ' + $cle + '  ' + $detail) 'Yellow' }
  else { Ecrire ('  ECHEC   ' + $cle + '  ' + $detail) 'Red'; $script:Manques += $cle }
}
function Arret([string]$cle, [string]$raison) {
  Etat $cle 'ECHEC' $raison
  Add-Content -Path $ETAT -Value ('VERDICT: INCOMPLET {0} - {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), $raison) -Encoding UTF8
  Ecrire ''; Ecrire ('########  ARRET : ' + $raison + '  ########') 'Red'
  Ecrire 'Corrige ce point, puis relance INSTALLER-WINDOWS.bat (rien ne sera casse).' 'Yellow'
  throw ('ARRET ' + $cle)
}
function Telecharger([string]$url, [string]$dest) {
  $dossier = Split-Path -Parent $dest
  if (-not (Test-Path $dossier)) { New-Item -ItemType Directory -Force -Path $dossier | Out-Null }
  $derniere = ''
  for ($i = 1; $i -le 3; $i++) {
    try { Invoke-WebRequest -Uri $url -OutFile $dest -UseBasicParsing -Headers @{ 'User-Agent' = 'ecom-manita-installer' } -TimeoutSec 600; if ((Get-Item $dest).Length -gt 0) { return } }
    catch { $derniere = $_.Exception.Message; Start-Sleep -Seconds (3 * $i) }
  }
  throw ('telechargement impossible : ' + $url + ' : ' + $derniere)
}
function Lire-Texte([string]$url) { return (Invoke-WebRequest -Uri $url -UseBasicParsing -Headers @{ 'User-Agent' = 'ecom-manita-installer' } -TimeoutSec 120).Content }
function Empreinte([string]$fichier) { return (Get-FileHash -Path $fichier -Algorithm SHA256).Hash.ToLowerInvariant() }
function Signataire([string]$fichier) {
  $s = Get-AuthenticodeSignature -FilePath $fichier
  if ($s.Status -ne 'Valid') { return '' }
  return [string]$s.SignerCertificate.Subject
}
function Architecture() {
  $a = $env:PROCESSOR_ARCHITEW6432; if (-not $a) { $a = $env:PROCESSOR_ARCHITECTURE }
  if ($a -eq 'ARM64') { return 'arm64' } elseif ($a -eq 'AMD64') { return 'x64' } else { return 'x86' }
}
function Lire-Json([string]$f) { if (Test-Path $f) { return (Get-Content -Path $f -Raw -Encoding UTF8 | ConvertFrom-Json) } return $null }
function Ecrire-Json($objet, [string]$f) {
  $t = $objet | ConvertTo-Json -Depth 10
  [System.IO.File]::WriteAllText($f, $t, (New-Object System.Text.UTF8Encoding($false)))   # UTF-8 SANS BOM : Node le lit tel quel
}
# PowerShell 5.1 + ErrorActionPreference Stop : la moindre ligne qu'un programme ecrit sur stderr (pip, node, claude),
# des qu'on la redirige (2>&1, 2>$null), devient une erreur qui ARRETE tout. Natif lance le programme sans ce piege.
function Natif([scriptblock]$bloc) { $ErrorActionPreference = 'Continue'; & $bloc }
function Poser($objet, [string]$cle, $valeur) {
  if ($objet.PSObject.Properties.Name -contains $cle) { $objet.$cle = $valeur } else { $objet | Add-Member -NotePropertyName $cle -NotePropertyValue $valeur }
}

# ------------------------------------------------------------------------------------------------ les étapes
function Lire-VersionWindows() { return [System.Environment]::OSVersion.Version }
function Etape-Systeme() {
  $v = Lire-VersionWindows
  if ($v.Major -lt 10 -or ($v.Major -eq 10 -and $v.Build -lt 17763)) { Arret 'windows' ('Windows 10 version 1809 ou plus recent est necessaire (trouve ' + $v + ')') }
  $arch = Architecture
  if ($arch -eq 'x86') { Arret 'windows' 'Windows 32 bits : il faut un Windows 64 bits' }
  Etat 'windows' 'PASSE' ('build ' + $v.Build + ', ' + $arch + ', PowerShell ' + $PSVersionTable.PSVersion)
  if (-not (Test-Path (Join-Path $BUREAU 'serveur.mjs'))) { Arret 'dossier' ('dossier incomplet : serveur.mjs absent dans ' + $BUREAU) }
  # un zip telecharge marque ses fichiers « venus d'internet » : on enleve la marque des fichiers du pack
  Get-ChildItem -Path $PACK -Recurse -File -ErrorAction SilentlyContinue | Unblock-File -ErrorAction SilentlyContinue
  Etat 'dossier' 'PASSE' $PACK
}

function Etape-Node() {
  $arch = Architecture
  $node = Join-Path $RUNTIME 'node\node.exe'
  if (Test-Path $node) {
    $v = Natif { (& $node --version) 2>$null }
    if ($v -match '^v(\d+)\.' -and [int]$Matches[1] -ge 20) { Etat 'node' 'PASSE' ('deja la : ' + $v); return $node }
  }
  Ecrire '  Node.js : je cherche la derniere version LTS...'
  $index = Lire-Texte 'https://nodejs.org/dist/index.json' | ConvertFrom-Json
  $cle = 'win-' + $arch + '-zip'
  $choix = $index | Where-Object { $_.lts -and ($_.files -contains $cle) } | Select-Object -First 1
  if (-not $choix) { Arret 'node' 'aucune version LTS de Node pour ce Windows' }
  $v = $choix.version
  $nom = 'node-' + $v + '-win-' + $arch
  $zip = Join-Path $env:TEMP ($nom + '.zip')
  Telecharger ('https://nodejs.org/dist/' + $v + '/' + $nom + '.zip') $zip
  $sommes = Lire-Texte ('https://nodejs.org/dist/' + $v + '/SHASUMS256.txt')
  $attendu = ($sommes -split "`n" | Where-Object { $_ -match (' ' + [regex]::Escape($nom + '.zip') + '$') } | Select-Object -First 1)
  if (-not $attendu) { Arret 'node' 'empreinte introuvable dans SHASUMS256.txt' }
  $attendu = ($attendu -split '\s+')[0].ToLowerInvariant()
  $vu = Empreinte $zip
  if ($vu -ne $attendu) { Remove-Item $zip -Force; Arret 'node' ('empreinte fausse : ' + $vu + ' au lieu de ' + $attendu) }
  $tmp = Join-Path $RUNTIME 'node-tmp'
  if (Test-Path $tmp) { Remove-Item $tmp -Recurse -Force }
  Expand-Archive -Path $zip -DestinationPath $tmp -Force
  if (Test-Path (Join-Path $RUNTIME 'node')) { Remove-Item (Join-Path $RUNTIME 'node') -Recurse -Force }
  Move-Item -Path (Join-Path $tmp $nom) -Destination (Join-Path $RUNTIME 'node')
  Remove-Item $tmp -Recurse -Force; Remove-Item $zip -Force
  $v2 = Natif { (& $node --version) 2>$null }
  if ($v2 -ne $v) { Arret 'node' ('node ne repond pas apres installation (' + $v2 + ')') }
  Etat 'node' 'PASSE' ($v + ' (empreinte SHA-256 verifiee)')
  return $node
}

function Trouver-Python() {
  $candidats = @(
    (Join-Path $env:LOCALAPPDATA 'Programs\Python\Python313\python.exe'),
    (Join-Path $env:LOCALAPPDATA 'Programs\Python\Python312\python.exe'),
    (Join-Path $env:LOCALAPPDATA 'Programs\Python\Python311\python.exe'))   # pas les dossiers -arm64 : leurs bibliotheques ne s installent pas
  foreach ($c in $candidats) { if (Test-Path $c) { $v = (& $c -c 'import sys;print(sys.version_info[0]*100+sys.version_info[1])') 2>$null; if ([int]$v -ge 310) { return $c } } }
  return $null
}
function Etape-Python() {
  $py = Trouver-Python
  if (-not $py) {
    # toujours la version x64 : sur un PC Windows ARM elle tourne en emulation, et python-bidi n a aucune roue win_arm64
    $suffixe = 'amd64'
    $exe = Join-Path $env:TEMP ('python-' + $PYTHON_VERSION + '-' + $suffixe + '.exe')
    Ecrire ('  Python ' + $PYTHON_VERSION + ' : telechargement...')
    Telecharger ('https://www.python.org/ftp/python/' + $PYTHON_VERSION + '/python-' + $PYTHON_VERSION + '-' + $suffixe + '.exe') $exe
    $signe = Signataire $exe
    if ($signe -notmatch 'Python Software Foundation') { Remove-Item $exe -Force; Arret 'python' ('signature absente ou fausse : ' + $signe) }
    Ecrire '  Python : installation pour cet utilisateur (sans administrateur)...'
    $p = Start-Process -FilePath $exe -ArgumentList '/quiet', 'InstallAllUsers=0', 'PrependPath=1', 'Include_launcher=1', 'InstallLauncherAllUsers=0', 'Include_test=0', 'Include_doc=0', 'Shortcuts=0' -Wait -PassThru
    Remove-Item $exe -Force -ErrorAction SilentlyContinue
    if ($p.ExitCode -ne 0) { Arret 'python' ('l installateur de Python a rendu le code ' + $p.ExitCode) }
    $py = Trouver-Python
    if (-not $py) { Arret 'python' 'python introuvable apres installation' }
  }
  $env:Path = (Split-Path -Parent $py) + ';' + (Join-Path (Split-Path -Parent $py) 'Scripts') + ';' + $env:Path
  Etat 'python' 'PASSE' ((& $py --version) + ' ' + $py)
  Ecrire '  Python : les bibliotheques des outils (numpy, pillow, gdown...)...'
  Natif { & $py -m pip install --disable-pip-version-check --no-warn-script-location --upgrade numpy pillow gdown arabic-reshaper python-bidi 2>&1 | Out-Null }
  $test = Natif { (& $py -X utf8 -c 'import numpy, PIL, gdown, arabic_reshaper, bidi; print(''OK'')') 2>&1 }
  if (($test | Out-String).Trim() -ne 'OK') { Arret 'bibliotheques' ('import impossible : ' + (($test | Out-String).Trim())) }
  Etat 'bibliotheques' 'PASSE' 'numpy, pillow, gdown, arabic-reshaper, python-bidi'
  return $py
}

function Etape-FFmpeg() {
  $bin = Get-ChildItem -Path (Join-Path $RUNTIME 'ffmpeg') -Recurse -Filter 'ffmpeg.exe' -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $bin) {
    Ecrire '  FFmpeg : telechargement (une centaine de Mo)...'
    $zip = Join-Path $env:TEMP 'ffmpeg-release-essentials.zip'
    Telecharger 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip' $zip
    $attendu = ((Lire-Texte 'https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip.sha256').Trim() -split '\s+')[0].ToLowerInvariant()
    $vu = Empreinte $zip
    if ($vu -ne $attendu) { Remove-Item $zip -Force; Arret 'ffmpeg' ('empreinte fausse : ' + $vu + ' au lieu de ' + $attendu) }
    if (Test-Path (Join-Path $RUNTIME 'ffmpeg')) { Remove-Item (Join-Path $RUNTIME 'ffmpeg') -Recurse -Force }
    Expand-Archive -Path $zip -DestinationPath (Join-Path $RUNTIME 'ffmpeg') -Force
    Remove-Item $zip -Force
    $bin = Get-ChildItem -Path (Join-Path $RUNTIME 'ffmpeg') -Recurse -Filter 'ffmpeg.exe' | Select-Object -First 1
    if (-not $bin) { Arret 'ffmpeg' 'ffmpeg.exe introuvable dans le zip' }
  }
  $dossier = Split-Path -Parent $bin.FullName
  $v = Natif { (& (Join-Path $dossier 'ffmpeg.exe') -version 2>&1 | Select-Object -First 1) }
  if (-not (Test-Path (Join-Path $dossier 'ffprobe.exe'))) { Arret 'ffmpeg' 'ffprobe.exe manque' }
  Etat 'ffmpeg' 'PASSE' ([string]$v).Substring(0, [Math]::Min(60, ([string]$v).Length))
  return $dossier
}

function Etape-Cloudflared() {
  $exe = Join-Path $RUNTIME 'cloudflared.exe'
  if (-not (Test-Path $exe)) {
    try {
      $arch = Architecture
      $nom = 'cloudflared-windows-amd64.exe'; if ($arch -eq 'arm64') { $nom = 'cloudflared-windows-arm64.exe' }
      $rel = Invoke-RestMethod -Uri 'https://api.github.com/repos/cloudflare/cloudflared/releases/latest' -Headers @{ 'User-Agent' = 'ecom-manita-installer' } -TimeoutSec 60
      $actif = $rel.assets | Where-Object { $_.name -eq $nom } | Select-Object -First 1
      if (-not $actif -and $arch -eq 'arm64') { $nom = 'cloudflared-windows-amd64.exe'; $actif = $rel.assets | Where-Object { $_.name -eq $nom } | Select-Object -First 1 }
      if (-not $actif) { throw ('fichier ' + $nom + ' absent de la version ' + $rel.tag_name) }
      $tmp = Join-Path $env:TEMP $nom
      Telecharger $actif.browser_download_url $tmp
      $preuve = ''
      if ($actif.digest -and ([string]$actif.digest).StartsWith('sha256:')) {
        $attendu = ([string]$actif.digest).Substring(7).ToLowerInvariant()
        if ((Empreinte $tmp) -ne $attendu) { Remove-Item $tmp -Force; throw 'empreinte fausse' }
        $preuve = 'empreinte publiee par GitHub verifiee'
      } else {
        $signe = Signataire $tmp
        if ($signe -notmatch 'Cloudflare') { Remove-Item $tmp -Force; throw ('ni empreinte ni signature Cloudflare (' + $signe + ')') }
        $preuve = 'signature Cloudflare verifiee'
      }
      Move-Item -Path $tmp -Destination $exe -Force
      Ecrire ('  cloudflared ' + $rel.tag_name + ' : ' + $preuve)
    } catch { Etat 'cloudflared' 'ECHEC' ($_.Exception.Message + ' -- les videos peuvent passer par R2 a la place (onglet de preparation du bureau)'); return '' }
  }
  $v = Natif { (& $exe --version 2>&1 | Select-Object -First 1) }
  Etat 'cloudflared' 'PASSE' ([string]$v)
  return $exe
}

function Trouver-Claude() {
  $c = Join-Path $env:USERPROFILE '.local\bin\claude.exe'
  if (Test-Path $c) { return $c }
  $g = Get-Command claude.exe -ErrorAction SilentlyContinue
  if ($g) { return $g.Source }
  return $null
}
function Etape-Claude() {
  $claude = Trouver-Claude
  if (-not $claude) {
    Ecrire '  Claude Code : installateur officiel (https://claude.ai/install.ps1)...'
    $p = Start-Process -FilePath 'powershell.exe' -ArgumentList '-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', 'irm https://claude.ai/install.ps1 | iex' -Wait -PassThru -NoNewWindow
    $claude = Trouver-Claude
    if (-not $claude) { Arret 'claude' ('Claude Code introuvable apres l installateur officiel (code ' + $p.ExitCode + ')') }
  }
  $env:Path = (Split-Path -Parent $claude) + ';' + $env:Path
  Etat 'claude' 'PASSE' ((Natif { (& $claude --version) 2>$null | Select-Object -First 1 }) + ' ' + $claude)
  return $claude
}
function Connecte([string]$claude) {
  try { $s = (Natif { & $claude auth status --json 2>$null | Out-String }) | ConvertFrom-Json; return [bool]$s.loggedIn } catch { return $false }
}
function Interactif() { try { return -not [Console]::IsInputRedirected } catch { return $true } }
function Etape-Connexion([string]$claude) {
  if (Connecte $claude) { Etat 'connexion' 'PASSE' 'deja connecte a Claude'; return }
  if ($SansConnexion) { Etat 'connexion' 'ECHEC' 'pas connecte (lance : claude auth login)'; return }
  Ecrire ''
  Ecrire '  ####  Le navigateur va s ouvrir sur claude.ai : connecte-toi avec TON compte (Pro), clique AUTORISER, puis reviens ici.  ####' 'Yellow'
  Ecrire ''
  if (Interactif) { & $claude auth login }
  else {
    # lance par Claude (aucun clavier ici) : la connexion se fait dans une fenetre PowerShell a part
    $commande = "& '" + $claude.Replace("'", "''") + "' auth login; Write-Host ''; Write-Host 'C est fait : tu peux fermer cette fenetre.'; Start-Sleep -Seconds 20"
    $code64 = [Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($commande))
    Start-Process -FilePath 'powershell.exe' -ArgumentList '-NoProfile', '-ExecutionPolicy', 'Bypass', '-EncodedCommand', $code64
    Ecrire '  une fenetre PowerShell s est ouverte : connecte-toi (si on te donne un code, colle-le dans CETTE fenetre puis Entree).'
    for ($i = 0; $i -lt 300 -and -not (Connecte $claude); $i++) { Start-Sleep -Seconds 3 }
  }
  if (Connecte $claude) { Etat 'connexion' 'PASSE' 'connecte a Claude' } else { Arret 'connexion' 'Claude Code n est pas connecte (relance l installateur apres avoir autorise)' }
}

function Etape-Reglages([string]$py, [string]$ffmpeg, [string]$cloudflared) {
  foreach ($d in @($MAISON, (Join-Path $MAISON 'musiques'), (Join-Path $MAISON 'bureau-data'))) { if (-not (Test-Path $d)) { New-Item -ItemType Directory -Force -Path $d | Out-Null } }
  $f = Join-Path $BUREAU 'config.local.json'
  $c = Lire-Json $f
  if (-not $c) { $c = New-Object PSObject }
  # les chemins des outils : posés par l'installateur ; les réglages du client ne sont JAMAIS écrasés
  Poser $c 'python' $py
  Poser $c 'ffmpegDossier' $ffmpeg
  if ($cloudflared) { Poser $c 'cloudflared' $cloudflared }
  if (-not ($c.PSObject.Properties.Name -contains 'musiques') -or -not (Test-Path ([string]$c.musiques))) { Poser $c 'musiques' (Join-Path $MAISON 'musiques') }
  if (-not ($c.PSObject.Properties.Name -contains 'maison')) { Poser $c 'maison' $MAISON }
  Ecrire-Json $c $f
  # le chemin reel du paquet, pour les agents du mode manuel (ils le lisent s il n est pas dans le dossier personnel)
  [System.IO.File]::WriteAllText((Join-Path $MAISON 'paquet.txt'), $PACK, (New-Object System.Text.UTF8Encoding($false)))
  Etat 'reglages' 'PASSE' ('config.local.json - maison ' + $MAISON)
}

function Etape-Agents([string]$claude) {   # les agents en mode manuel : un plugin Claude Code (une discussion par agent : /ecom-manita:editeur ...)
  $place = Join-Path $PACK 'plugin'
  if (-not (Test-Path (Join-Path $place '.claude-plugin\marketplace.json'))) { Etat 'agents' 'ECHEC' ('dossier plugin absent dans ' + $PACK); return }
  $s1 = Natif { (& $claude plugin marketplace add $place 2>&1 | Out-String) }
  $s2 = Natif { (& $claude plugin install 'ecom-manita@ecom-manita' 2>&1 | Out-String) }
  $liste = Natif { (& $claude plugin list --json 2>$null | Out-String) }
  $ok = $false
  try { $ok = @(($liste | ConvertFrom-Json) | ForEach-Object { $_ } | Where-Object { $_.id -eq 'ecom-manita@ecom-manita' }).Count -gt 0 } catch { $ok = $false }
  if ($ok) { Etat 'agents' 'PASSE' 'plugin ecom-manita installe : /ecom-manita:manager, editeur, page, testing, scaling, coach, spy, engagement' }
  else { Etat 'agents' 'ECHEC' ('plugin non installe : ' + ((([string]$s1) + ' / ' + ([string]$s2)) -replace '\s+', ' ').Trim()) }
}

function Etape-Demarrage([string]$node) {
  $cmd = Join-Path $RUNTIME 'DEMARRER-ECOM-MANITA.cmd'
  $lignes = @(
    '@echo off',
    'title ecom manita - le bureau (laisse cette fenetre ouverte)',
    'cd /d "%~dp0..\bureau"',
    'set "MANITA_MAISON=%USERPROFILE%\ecom-manita-maison"',
    'if not exist "%MANITA_MAISON%\bureau-data" mkdir "%MANITA_MAISON%\bureau-data"',
    ':boucle',
    'echo %date% %time% le bureau demarre >> "%MANITA_MAISON%\bureau-data\serveur.log"',
    '"%~dp0node\node.exe" serveur.mjs >> "%MANITA_MAISON%\bureau-data\serveur.log" 2>&1',
    'if %errorlevel%==0 goto fin',
    'timeout /t 5 /nobreak >nul',
    'goto boucle',
    ':fin')
  [System.IO.File]::WriteAllText($cmd, (($lignes -join "`r`n") + "`r`n"), (New-Object System.Text.ASCIIEncoding))
  $arreter = Join-Path $PACK 'ARRETER-ECOM-MANITA.cmd'
  [System.IO.File]::WriteAllText($arreter, ('@echo off' + "`r`n" + 'powershell -NoProfile -ExecutionPolicy Bypass -Command "try { Invoke-RestMethod -Method Post -Uri http://127.0.0.1:' + $PORT + '/api/arreter -Headers @{''x-manita''=''1''} | Out-Null; Write-Host ''le bureau est arrete'' } catch { Write-Host ''le bureau ne tournait pas'' }"' + "`r`n" + 'timeout /t 3 >nul' + "`r`n"), (New-Object System.Text.ASCIIEncoding))
  $ws = New-Object -ComObject WScript.Shell
  $demarrage = [Environment]::GetFolderPath('Startup')
  if (-not $demarrage) { $demarrage = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Startup' }
  if (-not (Test-Path $demarrage)) { New-Item -ItemType Directory -Force -Path $demarrage | Out-Null }
  $lnk = $ws.CreateShortcut((Join-Path $demarrage 'ecom manita - le bureau.lnk'))
  $lnk.TargetPath = $cmd; $lnk.WorkingDirectory = $RUNTIME; $lnk.WindowStyle = 7; $lnk.Description = 'le bureau ecom manita (demarre a l ouverture de session)'; $lnk.Save()
  $bureauWin = [Environment]::GetFolderPath('Desktop')
  if (-not $bureauWin) { $bureauWin = Join-Path $env:USERPROFILE 'Desktop' }
  if (-not (Test-Path $bureauWin)) { New-Item -ItemType Directory -Force -Path $bureauWin | Out-Null }
  [System.IO.File]::WriteAllText((Join-Path $bureauWin 'ecom manita.url'), ('[InternetShortcut]' + "`r`n" + 'URL=http://localhost:' + $PORT + '/' + "`r`n"), (New-Object System.Text.ASCIIEncoding))
  Etat 'demarrage' 'PASSE' ('raccourci dans ' + $demarrage + ' et icone sur le bureau')
  return $cmd
}

function Sante() { try { return Invoke-RestMethod -Uri ('http://127.0.0.1:' + $PORT + '/api/sante') -TimeoutSec 3 -Headers @{ 'x-manita' = '1' } } catch { return $null } }
function Etape-Lancer([string]$cmd) {
  $vieux = Sante
  if ($vieux -and $vieux.nom) {
    Ecrire '  un ancien bureau tourne : je l arrete d abord...'
    try { Invoke-RestMethod -Method Post -Uri ('http://127.0.0.1:' + $PORT + '/api/arreter') -Headers @{ 'x-manita' = '1' } -TimeoutSec 5 | Out-Null } catch {}
    for ($i = 0; $i -lt 20 -and (Sante); $i++) { Start-Sleep -Seconds 1 }
    if (Sante) { Arret 'lancement' ('le port ' + $PORT + ' reste pris par l ancien bureau : redemarre le PC et relance') }
  }
  Start-Process -FilePath $cmd -WorkingDirectory $RUNTIME -WindowStyle Minimized
  $s = $null
  for ($i = 0; $i -lt 60 -and -not $s; $i++) { Start-Sleep -Seconds 1; $s = Sante }
  if (-not $s) { Arret 'sante' ('le bureau ne repond pas sur le port ' + $PORT + ' (voir ' + $MAISON + '\bureau-data\serveur.log)') }
  Etat 'sante' 'PASSE' ($s.nom + ' ' + $s.version + ' sur http://localhost:' + $PORT)
}

function Etape-Epreuve([string]$node, [string]$py, [string]$ffmpeg) {
  Ecrire '  l epreuve du bureau (verifier.mjs, aucun token depense)...'
  $env:MANITA_PYTHON = $py
  # [pack-23oct] comme sur Mac (PATH="$RUNTIME/ffmpeg:$PATH") : sans ffmpeg dans le Path, les controles video de l epreuve
  # cherchaient runtime\ffmpeg (ici ffmpeg.exe est dans runtime\ffmpeg\<version>\bin) et n etaient pas joues sur Windows
  if ($ffmpeg) { $env:Path = $ffmpeg + ';' + $env:Path }
  # node ecrit en UTF-8. Lance par Claude (Start-Process, sans chcp 65001), la console est en page OEM (850, 720, 864...) :
  # PowerShell 5.1 decodait la sortie avec elle, « contrôles » perdait son ô, la ligne epreuve restait vide et epreuve.log illisible.
  $encodageAvant = $null
  try { $encodageAvant = [Console]::OutputEncoding; [Console]::OutputEncoding = New-Object System.Text.UTF8Encoding($false) } catch {}
  Push-Location $BUREAU
  try { $sortie = Natif { (& $node verifier.mjs 2>&1 | Out-String) } } finally { Pop-Location; if ($encodageAvant) { try { [Console]::OutputEncoding = $encodageAvant } catch {} } }
  # .{1,2} : la ligne se retrouve meme si un ô passe mal (deux caracteres au lieu d un), comme sur Mac
  $fin = ($sortie.Trim() -split "`n" | Where-Object { $_ -match 'contr.{1,2}les pass' } | Select-Object -Last 1)
  # aucune ligne trouvee (node arrete avant son resume) : [string] d un resultat vide de pipeline vaut $null, et .Trim() arretait tout l installateur
  if ($null -eq $fin) { $fin = '' }
  if ($LASTEXITCODE -eq 0) { Etat 'epreuve' 'PASSE' ([string]$fin).Trim() } else { Etat 'epreuve' 'ECHEC' (([string]$fin).Trim() + ' -- detail dans ' + (Join-Path $MAISON 'bureau-data\epreuve.log')); [System.IO.File]::WriteAllText((Join-Path $MAISON 'bureau-data\epreuve.log'), $sortie, (New-Object System.Text.UTF8Encoding($false))) }
}

function Etape-Connecteurs() {   # informatif : le bureau voit-il les connecteurs Tassyir et Meta du compte Claude ?
  $r = $null
  try { $r = Invoke-RestMethod -Method Post -Uri ('http://127.0.0.1:' + $PORT + '/api/connecteurs/sonder') -Headers @{ 'x-manita' = '1' } -TimeoutSec 200 } catch { $r = $null }
  if (-not $r) { Etat 'connecteurs' 'A-FAIRE' 'le bureau n a pas repondu a la sonde'; return }
  $t = 'tassyir ' + $(if ($r.tassyir) { $r.tassyir } else { 'manque' }) + ' - meta ' + $(if ($r.meta) { $r.meta } else { 'manque' })
  if ($r.tassyir -and $r.meta) { Etat 'connecteurs' 'PASSE' $t } else { Etat 'connecteurs' 'A-FAIRE' ($t + ' -- ajoute Tassyir et Meta dans claude.ai, puis le bouton des connecteurs du bureau') }
}

function Installer() {
  Set-Content -Path $ETAT -Value ('ecom manita - installation du ' + (Get-Date -Format 'yyyy-MM-dd HH:mm:ss')) -Encoding UTF8
  Ecrire ''; Ecrire '=== ecom manita : installation du bureau ===' 'Cyan'; Ecrire ''
  if (-not (Test-Path $RUNTIME)) { New-Item -ItemType Directory -Force -Path $RUNTIME | Out-Null }
  Etape-Systeme
  $node = Etape-Node
  $py = Etape-Python
  $ffmpeg = Etape-FFmpeg
  $cf = Etape-Cloudflared
  $claude = Etape-Claude
  Etape-Connexion $claude
  Etape-Reglages $py $ffmpeg $cf
  Etape-Agents $claude
  $cmd = Etape-Demarrage $node
  if (-not $SansDemarrage) { Etape-Lancer $cmd }
  Etape-Epreuve $node $py $ffmpeg
  if (-not $SansDemarrage) { Etape-Connecteurs }
  if ($script:Manques.Count) {
    Add-Content -Path $ETAT -Value ('VERDICT: INSTALLE AVEC MANQUES {0} - {1}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss'), ($script:Manques -join ', ')) -Encoding UTF8
    Ecrire ''; Ecrire ('INSTALLE, mais il manque : ' + ($script:Manques -join ', ')) 'Yellow'
  } else {
    Add-Content -Path $ETAT -Value ('VERDICT: INSTALLE {0}' -f (Get-Date -Format 'yyyy-MM-dd HH:mm:ss')) -Encoding UTF8
    Ecrire ''; Ecrire '####  C EST INSTALLE.  Le bureau : http://localhost:4620  ####' 'Green'
  }
  if (-not $SansDemarrage) { Start-Process ('http://localhost:' + $PORT + '/') }
}

if ($env:MANITA_INSTALL_ESSAI -ne '1') {
  try { Installer } catch { if (-not ([string]$_.Exception.Message).StartsWith('ARRET')) { Etat 'inattendu' 'ECHEC' $_.Exception.Message; Add-Content -Path $ETAT -Value ('VERDICT: INCOMPLET - ' + $_.Exception.Message) -Encoding UTF8 } ; exit 1 }
}
