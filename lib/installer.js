const sanitize = require('sanitize-filename')
const unrar = require('unrar-js')
const mkdirp = require('mkdirp')
const request = require('request')
const AdmZip = require('adm-zip')
const rimraf = require('rimraf')

class Installer {
    constructor(installationPath, config) {
        this.installationPath = installationPath
        this.config = config;
    }

    install(info, cb) {
        let fileEnding = info.downloadLink.substring(info.downloadLink.lastIndexOf('.'), info.downloadLink.length)

        if (fileEnding != '.zip' && fileEnding != '.rar') {
            if (info.portal === 'curse') {
                fileEnding = '.zip'; //assume it's zip
            } else {
                return cb(new Error('file-type not supported: ' + fileEnding), null)
            }
        }

        const tempZipName = sanitize(info.name + '-' + info.version + fileEnding).replace(/ /g, '')
        const tempZipPath = path.join(this.installationPath, tempZipName)

        const cfg = this.config.get();

        const preExisting = cfg.addons.filter(conf => conf.name === info.name)
        const stream = fs.createWriteStream(tempZipPath)

        request(info.downloadLink)
            .on('error', (err) => {
                return cb(err, null)
            }).pipe(stream)

        stream.on('finish', function () {
            if (fileEnding == '.zip') {
                const zip = new AdmZip(tempZipPath)
                const zipEntries = zip.getEntries()

                const folders = zipEntries.map(entry => entry.entryName.substring(0, entry.entryName.indexOf('/')))
                    .filter((value, index, self) => self.indexOf(value) === index)

                if (preExisting.length == 0) {
                    cfg.addons.push({
                        name: info.name,
                        link: info.link,
                        folders,
                        portal: info.portal,
                        version: info.version
                    })
                } else {
                    const index = cfg.addons.indexOf(preExisting[0]);

                    cfg.addons[index].portal = info.portal
                    cfg.addons[index].link = info.link
                    cfg.addons[index].version = info.version
                    cfg.addons[index].folders = folders
                }

                this.config.set(cfg);
                const foldersToRemove = folders.filter(f => { return _fileExists(path.join(this.installationPath, f)) })

                if (foldersToRemove.length > 0) {
                    const pattern = '{' + foldersToRemove.map(f => { return path.join(this.installationPath, f) }).join() + '}'

                    rimraf(pattern, (err) => {
                        if (err) { return cb(err, null) }

                        zip.extractAllTo(this.installationPath)
                        fs.unlinkSync(tempZipPath)
                        return cb(null, folders)
                    })
                } else {
                    zip.extractAllTo(this.installationPath)
                    fs.unlinkSync(tempZipPath)
                    return cb(null, folders)
                }

            }
            else if (fileEnding == '.rar') {
                const unpackedFiles = unrar.unrarSync(tempZipPath)
                const folders = unpackedFiles.map(file => file.filename)
                    .map(p => p.substring(0, p.lastIndexOf('/')))

                const rootFolders = folders
                    .map(entry => {
                        if (entry.indexOf('/') == -1) {
                            return entry
                        } else {
                            return entry.substring(0, entry.indexOf('/'))
                        }
                    })
                    .filter((value, index, self) => { return self.indexOf(value) === index })

                if (preExisting.length == 0) {
                    cfg.addons.push({
                        name: info.name,
                        link: info.link,
                        folders: rootFolders,
                        portal: info.portal,
                        version: info.version
                    })
                } else {
                    const index = cfg.addons.indexOf(preExisting[0])
                    cfg.addons[index].portal = info.portal
                    cfg.addons[index].link = info.link
                    cfg.addons[index].version = info.version
                    cfg.addons[index].folders = rootFolders
                }

                this.config.set(cfg);
                const foldersToRemove = folders.filter(f => { return _fileExists(path.join(this.installationPath, f)) })

                if (foldersToRemove.length > 0) {
                    const pattern = '{' + foldersToRemove.map(f => { return path.join(this.installationPath, f) }).join() + '}'

                    rimraf(pattern, (err) => {
                        if (err) { return cb(err, null) }

                        for (let i = 0; i < folders.length; i++) {
                            try {
                                mkdirp.sync(path.join(this.installationPath, folders[i]))
                            } catch (err) { return cb(err, null) }
                        }
                        //
                        for (let i = 0; i < unpackedFiles.length; i++) {
                            fs.appendFileSync(path.join(this.installationPath, unpackedFiles[i].filename), new Buffer(unpackedFiles[i].fileData))
                        }

                        fs.unlinkSync(tempZipPath)
                        return cb(null, folders)
                    })
                } else {
                    for (let i = 0; i < folders.length; i++) {
                        try {
                            mkdirp.sync(path.join(this.installationPath, folders[i]))
                        } catch (err) {
                            return cb(err, null)
                        }
                    }

                    for (let i = 0; i < unpackedFiles.length; i++) {
                        fs.appendFileSync(path.join(this.installationPath, unpackedFiles[i].filename), new Buffer(unpackedFiles[i].fileData))
                    }

                    fs.unlinkSync(tempZipPath)
                    return cb(null, rootFolders)
                }
            }
        })
    }

    _fileExists(path) {
        try {
          fs.accessSync(path, fs.F_OK);
          return true
        } catch (e) {
          return false
        }
      }
}

module.exports = Installer