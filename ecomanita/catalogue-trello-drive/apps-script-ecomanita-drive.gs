// ecomanita — reçoit les vidéos des cartes Trello « À tester » et les range dans Drive :
// Mon Drive / ecomanita catalogue / <MOD-xxx> / fichiers.
// Déployé en application Web, accès « Moi uniquement » : seul le titulaire du compte peut l'appeler.
const ROOT = 'ecomanita catalogue';
function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function sub(name, parent) { const it = parent.getFoldersByName(name); return it.hasNext() ? it.next() : parent.createFolder(name); }
function root() { const it = DriveApp.getFoldersByName(ROOT); return it.hasNext() ? it.next() : DriveApp.createFolder(ROOT); }
function doGet() { return out({ ok: true, service: 'ecomanita-drive' }); }
function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);
    const f = sub(String(d.model || 'sans-modele'), root());
    if (d.action === 'list') {
      const files = []; const it = f.getFiles();
      while (it.hasNext()) { const x = it.next(); files.push({ name: x.getName(), size: x.getSize() }); }
      return out({ ok: true, folderUrl: f.getUrl(), files: files });
    }
    const ex = f.getFilesByName(d.fileName);
    if (ex.hasNext()) { const x = ex.next(); return out({ ok: true, existed: true, size: x.getSize(), folderUrl: f.getUrl() }); }
    const file = f.createFile(Utilities.newBlob(Utilities.base64Decode(d.b64), d.mime || 'application/octet-stream', d.fileName));
    return out({ ok: true, size: file.getSize(), folderUrl: f.getUrl() });
  } catch (err) { return out({ ok: false, error: String(err) }); }
}
