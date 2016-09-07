'use strict'
const wowtoc = require('wow-toc')
const path = require('path')
const fs = require('fs')
const rimraf = require('rimraf')
const request = require('request')
const AdmZip = require('adm-zip')
const jsonfile = require('jsonfile')
const portals = require('./sources')
const sanitize = require('sanitize-filename')

module.exports = function(installationPath) {

  if(!installationPath || typeof installationPath !== 'string') {
    throw new Error('installation path is empty or wrong type')
  }

  if(!folderExists(path.join(installationPath, 'addons.json'))) {
    fs.writeFileSync(path.join(installationPath,'addons.json'),'{"addons":[]}')
  }

  const listAddons = function listAddons(cb) {
    const config = jsonfile.readFileSync(path.join(installationPath, 'addons.json'))
    return cb(config.addons)
  }

  const scanAddonFolder = function scanAddonFolder(cb) {
    return cb(new Error('this is not implemented yet', null))
    //     const addons = []
    //     const folders = fs.readdirSync(installationPath)
    //     .filter(f => { return fs.statSync(path.join(installationPath, f)).isDirectory()})
    //     .filter(f => {
    //       return fs.readdirSync(path.join(installationPath, f)).some(file => {
    //           return file.indexOf(f + '.toc') !== -1 })
    //     })
    //
    //     for(let i= 0; i < folders.length; i++) {
    //       const tocPath = path.join(installationPath,folders[i], folders[i] + '.toc')
    //       const content = fs.readFileSync(tocPath, 'utf8')
    //       addons.push(wowtoc.parse(content))
    //     }
    //
    // //could do a check with either curse or wowinterace to check if they exists
    // //as packages on their sites. If not, it should be tagged as support / non-existing
    //     return cb(addons)

  }

  const deleteAddon = function deleteAddon(name, cb) {
    const config = jsonfile.readFileSync(path.join(installationPath, 'addons.json'))
    const installedAddons = config.addons.filter(conf => { return conf.name == name })

    if(installedAddons.length == 0) { return cb(new Error('no addon with that name found in the addons.json file'))  }

    const glob = installedAddons[0].folders.length > 1
    ? '{' + installedAddons[0].folders.map(f=> { return path.join(installationPath, f) }).join() + '}'
     : path.join(installationPath,installedAddons[0].folders[0])

    rimraf(glob, err => {
      if(err) { return cb(err) }
      const index = config.addons.indexOf(installedAddons[0])
      config.addons.splice(index, 1)
      jsonfile.writeFileSync(path.join(installationPath,'addons.json'), config)
      return cb(null)
    })
  }

  const createAddon = function createAddon(name, cb) {
    const addonPath = path.join(installationPath, name)
    if(folderExists(addonPath)) { return cb(new Error('addon folder already exists'), null) }

    const config = jsonfile.readFileSync(path.join(installationPath, 'addons.json'))
    config.addons.push({
      name,
      link: null,
      folders: [name],
      portal: null,
      version: '1.0'
    })
    fs.mkdirSync(addonPath)
    fs.writeFileSync(path.join(addonPath.toString(), name + '.toc'),
     '## Interface: 60200 \n## Title: ' + name + ' \n## Notes: what to do \n## Version: 1.0', 'utf8')

     jsonfile.writeFileSync(path.join(installationPath,'addons.json'), config)
     return cb(null, addonPath)
  }

  const installAddon = function installAddon(info, cb) {
    const tempZipName = sanitize(info.name + '-' + info.version + '.zip').replace(/ /g,'')
    const config = jsonfile.readFileSync(path.join(installationPath, 'addons.json'))

    const preExisting = config.addons.filter(conf => {
        return conf.name === info.name
      })

    const stream = fs.createWriteStream(path.join(installationPath, tempZipName))

    request(info.downloadLink)
    .on('error', (err) => {
      return cb(err, null)
    }).pipe(stream)

    stream.on('finish', function() {
      const zip = new AdmZip(path.join(installationPath, tempZipName))
      const zipEntries = zip.getEntries()

      const folders = zipEntries.map(entry => {return entry.entryName.substring(0, entry.entryName.indexOf('/')) })
      .filter((value, index, self) => { return self.indexOf(value) === index })

      if(preExisting.length == 0) {
          config.addons.push({
            name:info.name,
            link: info.link,
            folders,
            portal: info.portal,
            version: info.version
          })
        } else {
          const index = config.addons.indexOf(preExisting[0])
          config.addons[index].portal = info.portal
          config.addons[index].version = info.version
          config.addons[index].folders = folders
        }

        jsonfile.writeFileSync(path.join(installationPath,'addons.json'), config)
        const foldersToRemove = folders.filter(f => {return folderExists(path.join(installationPath, f)) })

      if(foldersToRemove.length > 0) {
        const glob = foldersToRemove.length > 1 ?
         '{' + foldersToRemove.map(f => { return path.join(installationPath, f) }).join() + '}'
        : path.join(installationPath, foldersToRemove[0])


        rimraf(glob, (err) => {
          if(err) { return cb(err, null) }

          zip.extractAllTo(installationPath)
          fs.unlinkSync(path.join(installationPath, tempZipName))
          return cb(null, folders)
        })
      } else {
        zip.extractAllTo(installationPath)
        fs.unlinkSync(path.join(installationPath, tempZipName))
        return cb(null, folders)
      }
    })
  }

  const checkForAddonUpdate = function checkForUpdate(info, cb) {
    if(portals.availablePortals.indexOf(info.portal) == -1) { return cb(new Error('unspecified or unsupported portal'), null)}

    portals[info.portal].getAddonInfo(info, function(err, addon) {
      if(err) { return cb(err, null) }

      return cb(null, {
        newVersionAvailable: info.version !== addon.version,
        localVersion: info.version,
        portalVersion: addon.version
      })
    })
  }

  function folderExists(path) {
    try {
        fs.accessSync(path, fs.F_OK);
        return true
    } catch (e) {
        return false
    }
  }

  return {
    listAddons,
    createAddon,
    deleteAddon,
    installAddon,
    checkForAddonUpdate,
    portals
  }
}
