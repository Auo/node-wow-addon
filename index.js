'use strict'
const path = require('path')
const fs = require('fs')
const rimraf = require('rimraf')
const request = require('request')
const AdmZip = require('adm-zip')
const portals = require('./lib/sources')
const sanitize = require('sanitize-filename')
const unrar = require('unrar-js')
const mkdirp = require('mkdirp')
const Config = require('./lib/config')
const ProjectScanner = require('./lib/project-scanner')

module.exports = function (installationPath) {
  const config = new Config(installationPath);
  const scanner = new ProjectScanner(installationPath);

  const listAddons = function listAddons(cb) {
    return cb(config.get().addons)
  }

  const scanAddonFolder = function scanAddonFolder(cb) {
    scanner.scan(cb)
  }

  const deleteAddon = function deleteAddon(name, cb) {
    const cfg = config.get();
    const installedAddons = cfg.addons.filter(conf => { return conf.name == name })

    if (installedAddons.length == 0) { return cb(new Error('no addon with that name found in the addons.json file')) }

    const addon = installedAddons[0];
    const index = cfg.addons.indexOf(addon)

    if (addon.folders.length == 0) {
      // no installation folders found
      cfg.addons.splice(index, 1)
      config.set(cfg);

      return cb(null)
    }

    const pattern = '{' + addon.folders.map(f => { return path.join(installationPath, f) }).join() + '}'

    rimraf(pattern, err => {
      if (err) { return cb(err) }
      cfg.addons.splice(index, 1)
      config.set(cfg);
      return cb(null)
    })
  }

  const installAddon = function installAddon(info, cb) {
    let fileEnding = info.downloadLink.substring(info.downloadLink.lastIndexOf('.'), info.downloadLink.length)

    if (fileEnding != '.zip' && fileEnding != '.rar') {
      if (info.portal === 'curse') {
        fileEnding = '.zip'; //assume it's zip
      } else {
        return cb(new Error('file-type not supported: ' + fileEnding), null)
      }
    }

    const tempZipName = sanitize(info.name + '-' + info.version + fileEnding).replace(/ /g, '')
    const cfg = config.get();

    const preExisting = cfg.addons.filter(conf => conf.name === info.name)
    const stream = fs.createWriteStream(path.join(installationPath, tempZipName))

    request(info.downloadLink)
      .on('error', (err) => {
        return cb(err, null)
      }).pipe(stream)

    stream.on('finish', function () {
      if (fileEnding == '.zip') {
        const zip = new AdmZip(path.join(installationPath, tempZipName))
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

        config.set(cfg);
        const foldersToRemove = folders.filter(f => { return fileExists(path.join(installationPath, f)) })

        if (foldersToRemove.length > 0) {
          const pattern = '{' + foldersToRemove.map(f => { return path.join(installationPath, f) }).join() + '}'

          rimraf(pattern, (err) => {
            if (err) { return cb(err, null) }

            zip.extractAllTo(installationPath)
            fs.unlinkSync(path.join(installationPath, tempZipName))
            return cb(null, folders)
          })
        } else {
          zip.extractAllTo(installationPath)
          fs.unlinkSync(path.join(installationPath, tempZipName))
          return cb(null, folders)
        }

      }
      else if (fileEnding == '.rar') {
        const unpackedFiles = unrar.unrarSync(path.join(installationPath, tempZipName))
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

        config.set(cfg);
        const foldersToRemove = folders.filter(f => { return fileExists(path.join(installationPath, f)) })

        if (foldersToRemove.length > 0) {
          const pattern = '{' + foldersToRemove.map(f => { return path.join(installationPath, f) }).join() + '}'

          rimraf(pattern, (err) => {
            if (err) { return cb(err, null) }

            for (let i = 0; i < folders.length; i++) {
              try {
                mkdirp.sync(path.join(installationPath, folders[i]))
              } catch (err) { return cb(err, null) }
            }
            //
            for (let i = 0; i < unpackedFiles.length; i++) {
              fs.appendFileSync(path.join(installationPath, unpackedFiles[i].filename), new Buffer(unpackedFiles[i].fileData))
            }

            fs.unlinkSync(path.join(installationPath, tempZipName))
            return cb(null, folders)
          })
        } else {
          for (let i = 0; i < folders.length; i++) {
            try {
              mkdirp.sync(path.join(installationPath, folders[i]))
            } catch (err) {
              return cb(err, null)
            }
          }

          for (let i = 0; i < unpackedFiles.length; i++) {
            fs.appendFileSync(path.join(installationPath, unpackedFiles[i].filename), new Buffer(unpackedFiles[i].fileData))
          }

          fs.unlinkSync(path.join(installationPath, tempZipName))
          return cb(null, rootFolders)
        }
      }
    })
  }

  const checkForAddonUpdate = function checkForUpdate(info, cb) {
    if (portals.availablePortals.indexOf(info.portal) == -1) { return cb(new Error('unspecified or unsupported portal'), null) }
    portals[info.portal].getAddonInfo(info, function (err, addon) {
      if (err) { return cb(err, null) }

      return cb(null, {
        newVersionAvailable: info.version !== addon.version,
        localVersion: info.version,
        portalVersion: addon.version
      })
    })
  }

  function fileExists(path) {
    try {
      fs.accessSync(path, fs.F_OK);
      return true
    } catch (e) {
      return false
    }
  }

  return {
    listAddons,
    deleteAddon,
    installAddon,
    checkForAddonUpdate,
    portals,
    scanAddonFolder
  }
}
